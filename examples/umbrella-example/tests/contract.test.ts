import { test, beforeEach, afterEach, assert } from "vitest";
import { assertAccount, SWorld, SWallet, SContract, e, d } from "xsuite";
import createKeccakHash from "keccak";

let world: SWorld;
let deployer: SWallet;
let user: SWallet;
let contract: SContract;
let registry: SContract;
let feeds: SContract;

const MOCK_ADDRESS: string = "erd1qqqqqqqqqqqqqpgqd77fnev2sthnczp2lnfx0y5jdycynjfhzzgq6p3rax";
const UMBRELLA_FEEDS_NAME = "UmbrellaFeeds";

const TOKEN_ID_OTHER = "OTHER-123456";
const TOKEN_ID = "WEGLD-123456";
const TOKEN_KEY = "EGLD";
const TOKEN_KEY_HASH = createKeccakHash('keccak256').update(TOKEN_KEY).digest('hex');

async function mockPriceFeed(timestamp = 123456) {
  await feeds.setAccount({
    ...(await feeds.getAccountWithKvs()),
    kvs: [
      e.kvs.Mapper('prices', e.Buffer(TOKEN_KEY_HASH)).Value(e.Tuple(
        e.U32(1),
        e.U32(timestamp),
        e.U(500), // price
      )),
    ],
  });
}

beforeEach(async () => {
  world = await SWorld.start();
  deployer = await world.createWallet();
  user = await world.createWallet({
    kvs: [
      e.kvs.Esdts([
        { id: TOKEN_ID, amount: 10_000 },
        { id: TOKEN_ID_OTHER, amount: 10_000 },
      ])
    ],
  });

  // Deploy Feeds contract
  const { contract: contractFeeds }  = await deployer.deployContract({
    code: "file:tests/umbrella-feeds.wasm",
    codeMetadata: [],
    codeArgs: [
      e.Addr(MOCK_ADDRESS),
      e.U32(1),
      e.U8(8),
      e.U32(1),
    ],
    gasLimit: 10_000_000
  });
  feeds = contractFeeds;

  // Deploy Registry contract
  const { contract: contractRegistry } = await deployer.deployContract({
    code: "file:tests/registry.wasm",
    codeMetadata: [],
    gasLimit: 10_000_000,
  });
  registry = contractRegistry;

  // Add umbrella feeds contract address to registry
  await deployer.callContract({
    callee: registry,
    gasLimit: 10_000_000,
    funcName: "importAddresses",
    funcArgs: [
      e.U32(1),
      e.Bytes(Buffer.from(UMBRELLA_FEEDS_NAME, 'utf-8')),

      e.U32(1),
      feeds,
    ]
  });

  ({ contract } = await deployer.deployContract({
    code: "file:output/umbrella-example.wasm",
    codeMetadata: [],
    codeArgs: [
      registry,
      e.Str(TOKEN_ID),
      e.Str(TOKEN_KEY),
    ],
    gasLimit: 10_000_000,
  }));
});

afterEach(async () => {
  await world.terminate();
});

test("Deploy", async () => {
  assertAccount(await contract.getAccountWithKvs(), {
    balance: 0n,
    kvs: [
      e.kvs.Mapper("registry").Value(registry),
      e.kvs.Mapper("token_identifier").Value(e.Str(TOKEN_ID)),
      e.kvs.Mapper("token_key").Value(e.Bytes(TOKEN_KEY_HASH)),
    ],
  });
});

test("Pay", async () => {
  await user.callContract({
    callee: contract,
    gasLimit: 5_000_000,
    funcName: "pay",
    esdts: [
      { id: TOKEN_ID_OTHER, amount: 10_000 },
    ],
  }).assertFail({ code: 4, message: "Wrong token sent" });

  await mockPriceFeed();

  await user.callContract({
    callee: contract,
    gasLimit: 10_000_000,
    funcName: "pay",
    esdts: [
      { id: TOKEN_ID, amount: 499 },
    ],
  }).assertFail({ code: 4, message: "Insufficient amount sent" });

  await user.callContract({
    callee: contract,
    gasLimit: 10_000_000,
    funcName: "pay",
    esdts: [
      { id: TOKEN_ID, amount: 500 },
    ],
  });

  await user.callContract({
    callee: contract,
    gasLimit: 10_000_000,
    funcName: "pay",
    esdts: [
      { id: TOKEN_ID, amount: 600 },
    ],
  });

  assertAccount(await contract.getAccountWithKvs(), {
    balance: 0n,
    kvs: [
      e.kvs.Mapper("registry").Value(registry),
      e.kvs.Mapper("token_identifier").Value(e.Str(TOKEN_ID)),
      e.kvs.Mapper("token_key").Value(e.Bytes(TOKEN_KEY_HASH)),

      e.kvs.Esdts([
        { id: TOKEN_ID, amount: 1_000 },
      ])
    ],
  });

  assertAccount(await user.getAccountWithKvs(), {
    balance: 0n,
    kvs: [
      e.kvs.Esdts([
        { id: TOKEN_ID, amount: 9_000 },
        { id: TOKEN_ID_OTHER, amount: 10_000 },
      ])
    ],
  });
});

test("Collect", async () => {
  await mockPriceFeed();

  await user.callContract({
    callee: contract,
    funcName: "collect",
    gasLimit: 10_000_000,
  }).assertFail({ code: 4, message: "Endpoint can only be called by owner"});

  await deployer.callContract({
    callee: contract,
    funcName: "collect",
    gasLimit: 10_000_000,
  }).assertFail({ code: 4, message: "Balance is empty"});

  // Mock tokens in contract and same timestamp
  await contract.setAccount({
    ...(await contract.getAccount()),
    kvs: [
      e.kvs.Mapper("registry").Value(registry),
      e.kvs.Mapper("token_identifier").Value(e.Str(TOKEN_ID)),
      e.kvs.Mapper("token_key").Value(e.Bytes(TOKEN_KEY_HASH)),

      e.kvs.Mapper("last_collect_time").Value(e.U32(123456)),

      e.kvs.Esdts([
        { id: TOKEN_ID, amount: 1_000 },
      ])
    ],
  });

  await deployer.callContract({
    callee: contract,
    funcName: "collect",
    gasLimit: 10_000_000,
  }).assertFail({ code: 4, message: "Can not collect yet"});

  await mockPriceFeed(123457);

  await deployer.callContract({
    callee: contract,
    funcName: "collect",
    gasLimit: 10_000_000,
  });

  assertAccount(await contract.getAccountWithKvs(), {
    balance: 0n,
    kvs: [
      e.kvs.Mapper("registry").Value(registry),
      e.kvs.Mapper("token_identifier").Value(e.Str(TOKEN_ID)),
      e.kvs.Mapper("token_key").Value(e.Bytes(TOKEN_KEY_HASH)),

      e.kvs.Mapper("last_collect_time").Value(e.U32(123457)),

      e.kvs.Esdts([
        { id: TOKEN_ID, amount: 0 },
      ])
    ],
  });

  assertAccount(await deployer.getAccountWithKvs(), {
    kvs: [
      e.kvs.Esdts([
        { id: TOKEN_ID, amount: 1_000 },
      ])
    ],
  });
});

test("Views", async () => {
  await mockPriceFeed();

  const { returnData } = await world.query({
    callee: contract,
    funcName: "getExternalPriceData",
  });

  const result = d.Tuple({
    heartbeat: d.U32(),
    timestamp: d.U32(),
    price: d.U()
  }).topDecode(returnData[0]);

  assert(result.heartbeat.valueOf() === BigInt(1));
  assert(result.timestamp.valueOf() === BigInt(123456));
  assert(result.price.valueOf() === BigInt(500));

  const { returnData: rawPrice } = await world.query({
    callee: contract,
    funcName: "getExternalPrice",
  });

  const price = d.U().topDecode(rawPrice[0]);

  assert(price.valueOf() === BigInt(500));
});
