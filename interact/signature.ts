import BigNumber from 'bignumber.js';
import { Address, BigUIntValue, BinaryCodec, U32Value } from '@multiversx/sdk-core/out';
import fs from 'fs';
import { UserSecretKey } from '@multiversx/sdk-wallet/out';
import createKeccakHash from "keccak";

export const getDataHash = (chainId: number, contractAddr: string, priceKeyHash, priceData: {
  price: BigNumber;
  hearbeat: number;
  timestamp: number
}) => {
  const contractAddress = Address.fromBech32(contractAddr).pubkey();

  const codec = new BinaryCodec();

  const data = Buffer.concat([
    codec.encodeNested(new U32Value(chainId)),
    contractAddress,

    // price_keys
    Buffer.from(priceKeyHash, 'hex'),

    // price_datas
    codec.encodeNested(new U32Value(priceData.hearbeat)),
    codec.encodeNested(new U32Value(priceData.timestamp)),
    codec.encodeTopLevel(new BigUIntValue(priceData.price)),
  ]);

  return createKeccakHash('keccak256').update(data).digest();
}

export const generateSignature = (chainId: number, contractAddr: string, priceKeyRaw: string, priceData: { price: BigNumber; hearbeat: number; timestamp: number }) => {
  console.log('contract addr', contractAddr);

  const priceKeyHash = createKeccakHash('keccak256').update(priceKeyRaw).digest('hex');

  // hash_data
  let dataHash = getDataHash(chainId, contractAddr, priceKeyHash, priceData);

  const file = fs.readFileSync('./alice.pem').toString();
  const privateKey = UserSecretKey.fromPem(file);

  // verify_signature
  const newData = Buffer.concat([
    Buffer.from("\x19MultiversX Signed Message:\n32"),
    Buffer.from(dataHash)
  ]);

  const newDataHash = createKeccakHash('keccak256').update(newData).digest();

  const publicKey = privateKey.generatePublicKey();

  const signature = privateKey.sign(newDataHash);

  return { priceKey: priceKeyHash, publicKey, signature };
}
