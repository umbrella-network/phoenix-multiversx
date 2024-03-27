import {e} from "xsuite";
import {
  AbiRegistry,
  Address, AddressValue,
  ContractFunction,
  Interaction, ListType, NumericalValue, ResultsParser,
  SmartContract, StringValue, Struct,
  VariadicValue
} from "@multiversx/sdk-core/out";
import BigNumber from "bignumber.js";
import {ProxyNetworkProvider} from "@multiversx/sdk-network-providers/out";

import {envChain} from '../customEnvChain';
import data from '../data.json';
import TimeLockAbi from "../../time-lock/output/time-lock.abi.json";
import {getAddressByString, loadWallet, printTxStatus, readFromTimelock} from "./helpers";

export async function timelockChangeOwner(target: string, newOwner: string, shardId: number) {
  const wallet = await loadWallet(shardId);
  const timeLock = new SmartContract({address: Address.fromBech32(envChain.select(data.timeLockAddress))});

  const txResult = await wallet.callContract({
    callee: timeLock.getAddress().bech32(),
    gasLimit: 10_000_000,
    funcName: 'proposeCall',
    funcArgs: [
      e.Addr(target),
      e.U(0),
      e.Str('ChangeOwnerAddress'),
      e.Addr(newOwner),
    ],
  });

  printTxStatus(txResult);
}

export async function timelockPrintPendingCalls() {
  const proxy = new ProxyNetworkProvider(envChain.publicProxyUrl());
  const timelock = new SmartContract({address: Address.fromBech32(envChain.select(data.timeLockAddress))});

  const query = new Interaction(timelock, new ContractFunction('getPendingCallsFullInfo'), []).buildQuery();
  const response = await proxy.queryContract(query);

  const endpointDefinition = AbiRegistry.create(TimeLockAbi).getEndpoint('getPendingCallsFullInfo');
  const parsedResponse = new ResultsParser().parseQueryResponse(response, endpointDefinition);


  const items = (parsedResponse.values as VariadicValue[])[0].getItems() as Struct[];

  const calls = items.map((values, i) => {
    const fields = values.getFields();
    // console.log(fields);
    // return '';

    const [to, egld_amount, endpoint_name, args, perform_after_timestamp] =
      fields as unknown as [AddressValue, NumericalValue, StringValue, ListType, NumericalValue];

    const performAfterTimestamp = parseInt(perform_after_timestamp.value.toString(10));
    const readyToExecute = performAfterTimestamp < Date.now() / 1000;

    return {
      to: new Address(to.value.value).bech32(),
      performAfterTimestamp,
      readyToExecute,
      wait: readyToExecute ? 0 : performAfterTimestamp - Date.now() / 1000,
      endpoint_name: Buffer.from(endpoint_name.value.value).toString('utf-8'),
      egld_amount: BigInt(new BigNumber(egld_amount.value).toFixed()),
      args: JSON.stringify(args.value),
      // args2: Buffer.from(args.value.value).toString('hex'),
    };
  });

  console.log(calls);
  console.log(calls.length, 'pending calls');
  console.log(calls.filter(c => c.readyToExecute).length, 'ready to execute');
}


export async function timelockPrintState() {
  const proxy = new ProxyNetworkProvider(envChain.publicProxyUrl());
  const contract = new SmartContract({address: Address.fromBech32(envChain.select(data.timeLockAddress))});

  console.log('deployerAddress:', await getAddressByString('deployerAddress'));

  const timeLockPeriod = parseInt((await readFromTimelock(proxy, contract, 'getTimeLockPeriod'))[0].toString('hex'), 16);
  const multisigAddress = new Address((await readFromTimelock(proxy, contract, 'getMultisigAddress'))[0]).bech32();
  const pendingCalls = await readFromTimelock(proxy, contract, 'getPendingCallsFullInfo');

  console.log({
    timeLockPeriod,
    multisigAddress,
    pendingCalls: pendingCalls.length,
    deployerAddress: await getAddressByString('deployerAddress')
  });
}

export async function timelockPerformNextCall(shardId: number, gas = 10_000_000) {
  const wallet = await loadWallet(shardId);
  const contract = new SmartContract({address: Address.fromBech32(envChain.select(data.timeLockAddress))});

  const tx = await wallet.callContract({
    callee: contract.getAddress().bech32(),
    gasLimit: gas,
    funcName: 'performNextCall',
    funcArgs: []
  });

  printTxStatus(tx);
}


export async function timelockDiscardCall(shardId: number) {
  const wallet = await loadWallet(shardId);
  const contract = new SmartContract({address: Address.fromBech32(envChain.select(data.timeLockAddress))});

  const tx = await wallet.callContract({
    callee: contract.getAddress().bech32(),
    gasLimit: 10_000_000,
    funcName: 'discardCall',
    funcArgs: []
  });

  printTxStatus(tx);
}
