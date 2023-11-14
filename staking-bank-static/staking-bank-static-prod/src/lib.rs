#![no_std]

multiversx_sc::imports!();

use multiversx_sc::hex_literal::hex;

#[multiversx_sc::contract]
pub trait StakingBank:
    staking_bank_static_module::StakingBankStaticModule + staking_bank_static_module::events::StakingBankStaticEventsModule
{
    #[init]
    fn init(&self) {
        self.remove_all();

        self.create(
            ManagedAddress::from(hex!("29e0e79c3a03a4fb258b60a06bbf337dbd63a602e8832f7dc1bec9bf5dc00d83")),
            ManagedBuffer::from(b"https://validator.umb.network/")
        );

        self.create(
            ManagedAddress::from(hex!("40b2847674650ffeaf5e58a809a4a044c61c0b82b96a3924c83ee297f259130c")),
            ManagedBuffer::from(b"https://validator2.umb.network/")
        );
    }
}
