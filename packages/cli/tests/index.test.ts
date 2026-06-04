import { describe, expect, it } from 'vitest';

import { runCli } from '../src/index';

const collectOutput = (): {
  logs: string[];
  exits: number[];
  io: { argv: string[]; log: (msg: string) => void; exit: (code: number) => void };
} => {
  const logs: string[] = [];
  const exits: number[] = [];

  return {
    logs,
    exits,
    io: {
      argv: [],
      log: (msg) => {
        logs.push(msg);
      },
      exit: (code) => {
        exits.push(code);
      }
    }
  };
};

describe('runCli', () => {
  it('prints setup prompt when no arguments are provided', async () => {
    const { io, logs, exits } = collectOutput();
    io.argv = [];

    await runCli(io);

    expect(logs.join('\n')).toContain('Bobby CLI');
    expect(logs.join('\n')).toContain('配置 DeepSeek Key 后开始（见 M6）');
    expect(exits).toHaveLength(0);
  });

  it('exits with code 1 for unknown commands', async () => {
    const { io, logs, exits } = collectOutput();
    io.argv = ['unknown'];

    await runCli(io);

    expect(logs.join('\n')).toContain('未知');
    expect(exits).toEqual([1]);
  });

  it('prints model-not-configured error and exits 1 for run', async () => {
    const { io, logs, exits } = collectOutput();
    io.argv = ['run', 'do', 'task'];

    await runCli(io);

    expect(logs.join('\n')).toContain('未配置模型');
    expect(exits).toEqual([1]);
  });
});
