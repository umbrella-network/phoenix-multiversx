multiversx_sc::imports!();

pub mod staking_bank_proxy {
    multiversx_sc::imports!();

    #[multiversx_sc::proxy]
    pub trait StakingBankProxy {
        #[view(verifyValidators)]
        fn verify_validators(&self, validators: MultiValueEncoded<ManagedAddress>) -> bool;
    }
}

#[multiversx_sc::module]
pub trait ProxyModule {
    fn verify_validators(&self, validators: MultiValueEncoded<ManagedAddress>) -> bool {
        self.staking_bank_proxy(self.staking_bank().get())
            .verify_validators(validators)
            .execute_on_dest_context()
    }

    #[view]
    #[storage_mapper("staking_bank")]
    fn staking_bank(&self) -> SingleValueMapper<ManagedAddress>;

    #[proxy]
    fn staking_bank_proxy(&self, address: ManagedAddress) -> staking_bank_proxy::Proxy<Self::Api>;
}
