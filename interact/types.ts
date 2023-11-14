export enum ChainName {
  devnet = "devnet",
  testnet = "testnet",
  sbx = "sbx",
  mainnet = "mainnet",
}

export enum ContractName {
  stakingBankAddress = "stakingBankAddress",
  feedsAddress = "feedsAddress",
  registryAddress = "registryAddress",
}

export type DataJson = {
  code: string;
  registryCode: string;
  stakingBankCode: {
    devnet: string;
    testnet: string;
    mainnet: string;
    sbx: string;
  },
  abi: string;
  stakingBankAddress: {
    devnet: string;
    testnet: string;
    mainnet: string;
    sbx: string;
  },
  feedsAddress: {
    devnet: string;
    testnet: string;
    mainnet: string;
    sbx: string;
  },
  registryAddress: {
    devnet: string;
    testnet: string;
    mainnet: string;
    sbx: string;
  },
  chainId: {
    devnet: number;
    testnet: number;
    mainnet: number;
    sbx: number;
  }
}
