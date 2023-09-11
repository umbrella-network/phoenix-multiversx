multiversx_sc::imports!();

#[multiversx_sc::module]
pub trait StakingBankStaticEventsModule {
    #[event("validator_registered_event")]
    fn validator_registered_event(&self, #[indexed] id: &ManagedAddress);

    #[event("validator_removed_event")]
    fn validator_removed_event(&self, #[indexed] id: &ManagedAddress);

    #[event("validator_updated_event")]
    fn validator_updated_event(&self, #[indexed] id: &ManagedAddress);
}
