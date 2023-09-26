#![no_std]

multiversx_sc::imports!();

use crate::structs::Validator;

pub mod structs;
pub mod events;

#[multiversx_sc::module]
pub trait StakingBankStaticModule: events::StakingBankStaticEventsModule {
    fn create(&self, id: ManagedAddress, location: ManagedBuffer) {
        require!(self.validators(&id).is_empty(), "Validator already exists");

        self.addresses().push(&id);

        self.validator_registered_event(&id);

        self.validators(&id).set(Validator {
            id,
            location,
        });
    }

    fn remove(&self, id: ManagedAddress) {
        require!(!self.validators(&id).is_empty(), "Validator not exists");

        self.validators(&id).clear();

        self.validator_removed_event(&id);

        for index in 1..=self.addresses().len() {
            if self.addresses().get(index) == id {
                self.addresses().swap_remove(index);
                break;
            }
        }
    }

    fn update(&self, id: ManagedAddress, location: ManagedBuffer) {
        require!(!self.validators(&id).is_empty(), "Validator not exists");

        self.validators(&id).update(|validator| validator.location = location);

        self.validator_updated_event(&id);
    }

    fn remove_all(&self) {
        for id in self.addresses().iter() {
            self.validators(&id).clear();

            self.validator_removed_event(&id);
        }

        self.addresses().clear();
    }

    #[view(getNumberOfValidators)]
    fn get_number_of_validators(&self) -> usize {
        self.addresses().len()
    }

    #[view(isValidator)]
    fn is_validator(&self, id: ManagedAddress) -> bool {
        !self.validators(&id).is_empty()
    }

    #[view(verifyValidators)]
    fn verify_validators(&self, validators: MultiValueEncoded<ManagedAddress>) -> bool {
        if validators.is_empty() {
            return false;
        }

        for id in validators.into_iter() {
            if !self.is_validator(id) {
                return false;
            }
        }

        true
    }

    #[view]
    #[storage_mapper("validators")]
    fn validators(&self, address: &ManagedAddress) -> SingleValueMapper<Validator<Self::Api>>;

    #[view]
    #[storage_mapper("addresses")]
    fn addresses(&self) -> VecMapper<ManagedAddress>;
}
