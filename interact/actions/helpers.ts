import {ProxyNetworkProvider} from "@multiversx/sdk-network-providers/out";
import {
  Address,
  ContractFunction,
  Interaction,
  ResultsParser,
  SmartContract,
  StringValue
} from "@multiversx/sdk-core/out";
import {e, World} from "xsuite";

import {envChain} from "../customEnvChain";
import data from "../data.json";
import {Encodable} from "xsuite/dist/data/Encodable";
import {timelockStatus} from "./timelockActions";

export interface TimelockStatus {
  timeLockPeriod: number,
  multisigAddress: string,
  pendingCalls: number
}

const world = World.new({
  proxyUrl: envChain.publicProxyUrl(),
  chainId: envChain.id(),
  gasPrice: 1000000000,
});

export const loadWallet = (shard: number) => {
  if (shard === undefined) throw new Error(`please provide shard ID`);

  return world.newWalletFromFile(`wallets/${envChain.name()}/deployer.${envChain.name()}.shard${shard}.json`);
};

export async function getAddressByString(name: string): Promise<string> {
  try {
    const proxy = new ProxyNetworkProvider(envChain.publicProxyUrl());
    const contract = new SmartContract({address: Address.fromBech32(envChain.select(data.registryAddress))});

    const query = new Interaction(contract, new ContractFunction('getAddressByString'), [new StringValue(name)])
      .buildQuery();
    const response = await proxy.queryContract(query);
    const parsedResponse = new ResultsParser().parseUntypedQueryResponse(response);

    return Address.fromBuffer(parsedResponse.values[0]).bech32();
  } catch (e) {
    console.log(`[getAddressByString] error for '${name}': ${e.message}`);
    return 'unknown';
  }
}

export async function readFromTimelock(proxy: ProxyNetworkProvider, contract: SmartContract,  method: string): Promise<Buffer[]> {
  let query = new Interaction(contract, new ContractFunction(method), []).buildQuery();
  let response = await proxy.queryContract(query);
  let responseParsed = new ResultsParser().parseUntypedQueryResponse(response);
  return responseParsed.values;
}


export function printTxStatus(tx: any) {
  console.log('explorerUrl', tx.tx.explorerUrl);
  console.log('status', tx.tx.status);

  if (tx.tx.status != 'success') {
    console.log(tx);
  }
}

export async function printTimelockProposeCall(funcArgs: Encodable[]) {
  const method = Buffer.from(funcArgs[2].toNestHex(), 'hex').toString('utf-8');

  const env = envChain.name();

  console.log('\n---- paste this to multisig:', env, '-----\n');
  console.log(`[${env}] multisig address set in timelock:`, (await timelockStatus()).multisigAddress);
  console.log(`[${env}] propose send to:`, data['timeLockAddress'][envChain.name()]);
  console.log('method:', `${method}():\n`);
  console.log(`proposeCall@${funcArgs.map(a => a.toTopHex()).join('@')}`);
}

export function getRegistryAddress() {
  const registryAddress = data['registryAddress'][envChain.name()];
  if (!registryAddress) throw new Error(`[${envChain.name()}] registryAddress not found`);

  return registryAddress;
}

export function getTimelockAddress() {
  const timelock = data['timeLockAddress'][envChain.name()];
  if (!timelock) throw new Error(`[${envChain.name()}] timelock not found`);

  return timelock;
}

export function getMultisigAddress() {
  const multisig = data['multisigAddress'][envChain.name()];
  if (!multisig) throw new Error(`[${envChain.name()}] multisig not found`);

  return multisig;
}

export async function executeProposeCall(proposeAsyncCall: Encodable[], shardId: number) {
  const funcArgs = [
    e.Addr(getTimelockAddress()), // needs to be to timelock contract
    e.U(0), // egld amount is 0,
    e.Str('proposeCall'), // function is propose call

    ...proposeAsyncCall
  ];

  const wallet = await loadWallet(shardId);

  const txResult = await wallet.callContract({
    callee: getMultisigAddress(), // multisig
    gasLimit: 10_000_000,
    funcName: 'proposeAsyncCall',
    funcArgs
  });

  printTxStatus(txResult);
}