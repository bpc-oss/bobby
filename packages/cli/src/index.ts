#!/usr/bin/env node
import {
  KernelHost,
  makeDeepSeekClientFromBobbyConfig,
  probeAndWriteCapabilities,
  type ModelClient
} from '@bobby/kernel';
import { runHeadless } from './headless';
import { pathToFileURL } from 'node:url';

export type CliIO = {
  argv: string[];
  log: (msg: string) => void;
  exit: (code: number) => void | never;
};

export async function makeDefaultModel(): Promise<ModelClient> {
  return makeDeepSeekClientFromBobbyConfig();
}

const setupPrompt =
  'Bobby CLI — Configure DeepSeek Key before running (see M6).';

type RunCliOptions = {
  makeModel?: () => Promise<ModelClient>;
  probe?: () => Promise<string>;
};

function printHelp(io: CliIO): void {
  io.log(setupPrompt);
  io.log('Usage: bobby run "<task>" | bobby interactive | bobby probe');
}

export async function runCli(io: CliIO, options: RunCliOptions = {}): Promise<void> {
  const [cmd, ...args] = io.argv;

  if (!cmd) {
    io.log(setupPrompt);
    return;
  }

  if (cmd === 'run') {
    const task = args.join(' ').trim();
    if (!task) {
      printHelp(io);
      io.exit(1);
      return;
    }

    try {
      const model = await (options.makeModel ?? makeDefaultModel)();
      const host = new KernelHost(() => model);
      const result = await runHeadless(host, task);
      io.exit(result.exitCode);
    } catch (err) {
      if (err instanceof Error) {
        io.log(err.message);
      } else {
        io.log(String(err));
      }
      io.exit(1);
    }
    return;
  }

  if (cmd === 'interactive') {
    io.log('Interactive mode not enabled in this milestone yet.');
    return;
  }

  if (cmd === 'probe') {
    try {
      const reportPath = await (options.probe ?? probeAndWriteCapabilities)();
      io.log(`DeepSeek capability report written to: ${reportPath}`);
    } catch (err) {
      if (err instanceof Error) {
        io.log(err.message);
      } else {
        io.log(String(err));
      }
      io.exit(1);
    }
    return;
  }

  io.log(`Unknown command: ${cmd}`);
  io.log('Supported commands: run, interactive, probe');
  io.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCli({
    argv: process.argv.slice(2),
    log: console.log,
    exit: process.exit
  });
}
