#![no_std]

multiversx_sc::imports!();

pub const UMBRELLA_FEEDS_NAME: &[u8] = b"UmbrellaFeeds";

pub mod registry_proxy {
    multiversx_sc::imports!();

    #[multiversx_sc::proxy]
    pub trait StakingBankProxy {
        #[view(getAddress)]
        fn get_address(&self, name: &ManagedBuffer) -> ManagedAddress;
    }
}

pub mod feeds_proxy {
    multiversx_sc::imports!();
    multiversx_sc::derive_imports!();

    #[derive(TypeAbi, TopEncode, TopDecode)]
    pub struct PriceData<M: ManagedTypeApi> {
        pub heartbeat: u32,
        pub timestamp: u32,
        pub price: BigUint<M>,
    }

    #[multiversx_sc::proxy]
    pub trait FeedsProxy {
        #[view(getPriceData)]
        fn get_price_data(&self, key: ManagedBuffer) -> PriceData<Self::Api>;

        #[view(getPrice)]
        fn get_price(&self, key: ManagedBuffer) -> BigUint;
    }
}

#[multiversx_sc::contract]
pub trait UmbrellaExampleContract {
    #[init]
    fn init(&self, registry: ManagedAddress, token_identifier: EgldOrEsdtTokenIdentifier, token_key: ManagedBuffer) {
        self.registry().set(registry);
        self.token_identifier().set(token_identifier);
        self.token_key().set(token_key);
    }

    #[payable("*")]
    #[endpoint]
    fn pay(&self) {
        let (token_identifier, amount) = self.call_value().egld_or_single_fungible_esdt();

        require!(token_identifier == self.token_identifier().get(), "Wrong token sent");

        let required_amount = self.get_external_price();

        require!(amount >= required_amount, "Insufficient amount sent");

        let remaining = amount - required_amount;

        if remaining > 0 {
            let caller = self.blockchain().get_caller();

            self.send().direct(&caller, &token_identifier, 0, &remaining)
        }
    }

    #[only_owner]
    #[endpoint]
    fn collect(&self) {
        let last_collect_time = self.last_collect_time().get();

        let external_price_data = self.get_external_price_data();

        require!(external_price_data.timestamp > last_collect_time, "Can not collect yet");

        let token_identifier = self.token_identifier().get();

        let balance = self.blockchain().get_sc_balance(&token_identifier, 0);

        require!(balance > 0, "Balance is empty");

        self.send().direct(&self.blockchain().get_owner_address(), &token_identifier, 0, &balance)
    }

    #[view(getExternalPriceData)]
    fn get_external_price_data(&self) -> feeds_proxy::PriceData<Self::Api> {
        let feeds_address = self.get_feeds_address();

        let key = self.token_key().get();

        self.feeds_proxy(feeds_address)
            .get_price_data(key)
            .execute_on_dest_context()
    }

    #[view(getExternalPrice)]
    fn get_external_price(&self) -> BigUint {
        let feeds_address = self.get_feeds_address();

        let key = self.token_key().get();

        self.feeds_proxy(feeds_address)
            .get_price(key)
            .execute_on_dest_context()
    }

    fn get_feeds_address(&self) -> ManagedAddress {
        self.registry_proxy(self.registry().get())
            .get_address(ManagedBuffer::from(UMBRELLA_FEEDS_NAME))
            .execute_on_dest_context::<ManagedAddress>()
    }

    #[view]
    #[storage_mapper("registry")]
    fn registry(&self) -> SingleValueMapper<ManagedAddress>;

    #[view]
    #[storage_mapper("token_identifier")]
    fn token_identifier(&self) -> SingleValueMapper<EgldOrEsdtTokenIdentifier>;

    #[view]
    #[storage_mapper("token_key")]
    fn token_key(&self) -> SingleValueMapper<ManagedBuffer>;

    #[view]
    #[storage_mapper("last_collect_time")]
    fn last_collect_time(&self) -> SingleValueMapper<u32>;

    #[proxy]
    fn registry_proxy(&self, address: ManagedAddress) -> registry_proxy::Proxy<Self::Api>;

    #[proxy]
    fn feeds_proxy(&self, address: ManagedAddress) -> feeds_proxy::Proxy<Self::Api>;
}
