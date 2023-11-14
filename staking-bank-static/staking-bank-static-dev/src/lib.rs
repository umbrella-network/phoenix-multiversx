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
            ManagedAddress::from(hex!("914575e7907479e662c31fd53008ea0decafa96272e8ae5b328db7be84734b2b")),
            ManagedBuffer::from(b"https://validator.dev.umb.network/")
        );
        self.create(
            ManagedAddress::from(hex!("858cff0d4ee0d1e8d873403575ee642223fcd384511aa669cc8958a01b4953ea")),
            ManagedBuffer::from(b"https://validator2.dev.umb.network/")
        );
    }
}
