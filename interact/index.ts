import { Command } from 'commander';
import { d, e, World } from 'xsuite';
// @ts-ignore
import data from './data.json';
import { Address, ResultsParser, SmartContract } from '@multiversx/sdk-core';
import { ProxyNetworkProvider } from '@multiversx/sdk-network-providers/out';
import BigNumber from 'bignumber.js';
import { generateSignature, getDataHash } from './signature';
import {
  BigUIntType,
  BigUIntValue,
  BinaryCodec,
  BytesValue,
  ContractFunction,
  FieldDefinition,
  Interaction,
  List,
  StringValue,
  StructType,
  Transaction,
  Tuple,
  U32Type,
  U32Value,
} from '@multiversx/sdk-core/out';
import { Signature } from '@multiversx/sdk-core/out/signature';
import createKeccakHash from 'keccak';

import { envChain } from './customEnvChain.js';
import { readJson, saveToJson } from './utils';
import { ChainName, ContractName, DataJson } from './types';

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

function saveDeploymentResults(contract: ContractName, address: string): DataJson {
  const dataJson = readJson<DataJson>(dataJsonFile);

  switch (envChain.name()) {
    case ChainName.mainnet:
      dataJson[contract].mainnet = address;
      break;

    case ChainName.devnet:
      dataJson[contract].devnet = address;
      break;

    case ChainName.sbx:
      dataJson[contract].sbx = address;
      break;

    default:
      throw new Error(`[saveDeploymentResults] unknown chain name: ${envChain.name()}`);
  }

  saveToJson(dataJsonFile, dataJson);

  return dataJson;
}

const program = new Command();

program.command('deploy')
  .argument('[requiredSignatures]', 'The number of required signatures', 2)
  .argument('[pricesDecimals]', 'The number of decimals', 8)
  .argument('[shardId]', 'Shard number')
  .action(async (requiredSignatures: number, priceDecimals: number, shardId: number) => {
    const wallet = await loadWallet(shardId);

    console.log('Deploying Staking Bank contract...');
    const resultStakingBank = await wallet.deployContract({
      code: envChain.select(data.stakingBankCode),
      codeMetadata: ['upgradeable'],
      gasLimit: 100_000_000,
    });
    console.log('Staking Bank Result', resultStakingBank);

    saveDeploymentResults(ContractName.stakingBankAddress, resultStakingBank.address);

    console.log(`Deploying Umbrella Feeds contract with ${requiredSignatures} required signatures and ${priceDecimals} price decimals ...`);
    console.log('data.chainId', data.chainId);
    console.log('selected ID:', envChain.select(data.chainId), BigInt(envChain.select(data.chainId)));

    const result = await wallet.deployContract({
      code: data.code,
      codeMetadata: ['upgradeable'],
      gasLimit: 100_000_000,
      codeArgs: [
        e.Addr(resultStakingBank.address),
        e.U32(BigInt(requiredSignatures)),
        e.U8(BigInt(priceDecimals)),
        e.U32(BigInt(envChain.select(data.chainId))),
      ],
    });
    console.log('Umbrella Feeds Result:', result);
    saveDeploymentResults(ContractName.feedsAddress, result.address);

    console.log('Deploying Registry contract...');
    const resultRegistry = await wallet.deployContract({
      code: data.registryCode,
      codeMetadata: [],
      gasLimit: 100_000_000,
    });
    console.log('Registry Result', resultRegistry);
    saveDeploymentResults(ContractName.registryAddress, resultRegistry.address);

    console.log('Adding UmbrellaFeeds & StakingBank addresses to Registry...');
    const txResult = await wallet.callContract({
      callee: resultRegistry.address,
      gasLimit: 10_000_000,
      funcName: 'importAddresses',
      funcArgs: [
        e.U32(2),
        e.Bytes(Buffer.from(STAKING_BANK_NAME, 'utf-8')),
        e.Bytes(Buffer.from(UMBRELLA_FEEDS_NAME, 'utf-8')),

        e.U32(2),
        e.Addr(resultStakingBank.address),
        e.Addr(result.address),
      ],
    });
    console.log('Adding addresses to Registry Result', txResult);

    console.log('Staking Bank Address:', resultStakingBank.address);
    console.log('Umbrella Feeds Address:', result.address);
    console.log('Registry Address', resultRegistry.address);
  });

program.command('importAddresses')
  .argument('[shardId]', 'Shard number')
  .action(async (shardId: number) => {
    const wallet = await loadWallet(shardId);
    const dataJson = readJson<DataJson>(dataJsonFile);

    console.log('Adding UmbrellaFeeds & StakingBank addresses to Registry...');
    const txResult = await wallet.callContract({
      callee: dataJson.registryAddress[envChain.name() as ChainName],
      gasLimit: 10_000_000,
      funcName: 'importAddresses',
      funcArgs: [
        e.U32(2),
        e.Bytes(Buffer.from(STAKING_BANK_NAME, 'utf-8')),
        e.Bytes(Buffer.from(UMBRELLA_FEEDS_NAME, 'utf-8')),

        e.U32(2),
        e.Addr(dataJson.stakingBankAddress[envChain.name() as ChainName]),
        e.Addr(dataJson.feedsAddress[envChain.name() as ChainName]),
      ],
    });
    console.log('Adding addresses to Registry Result', txResult);
  });

program.command('upgradeRegistry')
  .argument('[shardId]', 'Shard number')
  .action(async (shardId: number) => {
    const wallet = await loadWallet(shardId);
    const dataJson = readJson<DataJson>(dataJsonFile);
    const address = dataJson.registryAddress[envChain.name() as ChainName];

    console.log('Upgrading Registry contract', address);
    const resultRegistry = await wallet.upgradeContract({
      callee: address,
      code: dataJson.registryCode,
      codeMetadata: [],
      gasLimit: 100_000_000,
    });
    console.log('Registry Result', resultRegistry);
  });

/*
npm run interact:devnet upgradeBank 1
*/
program.command('upgradeBank')
  .argument('[shardId]', 'Shard number')
  .action(async (shardId: number) => {
    const wallet = await loadWallet(shardId);
    const dataJson = readJson<DataJson>(dataJsonFile);
    const address = dataJson.stakingBankAddress[envChain.name() as ChainName];

    console.log('Upgrading Staking Bank', envChain.name(), ' contract', address);
    const resultRegistry = await wallet.upgradeContract({
      callee: address,
      code: dataJson.stakingBankCode[envChain.name() as ChainName],
      codeMetadata: ['upgradeable'],
      gasLimit: 100_000_000,
    });
    console.log('Upgrading Staking Bank Result', resultRegistry);
  });

/*
npm run interact:devnet upgradeFeeds 6 8 1
npm run interact:mainnet upgradeFeeds 6 8 1
*/
program.command('upgradeFeeds')
  .argument('[requiredSignatures]', 'The number of required signatures', 6)
  .argument('[pricesDecimals]', 'The number of decimals', 8)
  .argument('[shardId]', 'Shard number')
  .action(async (requiredSignatures: number, priceDecimals: number, shardId: number) => {
    const wallet = await loadWallet(shardId);
    const dataJson = readJson<DataJson>(dataJsonFile);
    const address = dataJson.feedsAddress[envChain.name() as ChainName];

    console.log('data.chainId', data.chainId);
    console.log('selected ID:', envChain.select(data.chainId), BigInt(envChain.select(data.chainId)));

    console.log(`Upgrading Umbrella Feeds contract with ${requiredSignatures} required signatures and ${priceDecimals} price decimals ...`);

    const result = await wallet.upgradeContract({
      callee: address,
      code: dataJson.code,
      codeMetadata: ['upgradeable'],
      gasLimit: 100_000_000,
      codeArgs: [
        e.Addr(envChain.select(data.stakingBankAddress)),
        e.U32(BigInt(requiredSignatures)),
        e.U8(BigInt(priceDecimals)),
        e.U32(BigInt(envChain.select(data.chainId))),
      ],
    });
    console.log('Umbrella Feeds Result:', result);
    console.log('RUN `getRequiredSignatures` to confirm all look OK');
  });

program.command('upgrade')
  .argument('[requiredSignatures]', 'The number of required signatures', 2)
  .argument('[pricesDecimals]', 'The number of decimals', 8)
  .argument('[shardId]', 'Shard number')
  .action(async (requiredSignatures: number, priceDecimals: number, shardId: number) => {
    const wallet = await loadWallet(shardId);

    console.log('Upgrading Staking Bank contract...');
    const resultStakingBank = await wallet.upgradeContract({
      callee: envChain.select(data.stakingBankAddress),
      code: envChain.select(data.stakingBankCode),
      codeMetadata: ['upgradeable'],
      gasLimit: 100_000_000,
    });
    console.log('Staking Bank Result', resultStakingBank);

    console.log(`Upgrading Umbrella Feeds contract with ${requiredSignatures} required signatures and ${priceDecimals} price decimals ...`);
    const result = await wallet.upgradeContract({
      callee: envChain.select(data.address),
      code: data.code,
      codeMetadata: ['upgradeable'],
      gasLimit: 100_000_000,
      codeArgs: [
        e.Addr(envChain.select(data.stakingBankAddress)),
        e.U32(BigInt(requiredSignatures)),
        e.U8(BigInt(priceDecimals)),
        e.U32(BigInt(envChain.select(data.chainId))),
      ],
    });
    console.log('Umbrella Feeds Result:', result);

    console.log('Contract successfully upgraded!');
  });

program.command('ClaimDeveloperRewards')
  .argument('[shardId]', 'Shard number')
  .action(async (shardId: number) => {
    const wallet = await loadWallet(shardId);
    const result = await wallet.callContract({
      callee: envChain.select(data.address),
      funcName: 'ClaimDeveloperRewards',
      gasLimit: 10_000_000,
    });
    console.log('Result:', result);
  });

program.command('update')
  .argument('[hearbeat]', 'data', 0)
  .argument('[timestamp]', 'data', 1688998114)
  .argument('[price]', 'data', 1000000000)
  .argument('[shardId]', 'Shard number')
  .action(async (hearbeat: number, timestamp: number, price: number, shardId: number) => {
    const wallet = await loadWallet(shardId);

    const priceData = {
      hearbeat,
      timestamp,
      price: new BigNumber(price, 10),
    };

    const { priceKey, publicKey, signature } = generateSignature(
      envChain.select(data.chainId),
      envChain.select(data.address),
      'ETH-USD',
      priceData,
    );

    const tx = await wallet.callContract({
      callee: envChain.select(data.address),
      gasLimit: 10_000_000,
      funcName: 'update',
      funcArgs: [
        e.U32(1), // Length of the list needed before because of use of MultiValueManagedVecCounted in contract
        e.Bytes(Buffer.from(priceKey, 'hex')),

        e.U32(1),
        e.Tuple(
          e.U32(BigInt(priceData.hearbeat)),
          e.U32(BigInt(priceData.timestamp)),
          e.U(BigInt(priceData.price.toNumber())),
        ),

        e.U32(1),
        e.Tuple(
          e.Addr(publicKey.toAddress().bech32()),
          e.Bytes(signature),
        ),
      ],
    });

    console.log('transaction', tx);
  });

/*
npm run interact:devnet getRequiredSignatures
npm run interact:mainnet getRequiredSignatures
*/
program.command('getRequiredSignatures')
  .action(async () => {
    const proxy = new ProxyNetworkProvider(envChain.publicProxyUrl());

    const contract = new SmartContract({ address: Address.fromBech32(envChain.select(data.feedsAddress)) });

    let query = new Interaction(contract, new ContractFunction('required_signatures'), [])
      .buildQuery();
    let response = await proxy.queryContract(query);
    let parsedResponse = new ResultsParser().parseUntypedQueryResponse(response);

    console.log(
      contract.getAddress().bech32(),
      '.required_signatures:',
      parseInt(parsedResponse.values[0].toString('hex'), 16),
    );

    query = new Interaction(contract, new ContractFunction('chain_id'), []).buildQuery();
    response = await proxy.queryContract(query);
    parsedResponse = new ResultsParser().parseUntypedQueryResponse(response);

    console.log(
      contract.getAddress().bech32(),
      '.chainId:',
      parseInt(parsedResponse.values[0].toString('hex'), 16),
    );
  });

program.command('getPriceDataByName')
  .argument('[name]', 'Name of price to get', 'ETH-USD')
  .action(async (name: string) => {
    const proxy = new ProxyNetworkProvider(envChain.publicProxyUrl());

    const contract = new SmartContract({ address: Address.fromBech32(envChain.select(data.address)) });

    const query = new Interaction(contract, new ContractFunction('getPriceDataByName'), [new StringValue(name)])
      .buildQuery();
    const response = await proxy.queryContract(query);
    const parsedResponse = new ResultsParser().parseUntypedQueryResponse(response);

    const codec = new BinaryCodec();
    const structType = new StructType('PriceData', [
      new FieldDefinition('heartbeat', '', new U32Type()),
      new FieldDefinition('timestamp', '', new U32Type()),
      new FieldDefinition('price', '', new BigUIntType()),
    ]);
    const [decoded] = codec.decodeNested(parsedResponse.values[0], structType);
    const decodedAttributes = decoded.valueOf();

    const contractPriceData = {
      heartbeat: (decodedAttributes.heartbeat as BigNumber).toNumber(),
      timestamp: decodedAttributes.timestamp.toNumber(),
      price: decodedAttributes.price.toNumber(),
    };

    console.log('price data for ETH-USD', contractPriceData);
  });

program.command('getPriceData')
  .argument('[name]', 'Name of price to get', 'ETH-USD')
  .action(async (name: string) => {
    const priceKey = createKeccakHash('keccak256').update(name).digest('hex');

    const { returnData } = await world.query({
      callee: envChain.select(data.address),
      funcName: 'getPriceData',
      funcArgs: [e.Bytes(Buffer.from(priceKey, 'hex'))],
    });

    const contractPriceData = d.Tuple({
      heartbeat: d.U32(),
      timestamp: d.U32(),
      price: d.U(),
    }).topDecode(returnData[0]);

    console.log('price data for ETH-USD', contractPriceData);
  });

async function getAddressByString(name: string): Promise<string> {
  const proxy = new ProxyNetworkProvider(envChain.publicProxyUrl());
  const contract = new SmartContract({ address: Address.fromBech32(envChain.select(data.registryAddress)) });

  const query = new Interaction(contract, new ContractFunction('getAddressByString'), [new StringValue(name)])
    .buildQuery();
  const response = await proxy.queryContract(query);
  const parsedResponse = new ResultsParser().parseUntypedQueryResponse(response);

  return Address.fromBuffer(parsedResponse.values[0]).bech32();
}

/*
npm run interact:mainnet checkRegisteredAddresses
*/
program.command('checkRegisteredAddresses')
  .action(async () => {
    const names = ['StakingBank', 'UmbrellaFeeds'];

    const addresses = await Promise.all(names.map(name => getAddressByString(name)));

    names.forEach((name, i) => {
      console.log(`Registry address for ${name}: ${addresses[i]}`);
    });
  });

/*
npm run interact:mainnet printValidators
*/
program.command('printValidators')
  .action(async () => {
    const proxy = new ProxyNetworkProvider(envChain.publicProxyUrl());
    const contract = new SmartContract({ address: Address.fromBech32(envChain.select(data.stakingBankAddress)) });

    let query = new Interaction(contract, new ContractFunction('getNumberOfValidators'), []).buildQuery();
    let response = await proxy.queryContract(query);
    let responseParsed = new ResultsParser().parseUntypedQueryResponse(response);

    const numberOfValidators = parseInt(responseParsed.values[0].toString('hex'), 16);
    console.log({ numberOfValidators });

    query = new Interaction(contract, new ContractFunction('addresses'), []).buildQuery();
    response = await proxy.queryContract(query);
    // const response = await proxy.queryContract(query);
    responseParsed = new ResultsParser().parseUntypedQueryResponse(response);

    const addresses = responseParsed.values.map((data) => new Address(data).bech32());

    console.log('Registered addresses:');
    console.log(addresses);
  });

program.command('updateSdkCore')
  .argument('[shardId]', 'Shard number')
  .action(async (shardId: number) => {
    const wallet = await loadWallet(shardId);

    const proxy = new ProxyNetworkProvider('https://devnet-gateway.multiversx.com');

    const account = await proxy.getAccount(Address.fromBech32(wallet.toString()));

    const contract = new SmartContract({ address: Address.fromBech32(envChain.select(data.address)) });

    const query = new Interaction(contract, new ContractFunction('getPriceDataByName'), [new StringValue('ETH-USD')])
      .buildQuery();
    const response = await proxy.queryContract(query);
    const parsedResponse = new ResultsParser().parseUntypedQueryResponse(response);

    const codec = new BinaryCodec();
    const structType = new StructType('PriceData', [
      new FieldDefinition('heartbeat', '', new U32Type()),
      new FieldDefinition('timestamp', '', new U32Type()),
      new FieldDefinition('price', '', new BigUIntType()),
    ]);
    const [decoded] = codec.decodeNested(parsedResponse.values[0], structType);
    const decodedAttributes = decoded.valueOf();

    const contractPriceData = {
      hearbeat: decodedAttributes?.hearbeat?.toNumber(),
      timestamp: decodedAttributes?.timestamp?.toNumber(),
      price: decodedAttributes?.price?.toNumber(),
    };

    console.log('price data for ETH-USD', contractPriceData);

    // Try and send update transaction
    const priceData = {
      hearbeat: 0,
      timestamp: 1688998115,
      price: new BigNumber(1000000000, 10),
    };

    const { priceKey, publicKey, signature } = generateSignature(
      envChain.select(data.chainId),
      envChain.select(data.address),
      'ETH-USD',
      priceData,
    );

    const updateInteraction = new Interaction(contract, new ContractFunction('update'), [
      new U32Value(1),
      new BytesValue(Buffer.from(priceKey, 'hex')),

      new U32Value(1),
      Tuple.fromItems([
        new U32Value(priceData.hearbeat),
        new U32Value(priceData.timestamp),
        new BigUIntValue(priceData.price),
      ]),

      new U32Value(1),
      new BytesValue(Buffer.concat([publicKey.valueOf(), signature])),
    ]);

    const transaction: Transaction = updateInteraction
      .withSender(account.address)
      .withNonce(account.nonce)
      .withValue(0)
      .withGasLimit(20_000_000)
      .withChainID('D')
      .buildTransaction();

    const toSign = transaction.serializeForSigning();
    const txSignature = await wallet.sign(toSign);

    transaction.applySignature(Signature.fromBuffer(txSignature));

    console.log('data', transaction.getData().toString());

    const hash = await proxy.sendTransaction(transaction);

    console.log('transaction hash', hash);
  });

program.command('hashData').action(async () => {
  const proxy = new ProxyNetworkProvider('https://devnet-gateway.multiversx.com');

  const contract = new SmartContract({ address: Address.fromBech32(envChain.select(data.address)) });

  const priceKey = 'ETH-USD';
  const priceKeyHash = createKeccakHash('keccak256').update(priceKey).digest('hex');
  const priceData = {
    hearbeat: 0,
    timestamp: 1688998115,
    price: new BigNumber(1000000000, 10),
  };
  const args = [
    List.fromItems([
      new BytesValue(Buffer.from(priceKeyHash, 'hex')),
    ]),
    List.fromItems([
      Tuple.fromItems([
        new U32Value(priceData.hearbeat),
        new U32Value(priceData.timestamp),
        new BigUIntValue(priceData.price),
      ]),
    ]),
  ];

  const query = new Interaction(contract, new ContractFunction('hashData'), args)
    .buildQuery();
  const response = await proxy.queryContract(query);
  const parsedResponse = new ResultsParser().parseUntypedQueryResponse(response);

  const result = parsedResponse.values[0].toString('hex');

  const localDataHash = getDataHash(
    envChain.select(data.chainId),
    envChain.select(data.address),
    priceKeyHash,
    priceData,
  );

  console.log('Hash data:', result);
  console.log('Local hash data:', localDataHash.toString('hex'));
});

/*
npm run interact:sbx ChangeOwnerAddressData --newOwner erd1gzeggan5v58lat67tz5qnf9qgnrpczuzh94rjfxg8m3f0ujezvxqtekfvd
 */
program.command('ChangeOwnerAddressData')
  .argument('newOwner', 'Address of new owner in erd format')
  .action(async (newOwner: string) => {

    console.log('copy it to `Data` field in wallet:');
    console.log(`ChangeOwnerAddress@${Address.fromBech32(newOwner).hex()}`);
    console.log('set 6M gas limit');

  });

/*
npm run interact:devnet registerData --contractAddress erd1qqqqqqqqqqqqqpgqw38twm3g3pgy75k6lwg03s44ghvsh0kz3yjsurxxp7 --contractName Registry

npm run interact:devnet registerData \
--contractAddress erd1qqqqqqqqqqqqqpgq3k6cyjem7ewz9lr72rl6cgclxz0s3vep3yjsr97u0l,erd1qqqqqqqqqqqqqpgqcc0zvxsdmkt08k9hn3t8ug9ue4vfcj7f3yjs6r6ve8 \
--contractName StakingBank,UmbrellaFeeds

*/
program.command('registerData')
  .argument('[contractAddress]', 'comma separated contracts you want to register (erd addresses)', '')
  .argument('[contractName]', 'Names under which it will be registered', '')
  .action(async (addresses: string, names: string) => {

    const contractAddress = addresses.split(',');
    const contractName = names.split(',');

    console.log({ contractName, contractAddress });

    if (contractAddress.length != contractName.length) {
      console.error('ERROR: number of items must match');
      return;
    }

    if (contractAddress.length == 0) {
      console.error('ERROR: empty array');
      return;
    }

    const data = [
      e.U32(contractName.length).toTopHex(),
      ...contractName.map(name => e.Bytes(Buffer.from(name, 'utf-8')).toTopHex()),
      e.U32(contractAddress.length).toTopHex(),
      ...contractAddress.map(addr => e.Addr(addr).toTopHex()),
    ];

    console.log('copy it to `Data` field in wallet:');
    console.log(`importAddresses@${data.join('@')}`);
  });

program.parse(process.argv);
