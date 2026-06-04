#!/usr/bin/env node
import { KernelHost } from '@bobby/kernel';
import { runHeadless } from './headless';
import { pathToFileURL } from 'node:url';

export type CliIO = {
  argv: string[];
  log: (msg: string) => void;
  exit: (code: number) => void | never;
};

export function makeDefaultModel(): never {
  throw new Error('未配置模型：请在 M6 后配置 DeepSeek Key');
}

const setupPrompt =
  'Bobby CLI — 配置 DeepSeek Key 后开始（见 M6）。';

function printHelp(io: CliIO): void {
  io.log(setupPrompt);
  io.log('用法：bobby run "<task>" | bobby interactive');
}

export async function runCli(io: CliIO): Promise<void> {
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

    const host = new KernelHost(makeDefaultModel);
    try {
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
    io.log('交互式模式尚未接入，见 M6 后开放。');
    return;
  }

  io.log(`未知命令: ${cmd}`);
  io.log('支持命令: run（bobby run "<task>"）或 interactive');
  io.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCli({
    argv: process.argv.slice(2),
    log: console.log,
    exit: process.exit
  });
}
