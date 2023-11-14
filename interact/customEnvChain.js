"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.envChain = void 0;
exports.envChain = {
  name: () => {
    const chain = process.env.CHAIN;
    if (!chain) {
      throw new Error("CHAIN environment variable is not set.");
    }
    if (isChainName(chain)) {
      return chain;
    }
    throw new Error("CHAIN environment variable value is invalid.");
  },
  select: (values) => {
    const value = values[exports.envChain.name()];
    if (value === undefined) {
      throw new Error("No value for CHAIN environment variable.");
    }
    return value;
  },
  id: () => exports.envChain.select({ devnet: "D", testnet: "T", mainnet: "1", sbx: "D" }),
  publicProxyUrl: () => exports.envChain.select({
    devnet: "https://devnet-gateway.multiversx.com",
    testnet: "https://testnet-gateway.multiversx.com",
    mainnet: "https://gateway.multiversx.com",
    sbx: "https://devnet-gateway.multiversx.com",
  }),
};
const isChainName = (chain) => {
  return chainNames.includes(chain);
};
const chainNames = ["devnet", "testnet", "mainnet", "sbx"];
