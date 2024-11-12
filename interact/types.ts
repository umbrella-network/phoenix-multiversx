export enum ChainName {
  devnet = "devnet",
  testnet = "testnet",
  sbx = "sbx",
  alpha = "alpha",
  mainnet = "mainnet",
}

export enum ContractName {
  stakingBankAddress = "stakingBankAddress",
  feedsAddress = "feedsAddress",
  registryAddress = "registryAddress",
  timeLockAddress = "timeLockAddress",
}

export type DataJson = {
  feedCode: {
    devnet: string;
    testnet: string;
    alpha: string;
    mainnet: string;
    sbx: string;
  },
  registryCode: {
    devnet: string;
    testnet: string;
    alpha: string;
    mainnet: string;
    sbx: string;
  },
  timeLockCode: {
    devnet: string;
    testnet: string;
    alpha: string;
    mainnet: string;
    sbx: string;
  },
  stakingBankCode: {
    devnet: string;
    testnet: string;
    alpha: string;
    mainnet: string;
    sbx: string;
  },
  abi: string;
  stakingBankAddress: {
    devnet: string;
    testnet: string;
    alpha: string;
    mainnet: string;
    sbx: string;
  },
  feedsAddress: {
    devnet: string;
    testnet: string;
    alpha: string;
    mainnet: string;
    sbx: string;
  },
  registryAddress: {
    devnet: string;
    testnet: string;
    alpha: string;
    mainnet: string;
    sbx: string;
  },
  timeLockAddress: {
    devnet: string;
    testnet: string;
    alpha: string;
    mainnet: string;
    sbx: string;
  },
  chainId: {
    devnet: number;
    testnet: number;
    alpha: number;
    mainnet: number;
    sbx: number;
  }
}
