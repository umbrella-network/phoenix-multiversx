#![no_std]

multiversx_sc::imports!();

#[multiversx_sc::contract]
pub trait Registry {
    #[init]
    fn init(&self) {}

    #[only_owner]
    #[endpoint(importAddresses)]
    fn import_addresses(
        &self,
        names: MultiValueManagedVecCounted<ManagedBuffer>,
        destinations: MultiValueManagedVecCounted<ManagedAddress>,
    ) {
        require!(
            names.len() == destinations.len(),
            "Arrays data do not match"
        );

        let names_vec = names.into_vec();
        let destinations_vec = destinations.into_vec();

        for index in 0..names_vec.len() {
            let name = names_vec.get(index);
            let address = destinations_vec.get(index);

            self.log_registered_event(&name, &address);

            self.registry(&name).set(address);
        }
    }

    #[view(requireAndGetAddress)]
    fn require_and_get_address(&self, name: &ManagedBuffer) -> ManagedAddress {
        let registry_mapper = self.registry(name);

        require!(!registry_mapper.is_empty(), "Name not registered");

        registry_mapper.get()
    }

    #[view(getAddressByString)]
    fn get_address_by_string(&self, name: &ManagedBuffer) -> ManagedAddress {
        self.registry(name).get()
    }

    #[view(getAddress)]
    #[storage_mapper("registry")]
    fn registry(&self, name: &ManagedBuffer) -> SingleValueMapper<ManagedAddress>;

    #[event("log_registered_event")]
    fn log_registered_event(&self, #[indexed] name: &ManagedBuffer, address: &ManagedAddress);
}
