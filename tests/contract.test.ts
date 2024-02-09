import { afterEach, assert, beforeEach, test } from "vitest";
import { assertAccount, SWorld, SContract, SWallet, e } from "xsuite";
import createKeccakHash from "keccak";
import BigNumber from 'bignumber.js';
import fs from 'fs';
import { UserSecretKey } from '@multiversx/sdk-wallet/out';
import { getDataHash } from '../interact/signature';

let world: SWorld;
let deployer: SWallet;
let contractStakingBank: SContract;
let addressStakingBank: string;
let contract: SContract;
let address: string;

const chainId: number = 198003;

beforeEach(async () => {
  world = await SWorld.start();

  deployer = await world.createWallet({ balance: 10_000_000_000n });
});

afterEach(() => {
  world.terminate();
});

const deployStakingBank = async (path: string = 'staking-bank-static/staking-bank-static-local/output/staking-bank-static-local.wasm') => {
  const { contract, address } = await deployer.deployContract({
    code: `file:${ path }`,
    codeMetadata: [],
    gasLimit: 10_000_000,
    codeArgs: []
  });

  addressStakingBank = address;
  contractStakingBank = contract;
}

const deployContract = async (addressStakingBank: string, requiredSignatures: number = 1) => {
  ({ contract, address } = await deployer.deployContract({
    code: "file:umbrella-feeds/output/umbrella-feeds.wasm",
    codeMetadata: [],
    gasLimit: 10_000_000,
    codeArgs: [
      e.Addr(addressStakingBank),
      e.U32(requiredSignatures),
      e.U8(8),
      e.U32(chainId),
    ]
  }));

  const pairs = await contract.getAccountWithKvs();
  assertAccount(pairs, {
    balance: 0n,
    allKvs: [
      e.kvs.Mapper('staking_bank').Value(e.Addr(addressStakingBank)),
      e.kvs.Mapper('required_signatures').Value(e.U32(requiredSignatures)),
      e.kvs.Mapper('decimals').Value(e.U8(8)),
      e.kvs.Mapper('chain_id').Value(e.U32(chainId)),
    ],
  });
}

const generateSignature = (priceKeyRaw: string, priceData: {
  price: BigNumber;
  hearbeat: number;
  timestamp: number
}, signerPem = './alice.pem') => {
  const priceKey = createKeccakHash('keccak256').update(priceKeyRaw).digest('hex');

  const dataHash = getDataHash(chainId, address, priceKey, priceData);

  const file = fs.readFileSync(signerPem).toString();
  const privateKey = UserSecretKey.fromPem(file);

  // verify_signature
  const newData = Buffer.concat([
    Buffer.from("\x19MultiversX Signed Message:\n32"),
    Buffer.from(dataHash)
  ]);

  const newDataHash = createKeccakHash('keccak256').update(newData).digest();

  const publicKey = privateKey.generatePublicKey();
  const signature = privateKey.sign(newDataHash);

  return { priceKey, publicKey, signature, dataHash: dataHash.toString('hex') };
}

test("Deploy invalid required signatures", async () => {
  await deployStakingBank();

  await deployer.deployContract({
    code: "file:umbrella-feeds/output/umbrella-feeds.wasm",
    codeMetadata: [],
    gasLimit: 10_000_000,
    codeArgs: [
      e.Addr(addressStakingBank),
      e.U32(0),
      e.U8(8),
      e.U32(chainId),
    ]
  }).assertFail({ code: 4, message: 'Invalid required signatures' });
});

test("Deploy and update valid signature", async () => {
  await deployStakingBank();

  await deployContract(addressStakingBank);

  const priceData = {
    hearbeat: 0,
    timestamp: 1688998114,
    price: new BigNumber(1000000000, 10),
  };

  const { priceKey, publicKey, signature, dataHash } = generateSignature('ETH-USD', priceData);

  const query1 = await world.query({
    callee: contract,
    funcName: 'hashData',
    funcArgs: [
      e.List(e.Buffer(Buffer.from(priceKey, 'hex'))),
      e.List(e.Tuple(
        e.U32(priceData.hearbeat),
        e.U32(priceData.timestamp),
        e.U(priceData.price.toNumber()),
      ))
    ],
  });

  assert(dataHash === query1.returnData[0], 'Different data hash');

  await deployer.callContract({
    callee: contract,
    gasLimit: 10_000_000,
    funcName: 'update',
    funcArgs: [
      e.U32(1), // Length of the list needed before because of use of MultiValueManagedVecCounted in contract
      e.Bytes(Buffer.from(priceKey, 'hex')),

      e.U32(1),
      e.Tuple(
        e.U32(priceData.hearbeat),
        e.U32(priceData.timestamp),
        e.U(priceData.price.toNumber()),
      ),

      e.U32(1),
      e.Tuple(
        e.Addr(publicKey.toAddress().bech32()),
        e.Bytes(signature),
      ),
    ],
  });

  const pairs = await contract.getAccountWithKvs();
  assertAccount(pairs, {
    balance: 0n,
    allKvs: [
      e.kvs.Mapper('staking_bank').Value(e.Addr(addressStakingBank)),
      e.kvs.Mapper('required_signatures').Value(e.U32(1)),
      e.kvs.Mapper('decimals').Value(e.U8(8)),

      e.kvs.Mapper('prices', e.Buffer(Buffer.from(priceKey, 'hex'))).Value(e.Tuple(
        e.U32(priceData.hearbeat),
        e.U32(priceData.timestamp),
        e.U(priceData.price.toNumber()),
      )),

      e.kvs.Mapper('chain_id').Value(e.U32(chainId)),
    ],
  });

  const query = await world.query({
    callee: contract,
    funcName: 'getPriceDataByName',
    funcArgs: [e.Str('ETH-USD')],
  });

  const data = query.returnData;

  assert(
    data,
    e.Tuple(
      e.U32(priceData.hearbeat),
      e.U32(priceData.timestamp),
      e.U(priceData.price.toNumber()),
    ).toTopHex()
  );
});

test("Update not enough signatures", async () => {
  await deployStakingBank();

  await deployContract(addressStakingBank, 2);

  const priceData = {
    hearbeat: 0,
    timestamp: 1688998114,
    price: new BigNumber(1000000000, 10),
  };

  const { priceKey, publicKey, signature } = generateSignature('ETH-USD', priceData);

  await deployer.callContract({
    callee: contract,
    gasLimit: 10_000_000,
    funcName: 'update',
    funcArgs: [
      e.U32(1), // Length of the list needed before because of use of MultiValueManagedVecCounted in contract
      e.Bytes(Buffer.from(priceKey, 'hex')),

      e.U32(1),
      e.Tuple(
        e.U32(priceData.hearbeat),
        e.U32(priceData.timestamp),
        e.U(priceData.price.toNumber()),
      ),

      e.U32(1),
      e.Tuple(
        e.Addr(publicKey.toAddress().bech32()),
        e.Bytes(signature),
      ),
    ],
  }).assertFail({ code: 4, message: 'Not enough signatures' });
});

test("Update invalid signature", async () => {
  await deployStakingBank();

  await deployContract(addressStakingBank);

  const priceData = {
    hearbeat: 0,
    timestamp: 1688998114,
    price: new BigNumber(1000000000, 10),
  };

  const { priceKey, publicKey, signature } = generateSignature('ETH-USD', priceData);

  await deployer.callContract({
    callee: contract,
    gasLimit: 10_000_000,
    funcName: 'update',
    funcArgs: [
      e.U32(1), // Length of the list needed before because of use of MultiValueManagedVecCounted in contract
      e.Bytes(Buffer.from(priceKey, 'hex')),

      e.U32(1),
      e.Tuple(
        e.U32(priceData.hearbeat),
        e.U32(priceData.timestamp),
        e.U(1), // wrong price
      ),

      e.U32(1),
      e.Tuple(
        e.Addr(publicKey.toAddress().bech32()),
        e.Bytes(signature),
      ),
    ],
  }).assertFail({ code: 10, message: 'invalid signature' });
});

test("Update invalid signer", async () => {
  await deployStakingBank();

  await deployContract(addressStakingBank);

  const priceData = {
    hearbeat: 0,
    timestamp: 1688998114,
    price: new BigNumber(1000000000, 10),
  };

  const { priceKey, publicKey, signature } = generateSignature('ETH-USD', priceData, './bob.pem');

  await deployer.callContract({
    callee: contract,
    gasLimit: 10_000_000,
    funcName: 'update',
    funcArgs: [
      e.U32(1), // Length of the list needed before because of use of MultiValueManagedVecCounted in contract
      e.Bytes(Buffer.from(priceKey, 'hex')),

      e.U32(1),
      e.Tuple(
        e.U32(priceData.hearbeat),
        e.U32(priceData.timestamp),
        e.U(priceData.price.toNumber()),
      ),

      e.U32(1),
      e.Tuple(
        e.Addr(publicKey.toAddress().bech32()),
        e.Bytes(signature),
      ),
    ],
  }).assertFail({ code: 4, message: 'Invalid signer' });
});

test("Update signatures out of order", async () => {
  await deployStakingBank();

  await deployContract(addressStakingBank, 15);

  const priceData = {
    hearbeat: 0,
    timestamp: 1688998114,
    price: new BigNumber(1000000000, 10),
  };

  const { priceKey, publicKey, signature } = generateSignature('ETH-USD', priceData);
  const { publicKey: publicKeyBob, signature: signatureBob } = generateSignature('ETH-USD', priceData, './bob.pem');
  const {
    publicKey: publicKeyCarol,
    signature: signatureCarol
  } = generateSignature('ETH-USD', priceData, './carol.pem');

  await deployer.callContract({
    callee: contract,
    gasLimit: 53_000_000,
    funcName: 'update',
    funcArgs: [
      e.U32(1),
      e.Bytes(Buffer.from(priceKey, 'hex')),

      e.U32(1),
      e.Tuple(
        e.U32(priceData.hearbeat),
        e.U32(priceData.timestamp),
        e.U(priceData.price.toNumber()),
      ),

      e.U32(15),
      e.Tuple(
        e.Addr(publicKey.toAddress().bech32()),
        e.Bytes(signature),
      ),
      e.Tuple(
        e.Addr(publicKeyBob.toAddress().bech32()),
        e.Bytes(signatureBob),
      ),
      e.Tuple(
        e.Addr(publicKeyCarol.toAddress().bech32()),
        e.Bytes(signatureCarol),
      ),
      e.Tuple(
        e.Addr(publicKey.toAddress().bech32()),
        e.Bytes(signature),
      ),
      e.Tuple(
        e.Addr(publicKeyBob.toAddress().bech32()),
        e.Bytes(signatureBob),
      ),
      e.Tuple(
        e.Addr(publicKeyCarol.toAddress().bech32()),
        e.Bytes(signatureCarol),
      ),
      e.Tuple(
        e.Addr(publicKeyBob.toAddress().bech32()),
        e.Bytes(signatureBob),
      ),
      e.Tuple(
        e.Addr(publicKey.toAddress().bech32()),
        e.Bytes(signature),
      ),
      e.Tuple(
        e.Addr(publicKeyCarol.toAddress().bech32()),
        e.Bytes(signatureCarol),
      ),
      e.Tuple(
        e.Addr(publicKeyBob.toAddress().bech32()),
        e.Bytes(signatureBob),
      ),
      e.Tuple(
        e.Addr(publicKey.toAddress().bech32()),
        e.Bytes(signature),
      ),
      e.Tuple(
        e.Addr(publicKey.toAddress().bech32()),
        e.Bytes(signature),
      ),
      e.Tuple(
        e.Addr(publicKeyCarol.toAddress().bech32()),
        e.Bytes(signatureCarol),
      ),
      e.Tuple(
        e.Addr(publicKey.toAddress().bech32()),
        e.Bytes(signature),
      ),
      e.Tuple(
        e.Addr(publicKeyCarol.toAddress().bech32()),
        e.Bytes(signatureCarol),
      ),
    ],
  }).assertFail({ code: 4, message: 'Signatures out of order' });
});
