import { Command } from "commander";
import { World } from "xsuite/world";
// @ts-ignore
import data from "./data.json";
import { d, e } from "xsuite/data"
import { Address, ResultsParser, SmartContract } from "@multiversx/sdk-core";
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
  Interaction, List,
  StringValue,
  StructType,
  Transaction,
  Tuple,
  U32Type,
  U32Value
} from '@multiversx/sdk-core/out';
import { Signature } from '@multiversx/sdk-core/out/signature';
import createKeccakHash from "keccak";

import { envChain } from "./customEnvChain.js";

const UMBRELLA_FEEDS_NAME = "UmbrellaFeeds";
const STAKING_BANK_NAME = "StakingBank";

const world = World.new({
  proxyUrl: envChain.publicProxyUrl(),
  chainId: envChain.id(),
  gasPrice: 1000000000,
});

export const loadWallet = () => world.newWalletFromFile("wallet.json");

const program = new Command();

program.command("deploy")
  .argument('[requiredSignatures]', 'The number of required signatures', 2)
  .argument('[pricesDecimals]', 'The number of decimals', 8)
  .action(async (requiredSignatures: number, priceDecimals: number) => {
    const wallet = await loadWallet();

    console.log('Deploying Staking Bank contract...');
    const resultStakingBank = await wallet.deployContract({
      code: envChain.select(data.stakingBankCode),
      codeMetadata: ["upgradeable"],
      gasLimit: 100_000_000,
    });
    console.log('Staking Bank Result', resultStakingBank);

    console.log(`Deploying Umbrella Feeds contract with ${ requiredSignatures } required signatures and ${ priceDecimals } price decimals ...`);
    const result = await wallet.deployContract({
      code: data.code,
      codeMetadata: ["upgradeable"],
      gasLimit: 100_000_000,
      codeArgs: [
        e.Addr(resultStakingBank.address),
        e.U32(BigInt(requiredSignatures)),
        e.U8(BigInt(priceDecimals))
      ]
    });
    console.log("Umbrella Feeds Result:", result);

    console.log('Deploying Registry contract...');
    const resultRegistry = await wallet.deployContract({
      code: data.registryCode,
      codeMetadata: ["upgradeable"],
      gasLimit: 100_000_000,
    });
    console.log('Registry Result', resultRegistry);

    console.log('Adding UmbrellaFeeds & StakingBank addresses to Registry...');
    const txResult = await wallet.callContract({
      callee: resultRegistry.address,
      gasLimit: 10_000_000,
      funcName: "importAddresses",
      funcArgs: [
        e.U32(2),
        e.Bytes(Buffer.from(STAKING_BANK_NAME, 'utf-8')),
        e.Bytes(Buffer.from(UMBRELLA_FEEDS_NAME, 'utf-8')),

        e.U32(2),
        e.Addr(resultStakingBank.address),
        e.Addr(result.address),
      ]
    });
    console.log('Adding addresses to Registry Result', txResult);

    console.log('Staking Bank Address:', resultStakingBank.address);
    console.log('Umbrella Feeds Address:', result.address);
    console.log('Registry Address', resultRegistry.address);
  });

program.command("upgrade")
  .argument('[requiredSignatures]', 'The number of required signatures', 2)
  .argument('[pricesDecimals]', 'The number of decimals', 8)
  .action(async (requiredSignatures: number, priceDecimals: number) => {
    const wallet = await loadWallet();

    console.log('Upgrading Staking Bank contract...');
    const resultStakingBank = await wallet.upgradeContract({
      callee: envChain.select(data.stakingBankAddress),
      code: envChain.select(data.stakingBankCode),
      codeMetadata: ["upgradeable"],
      gasLimit: 100_000_000,
    });
    console.log('Staking Bank Result', resultStakingBank);

    console.log(`Upgrading Umbrella Feeds contract with ${ requiredSignatures } required signatures and ${ priceDecimals } price decimals ...`);
    const result = await wallet.upgradeContract({
      callee: envChain.select(data.address),
      code: data.code,
      codeMetadata: ["upgradeable"],
      gasLimit: 100_000_000,
      codeArgs: [
        e.Addr(envChain.select(data.stakingBankAddress)),
        e.U32(BigInt(requiredSignatures)),
        e.U8(BigInt(priceDecimals))
      ],
    });
    console.log("Umbrella Feeds Result:", result);

    console.log('Contract successfully upgraded!');
});

program.command("ClaimDeveloperRewards").action(async () => {
  const wallet = await loadWallet();
  const result = await wallet.callContract({
    callee: envChain.select(data.address),
    funcName: "ClaimDeveloperRewards",
    gasLimit: 10_000_000,
  });
  console.log("Result:", result);
});

program.command("update")
  .argument('[hearbeat]', 'data', 0)
  .argument('[timestamp]', 'data', 1688998114)
  .argument('[price]', 'data', 1000000000)
  .action(async (hearbeat: number, timestamp: number, price: number) => {
    const wallet = await loadWallet();

    const priceData = {
      hearbeat,
      timestamp,
      price: new BigNumber(price, 10),
    };

    const { priceKey, publicKey, signature } = generateSignature(envChain.select(data.address), 'ETH-USD', priceData);

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


program.command("getPriceDataByName")
  .argument('[name]', 'Name of price to get', 'ETH-USD')
  .action(async (name: string) => {
    const proxy = new ProxyNetworkProvider('https://devnet-gateway.multiversx.com');

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
    }

    console.log('price data for ETH-USD', contractPriceData);
  });


program.command("getPriceData")
  .argument('[name]', 'Name of price to get', 'ETH-USD')
  .action(async (name: string) => {
    const priceKey = createKeccakHash('keccak256').update(name).digest('hex');

    const { returnData } = await world.query({
      callee: envChain.select(data.address),
      funcName: "getPriceData",
      funcArgs: [e.Bytes(Buffer.from(priceKey, 'hex'))],
    });

    const contractPriceData = d.Tuple({
      heartbeat: d.U32(),
      timestamp: d.U32(),
      price: d.U(),
    }).topDecode(returnData[0]);

    console.log('price data for ETH-USD', contractPriceData);
  });


program.command("getRegistryAddressByName")
  .argument('name', 'Name of the address to get')
  .action(async (name: string) => {
    const proxy = new ProxyNetworkProvider('https://devnet-gateway.multiversx.com');

    const contract = new SmartContract({ address: Address.fromBech32(envChain.select(data.registryAddress)) });

    const query = new Interaction(contract, new ContractFunction('getAddressByString'), [new StringValue(name)])
      .buildQuery();
    const response = await proxy.queryContract(query);
    const parsedResponse = new ResultsParser().parseUntypedQueryResponse(response);

    console.log(`Registry address for ${ name }`, Address.fromBuffer(parsedResponse.values[0]).bech32());
  });

program.command("updateSdkCore").action(async () => {
  const wallet = await loadWallet();

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
  }

  console.log('price data for ETH-USD', contractPriceData);

  // Try and send update transaction
  const priceData = {
    hearbeat: 0,
    timestamp: 1688998115,
    price: new BigNumber(1000000000, 10),
  };

  const { priceKey, publicKey, signature } = generateSignature(envChain.select(data.address), 'ETH-USD', priceData);

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
    new BytesValue(Buffer.concat([publicKey.valueOf(), signature]))
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

  console.log('data', transaction.getData().toString('hex'));

  const hash = await proxy.sendTransaction(transaction);

  console.log('transaction hash', hash);
});

program.command("hashData").action(async () => {
  const proxy = new ProxyNetworkProvider('https://devnet-gateway.multiversx.com');

  const contract = new SmartContract({ address: Address.fromBech32(envChain.select(data.address)) });

  const priceKey = 'ETH-USD';
  const priceKeyHash = createKeccakHash('keccak256').update(priceKey).digest('hex')
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
    ])
  ]

  const query = new Interaction(contract, new ContractFunction('hashData'), args)
    .buildQuery();
  const response = await proxy.queryContract(query);
  const parsedResponse = new ResultsParser().parseUntypedQueryResponse(response);

  const result = parsedResponse.values[0].toString('hex');

  const localDataHash = getDataHash(envChain.select(data.address), priceKeyHash, priceData);

  console.log('Hash data:', result);
  console.log('Local hash data:', localDataHash.toString('hex'));
});

program.parse(process.argv);
