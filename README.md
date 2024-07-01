# Umbrella Network MultiversX Contracts

## Init

Need to have `mxpy` installed!

https://docs.multiversx.com/sdk-and-tools/sdk-py/installing-mxpy

If CI starts to fail because of build - update `mxpy` and rebuild all locally.

### Wallet creation

```shell
mxpy wallet new
mxpy wallet convert --in-format=raw-mnemonic --out-format=pem --outfile=./wallets/deployer.dev.shard1.pem
mxpy wallet convert --in-format=raw-mnemonic --out-format=keystore-mnemonic --outfile=./wallets/deployer.dev.shard1.json
> <mnemonics><enter>
> <ctrl+D>
```

Create json with keystore, use:  `--out-format=keystore-mnemonic`

## Build


`npm run build` - builds Registry, StakingBankStaticLocal and UmbrellaFeeds

Feeds:
`npm run build:feeds`

Registry: `npm run build:registry`

Staking Bank:
`npm run build:bank:static:local`
`npm run build:bank:static:dev`
`npm run build:bank:static:prod`
`npm run build:bank:static:sbx`

`npm run build:all` - builds ALL the contracts from above

## Test

`npm run test`

`npm run test:all`

## Interactions

For running interactions you need to have a `wallet.json` file inside this repository. You can create one with

`xsuite new-wallet --wallet wallet.json`

Then use the appropriate command to interact with the contract on the appropriate network

`npm run interact:devnet [command]`

`npm run interact:testnet [command]`

`npm run interact:mainnet [command]`

`npm run interact:sbx [command]`

To list available commands run:

`npm run interact:devnet help`

## Deploy & Upgrade

### Reproducible builds

- open PR (or create release) to generate builds, zip file will be attached to github Action or release
- download generated files and unzip to `build-output`
- run deploy command (testnet commands run on local builds files, other runs on downloaded onces)
  eg `npm run interact:sbx deployTimeLock [timeLockPeriod] [multisigAddress] [shardId]`
  `npm run interact:sbx deployTimeLock 60 erd1qqqqqqqqqqqqqpgqz7cxfe807gw5ssagysejcgtvqu9xwflfdzequhzc5t 1`
  `npm run interact:devnet deployTimeLock 120 erd1zkdzcqynqks6hyve6538cace9lwepn2rlh9k3ejcw3whwgkzr0vsv0pn7j 1`
- verify contract
```
mxpy --verbose contract verify "erd1qqqqqqqqqqqqqpgq9lulgyaa3p46yn8kavk2j53pe44zug3ven6se8322m" \
--packaged-src=./build-output/time-lock/time-lock-0.0.0.source.json \
--verifier-url="https://devnet-play-api.multiversx.com" --docker-image="multiversx/sdk-rust-contract-builder:v2.3.5"  \
--pem=./wallets/sbx/deployer.sbx.shard1.pem

mxpy --verbose contract verify "erd1qqqqqqqqqqqqqpgqxdxe5d9aldkgja2azsy8sgfpsthuyt5nr0vs0axeur" \
--packaged-src=./build-output/registry/registry-0.0.0.source.json \
--verifier-url="https://devnet-play-api.multiversx.com" --docker-image="multiversx/sdk-rust-contract-builder:v2.3.5"  \
--pem=./wallets/sbx/deployer.sbx.shard1.pem
```

```
mxpy --verbose contract verify "erd1qqqqqqqqqqqqqpgq9lulgyaa3p46yn8kavk2j53pe44zug3ven6se8322m" \
--packaged-src=./build-output/time-lock/time-lock-0.0.0.source.json \
--verifier-url="https://play-api.multiversx.com" --docker-image="multiversx/sdk-rust-contract-builder:v2.3.5"  \
--pem=./wallets/sbx/deployer.sbx.shard1.pem
```

### Development build & deploy


First, you need to build the appropriate contracts. You can run `npm run build:all` to build all of them. Then they can be deployed.


`npm run interact:devnet deploy [requiredSignatures] [pricesDecimals] [shardId]` - this will deploy the StakingBankStaticLocal, UmbrellaFeeds and Registry (on devnet).
The `requiredSignatures` number (default 2) and `pricesDecimals` number (default 8) can optionally be specified

`npm run interact:testnet deploy [requiredSignatures] [pricesDecimals] [shardId]`

`npm run interact:mainnet deploy [requiredSignatures] [pricesDecimals] [shardId]`

`npm run interact:sbx deploy [requiredSignatures] [pricesDecimals] [shardId]`

**After deploy make sure to add the contract addresses to the appropriate place in the `interact/data.json` file so further interact commands work properly!**

After the `interact/data.json` file is updated, and after you upgrade any code, you can easily upgrade the contracts with:

`npm run interact:devnet upgrade [requiredSignatures] [pricesDecimals]` - this will upgrade both the StakingBankStaticLocal and UmbrellaFeeds contracts (on devnet).
The `requiredSignatures` number (default 2) and `pricesDecimals` number (default 8) can optionally be specified

## Tools

### Add validator address

In there are sections for addresses:

```shell
self.create(
    ManagedAddress::from(hex!("0139472eff6886771a982f3083da5d421f24c29181e63888228dc81ca60d69e1")),
    ManagedBuffer::from(b"localhost")
);
```

- generate hex by:
  - running `ChangeOwnerAddressData` command 
  - or use `mxpy wallet convert --in-format=raw-mnemonic --out-format=address-hex`
- set valid URL for validator

```shell
npm run build:bank:static:prod
npm run interact:mainnet upgradeBank 1
npm run interact:mainnet printValidators
```


## Timelock interaction

1. create (propose) tx on timelock - this can be done by multisig
2. once all signers sign tx on multisig, tx can be proposed to timelock 
3. once time period for tx pass, tx can be executed

## DEV

```shell
npm run interact:devnet timelockPrintState
```

check current owner address
```shell
npm run interact:devnet owners registryAddress
```

change registry owner to multisig
```shell
npm run interact:devnet changeOwner registryAddress multisigAddress 1
npm run interact:devnet owners registryAddress
```

propose tx for multisig to import address, and remove

1. generate proposal
2. open multisig and create tx:
   3. send to: timelock address
   4. 0 tokens to send
   5. data - data generated by script

```shell
npm run interact:devnet timelockImportAddresses 1 newTestContract erd1zkdzcqynqks6hyve6538cace9lwepn2rlh9k3ejcw3whwgkzr0vsv0pn7j TRUE
npm run interact:devnet checkRegisteredAddresses newTestContract
npm run interact:devnet timelockPendingCalls 
```

change dev registry owner back to my wallet
```shell
npm run interact:devnet timelockChangeOwner registryAddress erd1zkdzcqynqks6hyve6538cace9lwepn2rlh9k3ejcw3whwgkzr0vsv0pn7j 1
npm run interact:devnet timelockPendingCalls 

# changing owner uses ~11M gas
npm run interact:devnet performNextCall 1 11
```
