import { Command } from 'commander';
import { e } from 'xsuite';
// @ts-ignore
import { Address, SmartContract } from '@multiversx/sdk-core';

import { envChain } from './customEnvChain.js';
import data from './data.json';

import {
  timelockChangeOwner, timelockDiscardCall,
  timelockPerformNextCall,
  timelockPrintPendingCalls,
  timelockPrintState
} from "./actions/timelockActions";


const program = new Command();

/*
npm run timelock:devnet performNextCall --shardId 1
*/
program.command('performNextCall')
  .argument('[shardId]', 'Shard number')
  .action(async (shardId: number) => {
    await timelockPerformNextCall(shardId);
  });

/*
npm run timelock:devnet discardCall --shardId 1
*/
program.command('discardCall')
  .argument('[shardId]', 'Shard number')
  .action(async (shardId: number) => {
    await timelockDiscardCall(shardId);
  });

/*
npm run timelock:devnet test --shardId 1
*/
program.command('test')
  .argument('[shardId]', 'Shard number')
  .action(async (shardId: number) => {
    const wallet = await loadWallet(shardId);
    const timeLock = new SmartContract({ address: Address.fromBech32(envChain.select(data.timeLockAddress)) });
    const registry = new SmartContract({ address: Address.fromBech32(envChain.select(data.registryAddress)) });

    const tx = await wallet.callContract({
      callee: timeLock.getAddress().bech32(),
      gasLimit: 10_000_000,
      funcName: 'proposeCall',
      funcArgs: [
        e.Addr(registry.getAddress().bech32()),
        e.U(0),
        e.Str('importAddresses'),
        e.U32(1),
        e.Bytes(Buffer.from('deployerAddress', 'utf-8')),
        e.U32(1),
        e.Addr('erd1zkdzcqynqks6hyve6538cace9lwepn2rlh9k3ejcw3whwgkzr0vsv0pn7j'),
      ],
    });

    console.log('explorerUrl', tx.tx.explorerUrl);
    console.log('status', tx.tx.status);

    if (tx.tx.status != 'success') {
      console.log(tx);
    }
  });

/*
npm run timelock:devnet printState
*/
program.command('printState')
  .action(async () => {
    await timelockPrintState();
  });

/*
npm run timelock:devnet pendingCalls
*/
program.command('pendingCalls')
  .action(async () => {
    await timelockPrintPendingCalls();
  });

/*
npm run timelock:devnet changeOwner
change registry owner back to deployer:
npm run timelock:devnet changeOwner erd1qqqqqqqqqqqqqpgqltvtlxz8h93lwcu8mw3zq43808vtuh3rr0vs3ztu84 erd1zkdzcqynqks6hyve6538cace9lwepn2rlh9k3ejcw3whwgkzr0vsv0pn7j 1
*/
program.command('changeOwner')
  .argument('[target]', 'contract address', '')
  .argument('[newOwner]', 'The address of new owner', '')
  .argument('[shardId]', 'Shard number')
  .action(async (target: string, newOwner: string, shardId: number) => {
    await timelockChangeOwner(target, newOwner, shardId);
  });

program.parse(process.argv);
