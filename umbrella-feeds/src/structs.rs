multiversx_sc::imports!();
multiversx_sc::derive_imports!();

use multiversx_sc::api::ED25519_SIGNATURE_BYTE_LEN;

#[derive(TypeAbi, TopEncode, TopDecode, NestedEncode, NestedDecode, ManagedVecItem, Debug)]
pub struct PriceData<M: ManagedTypeApi> {
    pub heartbeat: u32,
    pub timestamp: u32,
    pub price: BigUint<M>,
}

#[derive(TypeAbi, TopEncode, TopDecode, NestedEncode, NestedDecode, ManagedVecItem, Debug)]
pub struct Signature<M: ManagedTypeApi> {
    pub address: ManagedAddress<M>,
    pub signature: ManagedByteArray<M, ED25519_SIGNATURE_BYTE_LEN>,
}
