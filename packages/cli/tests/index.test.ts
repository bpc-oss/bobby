import { expect, it, vi } from 'vitest';

import type { ModelClient } from '@bobby/kernel';
import { runCli } from '../src/index';
import { runHeadless } from '../src/headless';

vi.mock('../src/headless', () => ({
  runHeadless: vi.fn()
}));

type TestIO = {
  io: {
    argv: string[];
    log: (msg: string) => void;
    exit: (code: number) => void;
  };
  logs: string[];
  exits: number[];
};

const collectOutput = (): TestIO => {
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

const logsText = (logs: string[]): string => logs.join('\n');

const runWithDefaultClient = async (io: TestIO['io'], command: string[], probePath?: string): Promise<void> => {
  io.argv = command;
  await runCli(
    io,
    probePath
      ? {
          probe: async () => probePath
        }
      : undefined
  );
};

it('prints setup prompt when no arguments are provided', async () => {
  const { io, logs, exits } = collectOutput();
  io.argv = [];

  await runCli(io);

  expect(logsText(logs)).toContain('Bobby CLI');
  expect(logsText(logs)).toContain('Configure DeepSeek Key');
  expect(exits).toHaveLength(0);
});

it('exits with code 1 for unknown commands and lists supported commands including probe', async () => {
  const { io, logs, exits } = collectOutput();

  await runWithDefaultClient(io, ['unknown']);

  const output = logsText(logs);
  expect(output).toContain('Unknown command');
  expect(output).toContain('Supported commands: run, interactive, probe');
  expect(exits).toEqual([1]);
});

it('prints configuration error and exits 1 for run', async () => {
  const { io, logs, exits } = collectOutput();

  await runWithDefaultClient(io, ['run', 'do', 'task']);

  expect(logsText(logs)).toContain('DeepSeek Key');
  expect(logsText(logs)).not.toContain('deepseek-key');
  expect(exits).toEqual([1]);
});

it('writes capability report with probe and does not log secrets', async () => {
  const { io, logs, exits } = collectOutput();

  await runWithDefaultClient(io, ['probe'], '/tmp/bobby/.bobby/capabilities.json');

  expect(logsText(logs)).toContain(
    'DeepSeek capability report written to: /tmp/bobby/.bobby/capabilities.json'
  );
  expect(logsText(logs)).not.toContain('deepseek-key');
  expect(exits).toHaveLength(0);
});

it('uses injected makeModel for run and exits with headless result', async () => {
  const { io, exits } = collectOutput();
  io.argv = ['run', 'hello', 'world'];

  const mockedRunHeadless = vi.mocked(runHeadless);
  mockedRunHeadless.mockResolvedValueOnce({ exitCode: 0, status: 'done' });

  const model: ModelClient = { complete: vi.fn() };

  await runCli(io, {
    makeModel: async () => model
  });

  expect(mockedRunHeadless).toHaveBeenCalledTimes(1);
  expect(exits).toEqual([0]);
});
