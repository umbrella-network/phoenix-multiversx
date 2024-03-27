import { Command } from 'commander';
import { e } from 'xsuite';
import { Address, SmartContract } from '@multiversx/sdk-core';

import { envChain } from './customEnvChain.js';
import data from './data.json';

import {
  timelockChangeOwner, timelockDiscardCall,
  timelockPerformNextCall,
  timelockPrintPendingCalls,
  timelockPrintState
} from "./actions/timelockActions";
import {loadWallet, printTxStatus} from "./actions/helpers";


const program = new Command();

/*
npm run interact:devnet performNextCall --shardId 1
*/
program.command('performNextCall')
  .argument('[shardId]', 'Shard number')
  .action(async (shardId: number) => {
    await timelockPerformNextCall(shardId);
  });

/*
npm run interact:devnet discardCall --shardId 1
*/
program.command('discardCall')
  .argument('[shardId]', 'Shard number')
  .action(async (shardId: number) => {
    await timelockDiscardCall(shardId);
  });

/*
npm run interact:devnet test --shardId 1
*/
program.command('test')
  .argument('[shardId]', 'Shard number')
  .action(async (shardId: number) => {
    const wallet = await loadWallet(shardId);
    const timeLock = new SmartContract({ address: Address.fromBech32(envChain.select(data.timeLockAddress)) });
    const registry = new SmartContract({ address: Address.fromBech32(envChain.select(data.registryAddress)) });

    console.log('empty', Address.empty());

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
        // e.Addr('erd1zkdzcqynqks6hyve6538cace9lwepn2rlh9k3ejcw3whwgkzr0vsv0pn7j'),
        // e.Addr('erd10000000000000000000000000000000000000000000000000000000000'),
        e.Addr(Buffer.alloc(32)),
      ],
    });

    printTxStatus(tx);
  });

/*
npm run interact:devnet timelockPrintState
*/
program.command('timelockPrintState')
  .action(async () => {
    await timelockPrintState();
  });

/*
npm run interact:devnet timelockPendingCalls
*/
program.command('timelockPendingCalls')
  .action(async () => {
    await timelockPrintPendingCalls();
  });

/*
npm run interact:devnet timelockChangeOwner
change registry owner back to deployer:
npm run interact:devnet timelockChangeOwner erd1qqqqqqqqqqqqqpgqltvtlxz8h93lwcu8mw3zq43808vtuh3rr0vs3ztu84 erd1zkdzcqynqks6hyve6538cace9lwepn2rlh9k3ejcw3whwgkzr0vsv0pn7j 1
*/
program.command('timelockChangeOwner')
  .argument('[target]', 'contract address', '')
  .argument('[newOwner]', 'The address of new owner', '')
  .argument('[shardId]', 'Shard number')
  .action(async (target: string, newOwner: string, shardId: number) => {
    await timelockChangeOwner(target, newOwner, shardId);
  });

export const timelockCommands = program;
