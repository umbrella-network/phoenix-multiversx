use multiversx_sc::codec::multi_types::{MultiValue2, MultiValue3};
use multiversx_sc::hex_literal::hex;
use multiversx_sc::types::{
    Address, ManagedBuffer, ManagedByteArray, MultiValueEncoded, MultiValueManagedVecCounted,
};
use multiversx_sc_scenario::{
    managed_address, managed_biguint, managed_buffer, rust_biguint,
    testing_framework::{BlockchainStateWrapper, ContractObjWrapper},
    DebugApi,
};
use num_bigint::BigUint;

use staking_bank_static_local::StakingBank;
use umbrella_feeds::structs::{PriceData, Signature};
use umbrella_feeds::UmbrellaFeeds;

pub struct UmbrellaFeedsSetup<UmbrellaFeedsObjectBuilder, StakingFactoryObjectBuilder>
where
    UmbrellaFeedsObjectBuilder: 'static + Copy + Fn() -> umbrella_feeds::ContractObj<DebugApi>,
    StakingFactoryObjectBuilder:
        'static + Copy + Fn() -> staking_bank_static_local::ContractObj<DebugApi>,
{
    pub b_mock: BlockchainStateWrapper,
    pub owner_address: Address,
    pub contract_wrapper:
        ContractObjWrapper<umbrella_feeds::ContractObj<DebugApi>, UmbrellaFeedsObjectBuilder>,
    pub staking_bank_wrapper: ContractObjWrapper<
        staking_bank_static_local::ContractObj<DebugApi>,
        StakingFactoryObjectBuilder,
    >,
}

impl<UmbrellaFeedsObjectBuilder, StakingFactoryObjectBuilder>
    UmbrellaFeedsSetup<UmbrellaFeedsObjectBuilder, StakingFactoryObjectBuilder>
where
    UmbrellaFeedsObjectBuilder: 'static + Copy + Fn() -> umbrella_feeds::ContractObj<DebugApi>,
    StakingFactoryObjectBuilder:
        'static + Copy + Fn() -> staking_bank_static_local::ContractObj<DebugApi>,
{
    pub fn new(
        contract_builder: UmbrellaFeedsObjectBuilder,
        staking_factory_contract_builder: StakingFactoryObjectBuilder,
        required_signatures: usize,
        init_staking_bank: bool,
    ) -> Self {
        let rust_zero = rust_biguint!(0u64);
        let mut b_mock = BlockchainStateWrapper::new();
        let owner_address = b_mock.create_user_account(&rust_zero);

        let contract_wrapper = b_mock.create_sc_account(
            &rust_zero,
            Option::Some(&owner_address),
            contract_builder,
            "output/umbrella-feeds.wasm",
        );

        let staking_bank_wrapper = b_mock.create_sc_account(
            &rust_zero,
            Option::Some(&owner_address),
            staking_factory_contract_builder,
            "../../staking-bank-static/staking-bank-static-local/output/staking-bank.wasm",
        );

        let _ = DebugApi::dummy();

        if init_staking_bank {
            b_mock
                .execute_tx(&owner_address, &staking_bank_wrapper, &rust_zero, |sc| {
                    sc.init();
                })
                .assert_ok();
        }

        b_mock
            .execute_tx(&owner_address, &contract_wrapper, &rust_zero, |sc| {
                sc.init(
                    managed_address!(staking_bank_wrapper.address_ref()),
                    required_signatures,
                    8,
                    198003, // chain id
                );
            })
            .assert_ok();

        UmbrellaFeedsSetup {
            b_mock,
            owner_address,
            contract_wrapper,
            staking_bank_wrapper,
        }
    }

    fn do_valid_update(&mut self, rust_zero: &BigUint) {
        self.b_mock.execute_tx(&self.owner_address, &self.contract_wrapper, rust_zero, |sc| {
            let mut price_keys = MultiValueManagedVecCounted::<DebugApi, ManagedBuffer<DebugApi>>::new();
            let mut price_datas = MultiValueManagedVecCounted::<DebugApi, PriceData<DebugApi>>::new();
            let mut signatures = MultiValueManagedVecCounted::<DebugApi, Signature<DebugApi>>::new();

            // ETH-USD hashed using keccak256
            price_keys.push(managed_buffer!(&hex!("2430f68ea2e8d4151992bb7fc3a4c472087a6149bf7e0232704396162ab7c1f7")));

            price_datas.push(PriceData {
                heartbeat: 0,
                timestamp: 1688998114,
                price: managed_biguint!(1000000000u64),
            });

            signatures.push(Signature {
                address: managed_address!(&Address::from(hex!("0139472eff6886771a982f3083da5d421f24c29181e63888228dc81ca60d69e1"))),
                signature: ManagedByteArray::from(&hex!("d9ef498d116dc9725807da9a7ae8de11a89a7588ec3bc716e567a78ac2cdfb89da3b54ec410bf05505ab03e135f5c08668a3689357f01454c42848a0396c3d05")),
            });

            sc.update(price_keys, price_datas, signatures);
        })
            .assert_ok();
    }
}

#[test]
fn update_valid_signature() {
    let rust_zero = rust_biguint!(0u64);
    let mut fc_setup = UmbrellaFeedsSetup::new(
        umbrella_feeds::contract_obj,
        staking_bank_static_local::contract_obj,
        1,
        true,
    );

    fc_setup.do_valid_update(&rust_zero);

    fc_setup
        .b_mock
        .execute_query(&fc_setup.contract_wrapper, |sc| {
            let price_data: PriceData<DebugApi> =
                sc.get_price_data_by_name(managed_buffer!(b"ETH-USD"));

            assert_eq!(price_data.heartbeat, 0);
            assert_eq!(price_data.timestamp, 1688998114);
            assert_eq!(price_data.price, managed_biguint!(1000000000u64));
        })
        .assert_ok();

    // Can not update with same data twice
    fc_setup.b_mock.execute_tx(&fc_setup.owner_address, &fc_setup.contract_wrapper, &rust_zero, |sc| {
        let mut price_keys = MultiValueManagedVecCounted::<DebugApi, ManagedBuffer<DebugApi>>::new();
        let mut price_datas = MultiValueManagedVecCounted::<DebugApi, PriceData<DebugApi>>::new();
        let mut signatures = MultiValueManagedVecCounted::<DebugApi, Signature<DebugApi>>::new();

        // ETH-USD hashed using keccak256
        price_keys.push(managed_buffer!(&hex!("2430f68ea2e8d4151992bb7fc3a4c472087a6149bf7e0232704396162ab7c1f7")));

        price_datas.push(PriceData {
            heartbeat: 0,
            timestamp: 1688998114,
            price: managed_biguint!(1000000000u64),
        });

        signatures.push(Signature {
            address: managed_address!(&Address::from(hex!("0139472eff6886771a982f3083da5d421f24c29181e63888228dc81ca60d69e1"))),
            signature: ManagedByteArray::from(&hex!("d9ef498d116dc9725807da9a7ae8de11a89a7588ec3bc716e567a78ac2cdfb89da3b54ec410bf05505ab03e135f5c08668a3689357f01454c42848a0396c3d05")),
        });

        sc.update(price_keys, price_datas, signatures);
    })
        .assert_user_error("Old data");
}

#[test]
fn update_not_enough_signatures() {
    let rust_zero = rust_biguint!(0u64);
    let mut fc_setup = UmbrellaFeedsSetup::new(
        umbrella_feeds::contract_obj,
        staking_bank_static_local::contract_obj,
        2,
        true,
    );

    fc_setup.b_mock.execute_tx(&fc_setup.owner_address, &fc_setup.contract_wrapper, &rust_zero, |sc| {
        let mut price_keys = MultiValueManagedVecCounted::<DebugApi, ManagedBuffer<DebugApi>>::new();
        let mut price_datas = MultiValueManagedVecCounted::<DebugApi, PriceData<DebugApi>>::new();
        let mut signatures = MultiValueManagedVecCounted::<DebugApi, Signature<DebugApi>>::new();

        price_keys.push(managed_buffer!(&hex!("2430f68ea2e8d4151992bb7fc3a4c472087a6149bf7e0232704396162ab7c1f7")));

        price_datas.push(PriceData {
            heartbeat: 0,
            timestamp: 1688998114,
            price: managed_biguint!(1000000000u64),
        });

        signatures.push(Signature {
            address: managed_address!(&Address::from(hex!("0139472eff6886771a982f3083da5d421f24c29181e63888228dc81ca60d69e1"))),
            signature: ManagedByteArray::from(&hex!("d9ef498d116dc9725807da9a7ae8de11a89a7588ec3bc716e567a78ac2cdfb89da3b54ec410bf05505ab03e135f5c08668a3689357f01454c42848a0396c3d05")),
        });

        sc.update(price_keys, price_datas, signatures);
    })
        .assert_user_error("Not enough signatures");
}

#[test]
fn update_invalid_signature() {
    let rust_zero = rust_biguint!(0u64);
    let mut fc_setup = UmbrellaFeedsSetup::new(
        umbrella_feeds::contract_obj,
        staking_bank_static_local::contract_obj,
        1,
        true,
    );

    fc_setup.b_mock.execute_tx(&fc_setup.owner_address, &fc_setup.contract_wrapper, &rust_zero, |sc| {
        let mut price_keys = MultiValueManagedVecCounted::<DebugApi, ManagedBuffer<DebugApi>>::new();
        let mut price_datas = MultiValueManagedVecCounted::<DebugApi, PriceData<DebugApi>>::new();
        let mut signatures = MultiValueManagedVecCounted::<DebugApi, Signature<DebugApi>>::new();

        price_keys.push(managed_buffer!(&hex!("2430f68ea2e8d4151992bb7fc3a4c472087a6149bf7e0232704396162ab7c1f7")));

        price_datas.push(PriceData {
            heartbeat: 0,
            timestamp: 1688998114,
            price: managed_biguint!(2000000000u64), // wrong price
        });

        signatures.push(Signature {
            address: managed_address!(&Address::from(hex!("0139472eff6886771a982f3083da5d421f24c29181e63888228dc81ca60d69e1"))),
            signature: ManagedByteArray::from(&hex!("d9ef498d116dc9725807da9a7ae8de11a89a7588ec3bc716e567a78ac2cdfb89da3b54ec410bf05505ab03e135f5c08668a3689357f01454c42848a0396c3d05")),
        });

        sc.update(price_keys, price_datas, signatures);
    })
        .assert_user_error("Invalid signature");
}

#[test]
fn update_invalid_signer() {
    let rust_zero = rust_biguint!(0u64);
    let mut fc_setup = UmbrellaFeedsSetup::new(
        umbrella_feeds::contract_obj,
        staking_bank_static_local::contract_obj,
        1,
        false, // signer not known by staking bank
    );

    fc_setup.b_mock.execute_tx(&fc_setup.owner_address, &fc_setup.contract_wrapper, &rust_zero, |sc| {
        let mut price_keys = MultiValueManagedVecCounted::<DebugApi, ManagedBuffer<DebugApi>>::new();
        let mut price_datas = MultiValueManagedVecCounted::<DebugApi, PriceData<DebugApi>>::new();
        let mut signatures = MultiValueManagedVecCounted::<DebugApi, Signature<DebugApi>>::new();

        price_keys.push(managed_buffer!(&hex!("2430f68ea2e8d4151992bb7fc3a4c472087a6149bf7e0232704396162ab7c1f7")));

        price_datas.push(PriceData {
            heartbeat: 0,
            timestamp: 1688998114,
            price: managed_biguint!(1000000000u64),
        });

        signatures.push(Signature {
            address: managed_address!(&Address::from(hex!("0139472eff6886771a982f3083da5d421f24c29181e63888228dc81ca60d69e1"))),
            signature: ManagedByteArray::from(&hex!("d9ef498d116dc9725807da9a7ae8de11a89a7588ec3bc716e567a78ac2cdfb89da3b54ec410bf05505ab03e135f5c08668a3689357f01454c42848a0396c3d05")),
        });

        sc.update(price_keys, price_datas, signatures);
    })
        .assert_user_error("Invalid signer");
}

#[test]
fn update_signatures_out_of_order() {
    let rust_zero = rust_biguint!(0u64);
    let mut fc_setup = UmbrellaFeedsSetup::new(
        umbrella_feeds::contract_obj,
        staking_bank_static_local::contract_obj,
        2,
        true,
    );

    fc_setup.b_mock.execute_tx(&fc_setup.owner_address, &fc_setup.contract_wrapper, &rust_zero, |sc| {
        let mut price_keys = MultiValueManagedVecCounted::<DebugApi, ManagedBuffer<DebugApi>>::new();
        let mut price_datas = MultiValueManagedVecCounted::<DebugApi, PriceData<DebugApi>>::new();
        let mut signatures = MultiValueManagedVecCounted::<DebugApi, Signature<DebugApi>>::new();

        // ETH-USD hashed using keccak256
        price_keys.push(managed_buffer!(&hex!("2430f68ea2e8d4151992bb7fc3a4c472087a6149bf7e0232704396162ab7c1f7")));

        price_datas.push(PriceData {
            heartbeat: 0,
            timestamp: 1688998114,
            price: managed_biguint!(1000000000u64),
        });

        signatures.push(Signature {
            address: managed_address!(&Address::from(hex!("0139472eff6886771a982f3083da5d421f24c29181e63888228dc81ca60d69e1"))),
            signature: ManagedByteArray::from(&hex!("d9ef498d116dc9725807da9a7ae8de11a89a7588ec3bc716e567a78ac2cdfb89da3b54ec410bf05505ab03e135f5c08668a3689357f01454c42848a0396c3d05")),
        });
        // Duplicate signatures
        signatures.push(Signature {
            address: managed_address!(&Address::from(hex!("0139472eff6886771a982f3083da5d421f24c29181e63888228dc81ca60d69e1"))),
            signature: ManagedByteArray::from(&hex!("d9ef498d116dc9725807da9a7ae8de11a89a7588ec3bc716e567a78ac2cdfb89da3b54ec410bf05505ab03e135f5c08668a3689357f01454c42848a0396c3d05")),
        });

        sc.update(price_keys, price_datas, signatures);
    })
        .assert_user_error("Signatures out of order");
}


#[test]
fn update_multiple_signatures_only_one_required() {
    let rust_zero = rust_biguint!(0u64);
    let mut fc_setup = UmbrellaFeedsSetup::new(
        umbrella_feeds::contract_obj,
        staking_bank_static_local::contract_obj,
        1,
        true,
    );

    fc_setup.b_mock.execute_tx(&fc_setup.owner_address, &fc_setup.contract_wrapper, &rust_zero, |sc| {
        let mut price_keys = MultiValueManagedVecCounted::<DebugApi, ManagedBuffer<DebugApi>>::new();
        let mut price_datas = MultiValueManagedVecCounted::<DebugApi, PriceData<DebugApi>>::new();
        let mut signatures = MultiValueManagedVecCounted::<DebugApi, Signature<DebugApi>>::new();

        // ETH-USD hashed using keccak256
        price_keys.push(managed_buffer!(&hex!("2430f68ea2e8d4151992bb7fc3a4c472087a6149bf7e0232704396162ab7c1f7")));

        price_datas.push(PriceData {
            heartbeat: 0,
            timestamp: 1688998114,
            price: managed_biguint!(1000000000u64),
        });

        signatures.push(Signature {
            address: managed_address!(&Address::from(hex!("0139472eff6886771a982f3083da5d421f24c29181e63888228dc81ca60d69e1"))),
            signature: ManagedByteArray::from(&hex!("d9ef498d116dc9725807da9a7ae8de11a89a7588ec3bc716e567a78ac2cdfb89da3b54ec410bf05505ab03e135f5c08668a3689357f01454c42848a0396c3d05")),
        });
        // Duplicate signatures, but only one required so only the first one is taken into account
        signatures.push(Signature {
            address: managed_address!(&Address::from(hex!("0139472eff6886771a982f3083da5d421f24c29181e63888228dc81ca60d69e1"))),
            signature: ManagedByteArray::from(&hex!("d9ef498d116dc9725807da9a7ae8de11a89a7588ec3bc716e567a78ac2cdfb89da3b54ec410bf05505ab03e135f5c08668a3689357f01454c42848a0396c3d05")),
        });

        sc.update(price_keys, price_datas, signatures);
    })
        .assert_ok();
}

#[test]
fn view_functions_test() {
    let rust_zero = rust_biguint!(0u64);
    let mut fc_setup = UmbrellaFeedsSetup::new(
        umbrella_feeds::contract_obj,
        staking_bank_static_local::contract_obj,
        1,
        true,
    );

    fc_setup.do_valid_update(&rust_zero);

    // getManyPriceData
    fc_setup
        .b_mock
        .execute_query(&fc_setup.contract_wrapper, |sc| {
            let mut keys = MultiValueEncoded::new();
            keys.push(managed_buffer!(&hex!(
                "2430f68ea2e8d4151992bb7fc3a4c472087a6149bf7e0232704396162ab7c1f7"
            )));

            let price_datas: MultiValueEncoded<DebugApi, PriceData<DebugApi>> =
                sc.get_many_price_data(keys);

            let price_data = price_datas.to_vec().get(0);

            assert_eq!(price_data.heartbeat, 0);
            assert_eq!(price_data.timestamp, 1688998114);
            assert_eq!(price_data.price, managed_biguint!(1000000000u64));
        })
        .assert_ok();

    fc_setup
        .b_mock
        .execute_query(&fc_setup.contract_wrapper, |sc| {
            let mut keys = MultiValueEncoded::new();
            keys.push(managed_buffer!(b"wrong key"));

            sc.get_many_price_data(keys);
        })
        .assert_user_error("Feed not exist");

    // getManyPriceDataRaw
    fc_setup
        .b_mock
        .execute_query(&fc_setup.contract_wrapper, |sc| {
            let mut keys = MultiValueEncoded::new();
            keys.push(managed_buffer!(&hex!(
                "2430f68ea2e8d4151992bb7fc3a4c472087a6149bf7e0232704396162ab7c1f7"
            )));
            keys.push(managed_buffer!(b"wrong key"));

            let price_datas: MultiValueEncoded<DebugApi, PriceData<DebugApi>> =
                sc.get_many_price_data_raw(keys);

            let price_datas_vec = price_datas.to_vec();
            let price_data = price_datas_vec.get(0);

            assert_eq!(price_data.heartbeat, 0);
            assert_eq!(price_data.timestamp, 1688998114);
            assert_eq!(price_data.price, managed_biguint!(1000000000u64));

            let price_data = price_datas_vec.get(1);

            assert_eq!(price_data.heartbeat, 0);
            assert_eq!(price_data.timestamp, 0);
            assert_eq!(price_data.price, managed_biguint!(0));
        })
        .assert_ok();

    // getPriceData
    fc_setup
        .b_mock
        .execute_query(&fc_setup.contract_wrapper, |sc| {
            let key = managed_buffer!(&hex!(
                "2430f68ea2e8d4151992bb7fc3a4c472087a6149bf7e0232704396162ab7c1f7"
            ));

            let price_data: PriceData<DebugApi> = sc.get_price_data(key);

            assert_eq!(price_data.heartbeat, 0);
            assert_eq!(price_data.timestamp, 1688998114);
            assert_eq!(price_data.price, managed_biguint!(1000000000u64));
        })
        .assert_ok();

    fc_setup
        .b_mock
        .execute_query(&fc_setup.contract_wrapper, |sc| {
            sc.get_price_data(managed_buffer!(b"wrong key"));
        })
        .assert_user_error("Feed not exist");

    // getPrice
    fc_setup
        .b_mock
        .execute_query(&fc_setup.contract_wrapper, |sc| {
            let key = managed_buffer!(&hex!(
                "2430f68ea2e8d4151992bb7fc3a4c472087a6149bf7e0232704396162ab7c1f7"
            ));

            let price = sc.get_price(key);

            assert_eq!(price, managed_biguint!(1000000000u64));
        })
        .assert_ok();

    fc_setup
        .b_mock
        .execute_query(&fc_setup.contract_wrapper, |sc| {
            sc.get_price(managed_buffer!(b"wrong key"));
        })
        .assert_user_error("Feed not exist");

    // getPriceTimestamp
    fc_setup
        .b_mock
        .execute_query(&fc_setup.contract_wrapper, |sc| {
            let key = managed_buffer!(&hex!(
                "2430f68ea2e8d4151992bb7fc3a4c472087a6149bf7e0232704396162ab7c1f7"
            ));

            let price_timestamp = sc.get_price_timestamp(key);

            assert_eq!(
                price_timestamp,
                MultiValue2::from((managed_biguint!(1000000000u64), 1688998114))
            );
        })
        .assert_ok();

    fc_setup
        .b_mock
        .execute_query(&fc_setup.contract_wrapper, |sc| {
            sc.get_price_timestamp(managed_buffer!(b"wrong key"));
        })
        .assert_user_error("Feed not exist");

    // getPriceTimestampHeartbeat
    fc_setup
        .b_mock
        .execute_query(&fc_setup.contract_wrapper, |sc| {
            let key = managed_buffer!(&hex!(
                "2430f68ea2e8d4151992bb7fc3a4c472087a6149bf7e0232704396162ab7c1f7"
            ));

            let price_timestamp_heartbeat = sc.get_price_timestamp_heartbeat(key);

            assert_eq!(
                price_timestamp_heartbeat,
                MultiValue3::from((managed_biguint!(1000000000u64), 1688998114, 0))
            );
        })
        .assert_ok();

    fc_setup
        .b_mock
        .execute_query(&fc_setup.contract_wrapper, |sc| {
            sc.get_price_timestamp_heartbeat(managed_buffer!(b"wrong key"));
        })
        .assert_user_error("Feed not exist");

    // getPriceDataByName
    fc_setup
        .b_mock
        .execute_query(&fc_setup.contract_wrapper, |sc| {
            let key = managed_buffer!(b"ETH-USD");

            let price_data = sc.get_price_data_by_name(key);

            assert_eq!(price_data.heartbeat, 0);
            assert_eq!(price_data.timestamp, 1688998114);
            assert_eq!(price_data.price, managed_biguint!(1000000000u64));
        })
        .assert_ok();

    fc_setup
        .b_mock
        .execute_query(&fc_setup.contract_wrapper, |sc| {
            let key = managed_buffer!(b"wrong key");

            let price_data = sc.get_price_data_by_name(key);

            assert_eq!(price_data.heartbeat, 0);
            assert_eq!(price_data.timestamp, 0);
            assert_eq!(price_data.price, managed_biguint!(0));
        })
        .assert_ok();

    // prices
    fc_setup
        .b_mock
        .execute_query(&fc_setup.contract_wrapper, |sc| {
            let key = managed_buffer!(&hex!(
                "2430f68ea2e8d4151992bb7fc3a4c472087a6149bf7e0232704396162ab7c1f7"
            ));

            let price_data = sc.prices(&key).get();

            assert_eq!(price_data.heartbeat, 0);
            assert_eq!(price_data.timestamp, 1688998114);
            assert_eq!(price_data.price, managed_biguint!(1000000000u64));
        })
        .assert_ok();
}
