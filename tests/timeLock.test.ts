import { afterEach, beforeEach, test } from 'vitest';
import { assertAccount, e, SContract, SWallet, SWorld } from 'xsuite';
import fs from 'fs';

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

test('Discard call', async () => {
  await deployer.callContract({
    callee: contract,
    gasLimit: 10_000_000,
    funcName: 'discardCall',
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
    funcName: 'discardCall',
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

test('Test multisig timelock flow staking bank upgrade', async () => {
  // Deploy multisig
  const { contract: multisig } = await deployer.deployContract({
    code: 'file:tests/multisig.wasm',
    codeMetadata: [],
    gasLimit: 50_000_000,
    codeArgs: [
      e.U32(1),
      deployer,
    ],
  });

  // Deploy timelock with correct multisig
  ({ contract, address } = await deployer.deployContract({
    code: 'file:time-lock/output/time-lock.wasm',
    codeMetadata: [],
    gasLimit: 10_000_000,
    codeArgs: [
      e.U64(100),
      multisig,
    ],
  }));

  assertAccount(await contract.getAccountWithKvs(), {
    balance: 0n,
    allKvs: [
      e.kvs.Mapper('time_lock_period').Value(e.U64(100)),
      e.kvs.Mapper('multisig_address').Value(multisig),
    ],
  });

  const stakingBankCode = 'staking-bank-static/staking-bank-static-local/output/staking-bank-static-local.wasm';
  // Deploy staking bank
  const { contract: stakingBank } = await deployer.deployContract({
    code: `file:${stakingBankCode}`,
    codeMetadata: ['upgradeable'],
    gasLimit: 10_000_000,
    codeArgs: [],
  });

  // Change owner of staking bank to time lock
  await stakingBank.setAccount({
    ...await stakingBank.getAccountWithKvs(),
    owner: contract,
    codeMetadata: ['upgradeable'],
  });

  // Propose upgrade of staking bank
  await deployer.callContract({
    callee: multisig,
    funcName: 'proposeAsyncCall',
    gasLimit: 100_000_000,
    funcArgs: [
      contract, // needs to be to timelock contract
      e.U(0), // egld amount is 0,
      e.Str('proposeCall'), // function is propose call
      stakingBank, // to argument from proposeCall function on timelock
      e.U(0), // egld amount from proposalCall function on timelock
      e.Str('upgradeContract'), // function to call on staking bank
      e.Buffer(fs.readFileSync(stakingBankCode)), // code for upgrade
      e.Buffer('0000'), // new code metadata
      // staking bank contract has no other arguments
    ],
  });

  // Sign action
  await deployer.callContract({
    callee: multisig,
    funcName: 'sign',
    gasLimit: 10_000_000,
    funcArgs: [
      e.U32(1), // action id is 1
    ],
  });

  // Perform action
  await deployer.callContract({
    callee: multisig,
    funcName: 'performAction',
    gasLimit: 200_000_000,
    funcArgs: [
      e.U32(1), // action id is 1
    ],
  });

  // Time lock should have received call
  assertAccount(await contract.getAccountWithKvs(), {
    balance: 0n,
    allKvs: [
      e.kvs.Mapper('time_lock_period').Value(e.U64(100)),
      e.kvs.Mapper('multisig_address').Value(multisig),

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
        stakingBank, // to argument from proposeCall function on timelock
        e.U(0), // egld amount from proposalCall function on timelock
        e.Str('upgradeContract'), // function to call on staking bank
        e.List(
          e.Buffer(fs.readFileSync(stakingBankCode)), // code for upgrade
          e.Buffer('0000'), // new code metadata
        ),
        e.U64(100),
      )),
    ],
  });

  await deployer.callContract({
    callee: contract,
    gasLimit: 10_000_000,
    funcName: 'performNextCall',
    funcArgs: [],
  }).assertFail({ code: 4, message: 'Can not perform yet' });

  await world.setCurrentBlockInfo({ timestamp: 100 });

  // Metadata before the upgrade is performed
  assertAccount(await stakingBank.getAccountWithKvs(), {
    codeMetadata: ["upgradeable"],
  });

  await deployer.callContract({
    callee: contract,
    gasLimit: 200_000_000,
    funcName: 'performNextCall',
    funcArgs: [],
  });

  // Call was removed from time lock storage
  assertAccount(await contract.getAccountWithKvs(), {
    balance: 0n,
    allKvs: [
      e.kvs.Mapper('time_lock_period').Value(e.U64(100)),
      e.kvs.Mapper('multisig_address').Value(multisig),
    ],
  });

  // Metadata after the upgrade is performed (so we know it has actually been upgraded successfully)
  assertAccount(await stakingBank.getAccountWithKvs(), {
    codeMetadata: ["readable", "upgradeable", "payable"],
  });
});
