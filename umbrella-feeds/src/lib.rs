#![no_std]

multiversx_sc::imports!();

use crate::structs::{PriceData, Signature};
use multiversx_sc::api::KECCAK256_RESULT_LEN;

pub mod proxy;
pub mod structs;

const MULTIVERSX_PREFIX: &[u8; 30] = b"\x19MultiversX Signed Message:\n32";

#[multiversx_sc::contract]
pub trait UmbrellaFeeds: proxy::ProxyModule {
    #[init]
    fn init(&self, staking_bank: ManagedAddress, required_signatures: usize, decimals: u8, chain_id: u32) {
        require!(required_signatures > 0, "Invalid required signatures");

        self.staking_bank().set(staking_bank);
        self.required_signatures().set(required_signatures);
        self.decimals().set(decimals);
        self.chain_id().set(chain_id);
    }

    #[endpoint]
    fn update(
        &self,
        price_keys: MultiValueManagedVecCounted<ManagedBuffer>,
        price_datas: MultiValueManagedVecCounted<PriceData<Self::Api>>,
        signatures: MultiValueManagedVecCounted<Signature<Self::Api>>,
    ) {
        // below check is only for pretty errors, so we can safe gas and allow for raw revert
        // require!(price_keys.len() == price_datas.len(), "Arrays data do not match");

        let price_keys_vec = price_keys.into_vec();
        let price_datas_vec = price_datas.into_vec();

        let price_data_hash = self.hash_data(&price_keys_vec, &price_datas_vec);

        self.verify_signatures(&price_data_hash, signatures);

        for index in 0..price_datas_vec.len() {
            let price_data: PriceData<Self::Api> = price_datas_vec.get(index);

            let old_price_mapper = self.prices(&price_keys_vec.get(index));

            if !old_price_mapper.is_empty() {
                let old_price: PriceData<Self::Api> = old_price_mapper.get();

                // we do not allow for older prices
                // at the same time it prevents from reusing signatures
                require!(price_data.timestamp > old_price.timestamp, "Old data");
            }

            old_price_mapper.set(price_data);
        }
    }

    #[view(getManyPriceData)]
    fn get_many_price_data(
        &self,
        keys: MultiValueEncoded<ManagedBuffer>,
    ) -> MultiValueEncoded<PriceData<Self::Api>> {
        let mut data = MultiValueEncoded::new();

        for key in keys.into_iter() {
            let price_data = self.require_and_get_price_data(&key);

            data.push(price_data);
        }

        data
    }

    #[view(getManyPriceDataRaw)]
    fn get_many_price_data_raw(
        &self,
        keys: MultiValueEncoded<ManagedBuffer>,
    ) -> MultiValueEncoded<PriceData<Self::Api>> {
        let mut data = MultiValueEncoded::new();

        for key in keys.into_iter() {
            let prices_mapper = self.prices(&key);

            if !prices_mapper.is_empty() {
                data.push(prices_mapper.get());
            } else {
                data.push(PriceData {
                    heartbeat: 0,
                    timestamp: 0,
                    price: BigUint::zero(),
                })
            }
        }

        data
    }

    #[view(getPriceData)]
    fn get_price_data(&self, key: ManagedBuffer) -> PriceData<Self::Api> {
        self.require_and_get_price_data(&key)
    }

    #[view(getPrice)]
    fn get_price(&self, key: ManagedBuffer) -> BigUint {
        let price_data = self.require_and_get_price_data(&key);

        price_data.price
    }

    #[view(getPriceTimestamp)]
    fn get_price_timestamp(&self, key: ManagedBuffer) -> MultiValue2<BigUint, u32> {
        let price_data = self.require_and_get_price_data(&key);

        MultiValue2::from((price_data.price, price_data.timestamp))
    }

    #[view(getPriceTimestampHeartbeat)]
    fn get_price_timestamp_heartbeat(&self, key: ManagedBuffer) -> MultiValue3<BigUint, u32, u32> {
        let price_data = self.require_and_get_price_data(&key);

        MultiValue3::from((price_data.price, price_data.timestamp, price_data.heartbeat))
    }

    #[view(getPriceDataByName)]
    fn get_price_data_by_name(&self, name: ManagedBuffer) -> PriceData<Self::Api> {
        let key = self.crypto().keccak256(name);

        let prices_mapper = self.prices(key.as_managed_buffer());

        if prices_mapper.is_empty() {
            return PriceData {
                heartbeat: 0,
                timestamp: 0,
                price: BigUint::zero(),
            }
        }

        prices_mapper.get()
    }

    #[view(hashData)]
    fn hash_data(
        &self,
        price_keys: &ManagedVec<ManagedBuffer>,
        price_datas: &ManagedVec<PriceData<Self::Api>>,
    ) -> ManagedByteArray<KECCAK256_RESULT_LEN> {
        let mut data = ManagedBuffer::new();

        let chain_id = self.chain_id().get();

        let _ = chain_id.dep_encode(&mut data);
        data.append(self.blockchain().get_sc_address().as_managed_buffer());

        for price_key in price_keys.iter() {
            data.append(&price_key);
        }

        for price_data in price_datas.iter() {
            let _ = price_data.heartbeat.dep_encode(&mut data);
            let _ = price_data.timestamp.dep_encode(&mut data);
            data.append(&price_data.price.to_bytes_be_buffer());
        }

        self.crypto().keccak256(data)
    }

    #[view(verifySignatures)]
    fn verify_signatures(
        &self,
        initial_hash: &ManagedByteArray<KECCAK256_RESULT_LEN>,
        signatures: MultiValueManagedVecCounted<Signature<Self::Api>>,
    ) {
        let required_signatures = self.required_signatures().get();

        require!(
            signatures.len() >= required_signatures,
            "Not enough signatures"
        );

        let mut validators = ManagedVec::<Self::Api, ManagedAddress>::new();

        let signatures_vec = signatures.into_vec();

        let mut data = ManagedBuffer::new();

        data.append(&ManagedBuffer::from(MULTIVERSX_PREFIX));
        data.append(initial_hash.as_managed_buffer());

        let hash = self.crypto().keccak256(data);

        for index in 0..required_signatures {
            let raw_signature: Signature<Self::Api> = signatures_vec.get(index);

            self.verify_signature(&hash, &raw_signature);

            require!(validators.find(&raw_signature.address).is_none(), "Signatures out of order");

            validators.push(raw_signature.address);
        }

        require!(self.verify_validators(MultiValueEncoded::from(validators)), "Invalid signer");
    }

    fn verify_signature(
        &self,
        hash: &ManagedByteArray<KECCAK256_RESULT_LEN>,
        raw_signature: &Signature<Self::Api>,
    ) {
        require!(
            self.crypto().verify_ed25519(
                raw_signature.address.as_managed_buffer(),
                hash.as_managed_buffer(),
                raw_signature.signature.as_managed_buffer(),
            ),
            "Invalid signature"
        );
    }

    fn require_and_get_price_data(&self, key: &ManagedBuffer) -> PriceData<Self::Api> {
        let prices_mapper = self.prices(key);

        require!(!prices_mapper.is_empty(), "Feed not exist");

        prices_mapper.get()
    }

    // map of all prices stored in this contract, key for map is hash of feed name
    // eg for "ETH-USD" feed, key will be keccak256("ETH-USD")
    #[view]
    #[storage_mapper("prices")]
    fn prices(&self, key: &ManagedBuffer) -> SingleValueMapper<PriceData<Self::Api>>;

    #[view]
    #[storage_mapper("required_signatures")]
    fn required_signatures(&self) -> SingleValueMapper<usize>;

    #[view]
    #[storage_mapper("decimals")]
    fn decimals(&self) -> SingleValueMapper<u8>;

    #[view]
    #[storage_mapper("chain_id")]
    fn chain_id(&self) -> SingleValueMapper<u32>;
}
