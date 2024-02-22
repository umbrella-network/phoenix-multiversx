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
  timeLockAddress = "timeLockAddress",
}

export type DataJson = {
  code: string;
  registryCode: string;
  timeLockCode: string;
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
  timeLockAddress: {
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
