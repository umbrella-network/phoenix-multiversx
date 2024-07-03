import { Command } from 'commander';
import {envChain} from "xsuite";

import {
  timelockChangeOwner, timelockDiscardCall, timelockImportAddresses,
  timelockPerformNextCall,
  timelockPrintPendingCalls,
  timelockStatus
} from "./actions/timelockActions";
import {DataJson} from "./types";
import data from "./data.json";


const program = new Command();

/*
npm run interact:devnet performNextCall --shardId 1 [gas]
*/
program.command('performNextCall')
  .argument('[shardId]', 'Shard number')
  .argument('[gas]', 'gas limit in milions', 10)
  .action(async (shardId: number, gas: number) => {
    await timelockPerformNextCall(shardId, gas * 1_000_000);
  });

/*
npm run interact:devnet timelockDiscardCall --shardId 1
*/
program.command('timelockDiscardCall')
  .argument('[shardId]', 'Shard number')
  .argument('[execute]', 'TRUE is tx should be executed', false)
  .action(async (shardId: number, execute: boolean) => {
    await timelockDiscardCall(shardId, execute);
  });

/*
npm run interact:devnet timelockImportAddresses --shardId 1
*/
program.command('timelockImportAddresses')
  .argument('[shardId]', 'Shard number')
  .argument('[name]', 'contract name')
  .argument('[address]', 'contract address')
  .argument('[execute]', 'TRUE is tx should be executed', false)
  .action(async (shardId: number, name: string, address: string, execute: boolean) => {
    await timelockImportAddresses(shardId, name, address, execute);
  });

/*
npm run interact:devnet timelockPrintState
*/
program.command('timelockPrintState')
  .action(async () => {
    await timelockStatus();
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
  .argument('[targetName]', 'contract address name', '')
  .argument('[newOwner]', 'The address of new owner', '')
  .argument('[shardId]', 'Shard number')
  .argument('[execute]', 'TRUE is tx should be executed', false)
  .action(async (targetName: keyof DataJson | string, newOwner: string, shardId: number, execute: boolean) => {
    await timelockChangeOwner(data[targetName][envChain.name()] || targetName, newOwner, shardId, execute);
  });

export const timelockCommands = program;
