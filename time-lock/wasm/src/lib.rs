// Code generated by the multiversx-sc build system. DO NOT EDIT.

////////////////////////////////////////////////////
////////////////// AUTO-GENERATED //////////////////
////////////////////////////////////////////////////

// Init:                                 1
// Upgrade:                              1
// Endpoints:                            6
// Async Callback:                       1
// Total number of exported functions:   9

#![no_std]

multiversx_sc_wasm_adapter::allocator!();
multiversx_sc_wasm_adapter::panic_handler!();

multiversx_sc_wasm_adapter::endpoints! {
    time_lock
    (
        init => init
        upgrade => upgrade
        proposeCall => propose_call
        discardCall => discard_call
        performNextCall => perform_next_call
        getTimeLockPeriod => time_lock_period
        getMultisigAddress => multisig_address
        getPendingCallsFullInfo => call_data_mapper
    )
}

multiversx_sc_wasm_adapter::async_callback! { time_lock }
