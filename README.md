# Umbrella Network MultiversX Contracts

## Init

Need to have `mxpy` installed!

https://docs.multiversx.com/sdk-and-tools/sdk-py/installing-mxpy

### Wallet creation

```shell
mxpy wallet new
mxpy wallet convert --in-format=raw-mnemonic --out-format=pem --outfile=./validator.pem
> <mnemonics><enter>
> <ctrl+D>
```

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

First, you need to build the appropriate contracts. You can run `npm run build:all` to build all of them. Then they can be deployed.

`npm run interact:devnet deploy [requiredSignatures] [pricesDecimals]` - this will deploy the StakingBankStaticLocal, UmbrellaFeeds and Registry (on devnet).
The `requiredSignatures` number (default 2) and `pricesDecimals` number (default 8) can optionally be specified

`npm run interact:testnet deploy [requiredSignatures] [pricesDecimals]`

`npm run interact:mainnet deploy [requiredSignatures] [pricesDecimals]`

`npm run interact:sbx deploy [requiredSignatures] [pricesDecimals]`

**After deploy make sure to add the contract addresses to the appropriate place in the `interact/data.json` file so further interact commands work properly!**

After the `interact/data.json` file is updated, and after you upgrade any code, you can easily upgrade the contracts with:

`npm run interact:devnet upgrade [requiredSignatures] [pricesDecimals]` - this will upgrade both the StakingBankStaticLocal and UmbrellaFeeds contracts (on devnet).
The `requiredSignatures` number (default 2) and `pricesDecimals` number (default 8) can optionally be specified
