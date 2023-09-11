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
            ManagedAddress::from(hex!("e25ba4aeb18500517d015aaa89d4632bf76c290f2e5776856540edd5036b3570")),
            ManagedBuffer::from(b"https://validator.dev.umb.network/")
        );
        self.create(
            ManagedAddress::from(hex!("5266c0d387721ca231deb5ea8ca31d5ebf2e9dff683c41d29618512f9e3111c9")),
            ManagedBuffer::from(b"https://validator2.dev.umb.network/")
        );
    }
}
