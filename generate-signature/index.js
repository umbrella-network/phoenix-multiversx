import { UserSecretKey } from '@multiversx/sdk-wallet';
import * as fs from 'fs';
import createKeccakHash from "keccak";
import { Address } from "@multiversx/sdk-core"
import BigNumber from "bignumber.js";
import { BigUIntValue, BinaryCodec, U32Value } from "@multiversx/sdk-core"


// Contains signature generation code for update_valid_signature test

const file = fs.readFileSync('./alice.pem').toString();
const privateKey = UserSecretKey.fromPem(file);

const priceKey = createKeccakHash('keccak256').update('ETH-USD').digest('hex');

console.log('ETH-USD price key hex', priceKey);

const priceData = {
  hearbeat: 0,
  timestamp: 1688998114,
  price: new BigNumber(1000000000, 10), // 10 with 8 decimals
};

// contract address: H256([0, 0, 0, 0, 0, 0, 0, 0, 251, 19, 151, 232, 34, 94, 168, 94, 15, 14, 110, 140, 123, 18, 109, 0, 22, 204, 189, 224, 230, 103, 21, 30])
const contractAddress = Address.fromBuffer(Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 251, 19, 151, 232, 34, 94, 168, 94, 15, 14, 110, 140, 123, 18, 109, 0, 22, 204, 189, 224, 230, 103, 21, 30])).pubkey();

console.log('contract address', contractAddress);

const codec = new BinaryCodec();

// get_price_data_hash
let data = Buffer.concat([
  contractAddress,

  // price_keys
  Buffer.from(priceKey, 'hex'),

  // price_datas
  codec.encodeNested(new U32Value(priceData.hearbeat)),
  codec.encodeNested(new U32Value(priceData.timestamp)),
  codec.encodeTopLevel(new BigUIntValue(priceData.price)),
]);

console.log('data to be signed', data);

const dataHash = createKeccakHash('keccak256').update(data).digest();

console.log('price_data_hash to be signed', dataHash.toString());

// verify_signature
const newData = Buffer.concat([
  Buffer.from("\x19MultiversX Signed Message:\n32"),
  Buffer.from(dataHash)
]);

console.log('new data', newData);

const newDataHash = createKeccakHash('keccak256').update(newData).digest();

console.log('verify signature hash new data', newDataHash.toString());

const signature = privateKey.sign(newDataHash);

console.log('signature hex', signature.toString('hex'));

const publicKey = privateKey.generatePublicKey();
const verifySignature = publicKey.verify(newDataHash, signature);

console.log('verify signature', verifySignature);
