import {ProxyNetworkProvider} from "@multiversx/sdk-network-providers/out";
import {
  Address,
  ContractFunction,
  Interaction,
  ResultsParser,
  SmartContract,
  StringValue
} from "@multiversx/sdk-core/out";

import {envChain} from "../customEnvChain";
import data from "../data.json";
import {World} from "xsuite";

const UMBRELLA_FEEDS_NAME = 'UmbrellaFeeds';
const STAKING_BANK_NAME = 'StakingBank';
const dataJsonFile = __dirname + '/data.json';

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
    console.log(e.message);
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