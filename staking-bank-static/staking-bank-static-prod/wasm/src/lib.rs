// Code generated by the multiversx-sc build system. DO NOT EDIT.

////////////////////////////////////////////////////
////////////////// AUTO-GENERATED //////////////////
////////////////////////////////////////////////////

// Init:                                 1
// Upgrade:                              1
// Endpoints:                            5
// Async Callback (empty):               1
// Total number of exported functions:   8

#![no_std]

multiversx_sc_wasm_adapter::allocator!();
multiversx_sc_wasm_adapter::panic_handler!();

multiversx_sc_wasm_adapter::endpoints! {
    staking_bank_static_prod
    (
        init => init
        upgrade => upgrade
        getNumberOfValidators => get_number_of_validators
        isValidator => is_validator
        verifyValidators => verify_validators
        validators => validators
        addresses => addresses
    )
}

multiversx_sc_wasm_adapter::async_callback_empty! {}
