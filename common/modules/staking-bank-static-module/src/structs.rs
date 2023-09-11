multiversx_sc::imports!();
multiversx_sc::derive_imports!();

#[derive(TypeAbi, TopEncode, TopDecode, Debug)]
pub struct Validator<M: ManagedTypeApi> {
    pub id: ManagedAddress<M>,
    pub location: ManagedBuffer<M>,
}
