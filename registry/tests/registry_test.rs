use multiversx_sc::hex_literal::hex;
use multiversx_sc::types::{Address, ManagedAddress, ManagedBuffer, MultiValueManagedVecCounted};
use multiversx_sc_scenario::{
    managed_address, managed_buffer, rust_biguint,
    testing_framework::{BlockchainStateWrapper, ContractObjWrapper},
    DebugApi,
};

use registry::Registry;

pub struct RegistrySetup<RegistryObjectBuilder>
where
    RegistryObjectBuilder: 'static + Copy + Fn() -> registry::ContractObj<DebugApi>,
{
    pub b_mock: BlockchainStateWrapper,
    pub owner_address: Address,
    pub contract_wrapper:
        ContractObjWrapper<registry::ContractObj<DebugApi>, RegistryObjectBuilder>,
}

impl<RegistryObjectBuilder> RegistrySetup<RegistryObjectBuilder>
where
    RegistryObjectBuilder: 'static + Copy + Fn() -> registry::ContractObj<DebugApi>,
{
    pub fn new(contract_builder: RegistryObjectBuilder) -> Self {
        let rust_zero = rust_biguint!(0u64);
        let mut b_mock = BlockchainStateWrapper::new();
        let owner_address = b_mock.create_user_account(&rust_zero);

        let contract_wrapper = b_mock.create_sc_account(
            &rust_zero,
            Option::Some(&owner_address),
            contract_builder,
            "output/registry.wasm",
        );
        let _ = DebugApi::dummy();

        b_mock
            .execute_tx(&owner_address, &contract_wrapper, &rust_zero, |sc| {
                sc.init();
            })
            .assert_ok();

        RegistrySetup {
            b_mock,
            owner_address,
            contract_wrapper,
        }
    }
}

#[test]
fn import_addresses_error() {
    let rust_zero = rust_biguint!(0u64);
    let mut fc_setup = RegistrySetup::new(registry::contract_obj);

    fc_setup
        .b_mock
        .execute_tx(
            &fc_setup.owner_address,
            &fc_setup.contract_wrapper,
            &rust_zero,
            |sc| {
                let mut names =
                    MultiValueManagedVecCounted::<DebugApi, ManagedBuffer<DebugApi>>::new();
                let mut destinations =
                    MultiValueManagedVecCounted::<DebugApi, ManagedAddress<DebugApi>>::new();

                names.push(managed_buffer!(b"feeds"));
                names.push(managed_buffer!(b"staking_bank"));
                destinations.push(managed_address!(&Address::from(hex!(
                    "0139472eff6886771a982f3083da5d421f24c29181e63888228dc81ca60d69e1"
                ))));

                sc.import_addresses(names, destinations);
            },
        )
        .assert_user_error("Arrays data do not match");

    fc_setup
        .b_mock
        .execute_query(&fc_setup.contract_wrapper, |sc| {
            sc.require_and_get_address(&managed_buffer!(b"feeds"));
        })
        .assert_user_error("Name not registered");

    fc_setup
        .b_mock
        .execute_query(&fc_setup.contract_wrapper, |sc| {
            sc.get_address_by_string(&managed_buffer!(b"feeds"));
        })
        .assert_user_error("storage decode error: bad array length");

    fc_setup
        .b_mock
        .execute_query(&fc_setup.contract_wrapper, |sc| {
            sc.registry(&managed_buffer!(b"feeds")).get();
        })
        .assert_user_error("storage decode error: bad array length");
}

#[test]
fn import_addresses() {
    let rust_zero = rust_biguint!(0u64);
    let mut fc_setup = RegistrySetup::new(registry::contract_obj);

    fc_setup
        .b_mock
        .execute_tx(
            &fc_setup.owner_address,
            &fc_setup.contract_wrapper,
            &rust_zero,
            |sc| {
                let mut names =
                    MultiValueManagedVecCounted::<DebugApi, ManagedBuffer<DebugApi>>::new();
                let mut destinations =
                    MultiValueManagedVecCounted::<DebugApi, ManagedAddress<DebugApi>>::new();

                names.push(managed_buffer!(b"feeds"));
                destinations.push(managed_address!(&Address::from(hex!(
                    "0139472eff6886771a982f3083da5d421f24c29181e63888228dc81ca60d69e1"
                ))));

                sc.import_addresses(names, destinations);
            },
        )
        .assert_ok();

    fc_setup
        .b_mock
        .execute_query(&fc_setup.contract_wrapper, |sc| {
            assert_eq!(
                sc.require_and_get_address(&managed_buffer!(b"feeds")),
                managed_address!(&Address::from(hex!(
                    "0139472eff6886771a982f3083da5d421f24c29181e63888228dc81ca60d69e1"
                )))
            );
        })
        .assert_ok();

    fc_setup
        .b_mock
        .execute_query(&fc_setup.contract_wrapper, |sc| {
            assert_eq!(
                sc.get_address_by_string(&managed_buffer!(b"feeds")),
                managed_address!(&Address::from(hex!(
                    "0139472eff6886771a982f3083da5d421f24c29181e63888228dc81ca60d69e1"
                )))
            );
        })
        .assert_ok();

    fc_setup
        .b_mock
        .execute_query(&fc_setup.contract_wrapper, |sc| {
            assert_eq!(
                sc.registry(&managed_buffer!(b"feeds")).get(),
                managed_address!(&Address::from(hex!(
                    "0139472eff6886771a982f3083da5d421f24c29181e63888228dc81ca60d69e1"
                )))
            );
        })
        .assert_ok();
}
