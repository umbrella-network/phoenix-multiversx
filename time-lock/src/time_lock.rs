#![no_std]

multiversx_sc::imports!();
multiversx_sc::derive_imports!();

#[derive(TopEncode, TopDecode, TypeAbi)]
pub struct CallData<M: ManagedTypeApi> {
    pub to: ManagedAddress<M>,
    pub egld_amount: BigUint<M>,
    pub endpoint_name: ManagedBuffer<M>,
    pub arguments: ManagedVec<M, ManagedBuffer<M>>,
    pub perform_after_timestamp: u64,
}

#[multiversx_sc::contract]
pub trait TimeLock {
    #[init]
    fn init(&self, time_lock_period: u64, multisig_address: ManagedAddress) {
        self.time_lock_period().set(time_lock_period);
        self.multisig_address().set(multisig_address);
    }

    #[upgrade]
    fn upgrade(&self, time_lock_period: u64) {
        self.time_lock_period().set(time_lock_period);
    }

    #[endpoint(proposeCall)]
    fn propose_call(&self, to: ManagedAddress, egld_amount: BigUint, function_call: FunctionCall) {
        self.require_multisig();

        let call_data = CallData {
            to,
            egld_amount,
            endpoint_name: function_call.function_name,
            arguments: function_call.arg_buffer.into_vec_of_buffers(),
            perform_after_timestamp: self.blockchain().get_block_timestamp()
                + self.time_lock_period().get(),
        };

        self.call_data_mapper().push_back(call_data);
    }

    #[endpoint(discardCall)]
    fn discard_call(&self) {
        self.require_multisig();

        self.call_data_mapper().pop_back();
    }

    #[endpoint(performNextCall)]
    fn perform_next_call(&self) {
        let call_to_execute = self.call_data_mapper().pop_front();

        require!(call_to_execute.is_some(), "No call to perform");

        let call_data: CallData<Self::Api> = call_to_execute.unwrap();

        require!(
            self.blockchain().get_block_timestamp() >= call_data.perform_after_timestamp,
            "Can not perform yet"
        );

        self.send()
            .contract_call::<()>(call_data.to, call_data.endpoint_name)
            .with_egld_transfer(call_data.egld_amount)
            .with_raw_arguments(call_data.arguments.into())
            .async_call()
            .with_callback(self.callbacks().perform_async_call_callback())
            .call_and_exit();
    }

    fn require_multisig(&self) {
        require!(
            self.blockchain().get_caller() == self.multisig_address().get(),
            "Only multisig can call this"
        );
    }

    #[view(getTimeLockPeriod)]
    #[storage_mapper("time_lock_period")]
    fn time_lock_period(&self) -> SingleValueMapper<u64>;

    #[view(getMultisigAddress)]
    #[storage_mapper("multisig_address")]
    fn multisig_address(&self) -> SingleValueMapper<ManagedAddress>;

    #[view(getPendingCallsFullInfo)]
    #[storage_mapper("call_data_mapper")]
    fn call_data_mapper(&self) -> QueueMapper<CallData<Self::Api>>;

    #[callback]
    fn perform_async_call_callback(
        &self,
        #[call_result] call_result: ManagedAsyncCallResult<MultiValueEncoded<ManagedBuffer>>,
    ) {
        match call_result {
            ManagedAsyncCallResult::Ok(results) => {
                self.async_call_success(results);
            }
            ManagedAsyncCallResult::Err(err) => {
                self.async_call_error(err.err_code, err.err_msg);
            }
        }
    }

    #[event("asyncCallSuccess")]
    fn async_call_success(&self, #[indexed] results: MultiValueEncoded<ManagedBuffer>);

    #[event("asyncCallError")]
    fn async_call_error(&self, #[indexed] err_code: u32, #[indexed] err_message: ManagedBuffer);
}
