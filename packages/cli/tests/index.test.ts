import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/headless', () => ({
  runHeadless: vi.fn()
}));

import type { ModelClient } from '@bobby/kernel';
import { runCli } from '../src/index';
import { runHeadless } from '../src/headless';

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

  it('prints configuration error and exits 1 for run', async () => {
    const { io, logs, exits } = collectOutput();
    io.argv = ['run', 'do', 'task'];

    await runCli(io);

    expect(logs.join('\n')).toContain('未配置');
    expect(logs.join('\n')).not.toContain('deepseek-key');
    expect(exits).toEqual([1]);
  });

  it('uses injected makeModel for run and exits with headless result', async () => {
    const { io, exits } = collectOutput();
    io.argv = ['run', 'hello', 'world'];

    const mockedRunHeadless = vi.mocked(runHeadless);
    mockedRunHeadless.mockResolvedValueOnce({ exitCode: 0, status: 'done' });

    const model: ModelClient = { complete: vi.fn() };

    await runCli(io, { makeModel: async () => model });

    expect(mockedRunHeadless).toHaveBeenCalledTimes(1);
    expect(exits).toEqual([0]);
  });
});
