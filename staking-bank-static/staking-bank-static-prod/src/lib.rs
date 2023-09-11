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

        // TODO: Add actual addresses
        // self.create(
        //     ManagedAddress::from(hex!("0139472eff6886771a982f3083da5d421f24c29181e63888228dc81ca60d69e1")),
        //     ManagedBuffer::from(b"localhost")
        // );
    }
}
