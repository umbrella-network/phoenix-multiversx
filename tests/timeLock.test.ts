import { afterEach, beforeEach, test } from 'vitest';
import { assertAccount, e, SContract, SWallet, SWorld } from 'xsuite';

let world: SWorld;
let deployer: SWallet;
let contract: SContract;
let address: string;

let multisigMock: SWallet;

const MOCK_ESDT = 'ESDT-123456';

beforeEach(async () => {
  world = await SWorld.start();

  deployer = await world.createWallet();
  multisigMock = await world.createWallet({
    kvs: [
      e.kvs.Esdts([
        { id: MOCK_ESDT, amount: 10_000 },
      ]),
    ],
  });

  ({ contract, address } = await deployer.deployContract({
    code: 'file:time-lock/output/time-lock.wasm',
    codeMetadata: [],
    gasLimit: 10_000_000,
    codeArgs: [
      e.U64(100),
      multisigMock,
    ],
  }));

  assertAccount(await contract.getAccountWithKvs(), {
    balance: 0n,
    allKvs: [
      e.kvs.Mapper('time_lock_period').Value(e.U64(100)),
      e.kvs.Mapper('multisig_address').Value(multisigMock),
    ],
  });
});

afterEach(() => {
  world.terminate();
});

test('Upgrade', async () => {
  await deployer.upgradeContract({
    callee: contract,
    code: 'file:time-lock/output/time-lock.wasm',
    codeMetadata: [],
    gasLimit: 10_000_000,
    codeArgs: [
      e.U64(200),
    ],
  });

  assertAccount(await contract.getAccountWithKvs(), {
    balance: 0n,
    allKvs: [
      e.kvs.Mapper('time_lock_period').Value(e.U64(200)),
      e.kvs.Mapper('multisig_address').Value(multisigMock),
    ],
  });
});

test('Propose call', async () => {
  await deployer.callContract({
    callee: contract,
    gasLimit: 10_000_000,
    funcName: 'proposeCall',
    funcArgs: [
      contract,
      e.U(0),
      e.Str('ESDTTransfer'),
      e.Str(MOCK_ESDT),
      e.U(10_000),
    ],
  }).assertFail({ code: 4, message: 'Only multisig can call this' });

  // Propose first call
  await multisigMock.callContract({
    callee: contract,
    gasLimit: 10_000_000,
    funcName: 'proposeCall',
    funcArgs: [
      contract,
      e.U(0),
      e.Str('ESDTTransfer'),
      e.Str(MOCK_ESDT),
      e.U(10_000),
    ],
  });

  assertAccount(await contract.getAccountWithKvs(), {
    balance: 0n,
    allKvs: [
      e.kvs.Mapper('time_lock_period').Value(e.U64(100)),
      e.kvs.Mapper('multisig_address').Value(multisigMock),

      e.kvs.Mapper('call_data_mapper.info').Value(e.Tuple(
        e.U32(1),
        e.U32(1),
        e.U32(1),
        e.U32(1),
      )),
      e.kvs.Mapper('call_data_mapper.node_links', e.U32(1)).Value(e.Tuple(
        e.U32(0),
        e.U32(0),
      )),
      e.kvs.Mapper('call_data_mapper.value', e.U32(1)).Value(e.Tuple(
        contract,
        e.U(0),
        e.Str('ESDTTransfer'),
        e.List(e.Str(MOCK_ESDT), e.U(10_000)),
        e.U64(100),
      )),
    ],
  });

  await world.setCurrentBlockInfo({ timestamp: 1 });

  // Propose another call
  await multisigMock.callContract({
    callee: contract,
    gasLimit: 10_000_000,
    funcName: 'proposeCall',
    funcArgs: [
      contract,
      e.U(0),
      e.Str('test'),
    ],
  });

  assertAccount(await contract.getAccountWithKvs(), {
    balance: 0n,
    allKvs: [
      e.kvs.Mapper('time_lock_period').Value(e.U64(100)),
      e.kvs.Mapper('multisig_address').Value(multisigMock),

      e.kvs.Mapper('call_data_mapper.info').Value(e.Tuple(
        e.U32(2),
        e.U32(1),
        e.U32(2),
        e.U32(2),
      )),
      e.kvs.Mapper('call_data_mapper.node_links', e.U32(1)).Value(e.Tuple(
        e.U32(0),
        e.U32(2),
      )),
      e.kvs.Mapper('call_data_mapper.value', e.U32(1)).Value(e.Tuple(
        contract,
        e.U(0),
        e.Str('ESDTTransfer'),
        e.List(e.Str(MOCK_ESDT), e.U(10_000)),
        e.U64(100),
      )),

      e.kvs.Mapper('call_data_mapper.node_links', e.U32(2)).Value(e.Tuple(
        e.U32(1),
        e.U32(0),
      )),
      e.kvs.Mapper('call_data_mapper.value', e.U32(2)).Value(e.Tuple(
        contract,
        e.U(0),
        e.Str('test'),
        e.List(),
        e.U64(101),
      )),
    ],
  });
});

test('Discard last call', async () => {
  await deployer.callContract({
    callee: contract,
    gasLimit: 10_000_000,
    funcName: 'discardLastCall',
    funcArgs: [],
  }).assertFail({ code: 4, message: 'Only multisig can call this' });

  // Propose two calls first
  await multisigMock.callContract({
    callee: contract,
    gasLimit: 10_000_000,
    funcName: 'proposeCall',
    funcArgs: [
      contract,
      e.U(0),
      e.Str('first'),
    ],
  });

  await multisigMock.callContract({
    callee: contract,
    gasLimit: 10_000_000,
    funcName: 'proposeCall',
    funcArgs: [
      contract,
      e.U(0),
      e.Str('second'),
    ],
  });

  // Then discard last
  await multisigMock.callContract({
    callee: contract,
    gasLimit: 10_000_000,
    funcName: 'discardLastCall',
    funcArgs: [],
  });

  assertAccount(await contract.getAccountWithKvs(), {
    balance: 0n,
    allKvs: [
      e.kvs.Mapper('time_lock_period').Value(e.U64(100)),
      e.kvs.Mapper('multisig_address').Value(multisigMock),

      e.kvs.Mapper('call_data_mapper.info').Value(e.Tuple(
        e.U32(1),
        e.U32(1),
        e.U32(1),
        e.U32(2),
      )),
      e.kvs.Mapper('call_data_mapper.node_links', e.U32(1)).Value(e.Tuple(
        e.U32(0),
        e.U32(0),
      )),
      e.kvs.Mapper('call_data_mapper.value', e.U32(1)).Value(e.Tuple(
        contract,
        e.U(0),
        e.Str('first'),
        e.List(),
        e.U64(100),
      )),
    ],
  });
});

test('Discard next call', async () => {
  await deployer.callContract({
    callee: contract,
    gasLimit: 10_000_000,
    funcName: 'discardNextCall',
    funcArgs: [],
  }).assertFail({ code: 4, message: 'Only multisig can call this' });

  // Propose two calls first
  await multisigMock.callContract({
    callee: contract,
    gasLimit: 10_000_000,
    funcName: 'proposeCall',
    funcArgs: [
      contract,
      e.U(0),
      e.Str('first'),
    ],
  });

  await multisigMock.callContract({
    callee: contract,
    gasLimit: 10_000_000,
    funcName: 'proposeCall',
    funcArgs: [
      contract,
      e.U(0),
      e.Str('second'),
    ],
  });

  // Then discard last
  await multisigMock.callContract({
    callee: contract,
    gasLimit: 10_000_000,
    funcName: 'discardNextCall',
    funcArgs: [],
  });

  assertAccount(await contract.getAccountWithKvs(), {
    balance: 0n,
    allKvs: [
      e.kvs.Mapper('time_lock_period').Value(e.U64(100)),
      e.kvs.Mapper('multisig_address').Value(multisigMock),

      e.kvs.Mapper('call_data_mapper.info').Value(e.Tuple(
        e.U32(1),
        e.U32(2),
        e.U32(2),
        e.U32(2),
      )),
      e.kvs.Mapper('call_data_mapper.node_links', e.U32(2)).Value(e.Tuple(
        e.U32(0),
        e.U32(0),
      )),
      e.kvs.Mapper('call_data_mapper.value', e.U32(2)).Value(e.Tuple(
        contract,
        e.U(0),
        e.Str('second'),
        e.List(),
        e.U64(100),
      )),
    ],
  });
});

test('Perform next call', async () => {
  await deployer.callContract({
    callee: contract,
    gasLimit: 10_000_000,
    funcName: 'performNextCall',
    funcArgs: [],
  }).assertFail({ code: 4, message: 'No call to perform' });

  // Propose first call
  await multisigMock.callContract({
    callee: contract,
    gasLimit: 10_000_000,
    funcName: 'proposeCall',
    funcArgs: [
      deployer,
      e.U(0),
      e.Str('ESDTTransfer'),
      e.Str(MOCK_ESDT),
      e.U(10_000),
    ],
  });

  // Send esdt to contract so the call can be performed successfully
  await multisigMock.transfer({
    receiver: contract,
    esdts: [{ id: MOCK_ESDT, amount: 10_000 }],
    gasLimit: 5_000_000,
  });

  await deployer.callContract({
    callee: contract,
    gasLimit: 10_000_000,
    funcName: 'performNextCall',
    funcArgs: [],
  }).assertFail({ code: 4, message: 'Can not perform yet' });

  await world.setCurrentBlockInfo({ timestamp: 100 });

  await deployer.callContract({
    callee: contract,
    gasLimit: 10_000_000,
    funcName: 'performNextCall',
    funcArgs: [],
  });

  assertAccount(await contract.getAccountWithKvs(), {
    balance: 0n,
    allKvs: [
      e.kvs.Mapper('time_lock_period').Value(e.U64(100)),
      e.kvs.Mapper('multisig_address').Value(multisigMock),
    ],
  });

  // Assert ESDTTransfer was performed
  assertAccount(await deployer.getAccountWithKvs(), {
    balance: 0n,
    allKvs: [
      e.kvs.Esdts([
        { id: MOCK_ESDT, amount: 10_000 },
      ]),
    ],
  });
});
