import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeEach, expect, it, vi } from 'vitest';

import type { ModelClient } from '@bobby/kernel';
import { isCliEntrypoint, runCli } from '../src/index';
import { runHeadless } from '../src/headless';
import { readDeepSeekKeyFromEnv } from '../src/onboarding';

vi.mock('../src/headless', () => ({
  runHeadless: vi.fn()
}));

beforeEach(() => {
  vi.clearAllMocks();
});

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

it('prints onboarding when no arguments are provided before setup is ready', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'bobby-onboarding-'));
  const { io, logs, exits } = collectOutput();
  io.argv = [];

  try {
    await runCli(io, {
      onboarding: {
        homeDir: tempDir,
        env: {}
      }
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }

  expect(logsText(logs)).toContain('Bobby');
  expect(logsText(logs)).toContain('Status');
  expect(logsText(logs)).toContain('bobby login');
  expect(exits).toHaveLength(0);
});

it('starts interactive mode by default when setup is ready and a terminal is available', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'bobby-interactive-'));
  const { io, logs, exits } = collectOutput();
  io.argv = [];
  const answers = ['hello world', '/exit'];

  try {
    mkdirSync(join(tempDir, '.bobby'));
    writeFileSync(join(tempDir, '.bobby', 'key'), 'deepseek-key\n');
    writeFileSync(join(tempDir, '.bobby', 'capabilities.json'), '{}\n');

    const mockedRunHeadless = vi.mocked(runHeadless);
    mockedRunHeadless.mockResolvedValueOnce({ exitCode: 0, status: 'done' });
    const model: ModelClient = { complete: vi.fn() };

    await runCli(io, {
      onboarding: {
        homeDir: tempDir,
        env: {}
      },
      interactive: {
        ask: async () => answers.shift()
      },
      makeModel: async () => model
    });

    expect(logsText(logs)).toContain('Bobby interactive');
    expect(mockedRunHeadless).toHaveBeenCalledWith(expect.anything(), 'hello world', expect.any(Function));
    expect(logsText(logs)).toContain('bye');
    expect(exits).toHaveLength(0);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

it('does not start forced interactive mode before setup is ready', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'bobby-interactive-not-ready-'));
  const { io, logs, exits } = collectOutput();
  io.argv = ['interactive'];
  const ask = vi.fn();

  try {
    await runCli(io, {
      onboarding: {
        homeDir: tempDir,
        env: {}
      },
      interactive: {
        ask
      }
    });

    expect(logsText(logs)).toContain('DeepSeek key: missing');
    expect(logsText(logs)).toContain('Capability probe: missing');
    expect(logsText(logs)).toContain('bobby login');
    expect(ask).not.toHaveBeenCalled();
    expect(exits).toEqual([1]);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

it('does not run tasks before setup is ready', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'bobby-run-not-ready-'));
  const { io, logs, exits } = collectOutput();
  io.argv = ['run', 'hello world'];

  try {
    await runCli(io, {
      onboarding: {
        homeDir: tempDir,
        env: {}
      }
    });

    expect(logsText(logs)).toContain('DeepSeek key: missing');
    expect(logsText(logs)).toContain('Capability probe: missing');
    expect(vi.mocked(runHeadless)).not.toHaveBeenCalled();
    expect(exits).toEqual([1]);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

it('recognizes the CLI entrypoint when argv uses a linked install path', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'bobby-cli-entry-'));
  const realDir = join(tempDir, 'real');
  const linkedDir = join(tempDir, 'linked');
  const realEntrypoint = join(realDir, 'index.js');
  const linkedEntrypoint = join(linkedDir, 'index.js');

  try {
    mkdirSync(realDir);
    writeFileSync(realEntrypoint, '', { flag: 'w' });
    symlinkSync(realDir, linkedDir, 'junction');

    expect(isCliEntrypoint(linkedEntrypoint, pathToFileURL(realEntrypoint).href)).toBe(true);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

it('exits with code 1 for unknown commands and lists supported commands including probe', async () => {
  const { io, logs, exits } = collectOutput();

  await runWithDefaultClient(io, ['unknown']);

  const output = logsText(logs);
  expect(output).toContain('Unknown command');
  expect(output).toContain('Supported commands: login, run, interactive, probe, help');
  expect(exits).toEqual([1]);
});

it('imports DeepSeek key from env during login without logging the key', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'bobby-login-'));
  const { io, logs, exits } = collectOutput();
  io.argv = ['login', '--from-env'];

  try {
    await runCli(io, {
      onboarding: {
        homeDir: tempDir,
        env: {
          DEEPSEEK_API_KEY: 'deepseek-key'
        }
      },
      probe: async () => join(tempDir, '.bobby', 'capabilities.json')
    });

    const output = logsText(logs);
    expect(readFileSync(join(tempDir, '.bobby', 'key'), 'utf8')).toBe('deepseek-key\n');
    expect(output).toContain('DeepSeek key saved to:');
    expect(output).toContain('Capability report written to:');
    expect(output).not.toContain('deepseek-key');
    expect(exits).toHaveLength(0);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

it('can read DeepSeek key from a system environment fallback', () => {
  const key = readDeepSeekKeyFromEnv({
    env: {},
    execFileSync: () => 'deepseek-key\n'
  });

  expect(key).toBe('deepseek-key');
});

it('prints model configuration errors and exits 1 for run', async () => {
  const { io, logs, exits } = collectOutput();
  io.argv = ['run', 'do', 'task'];

  await runCli(io, {
    makeModel: async () => {
      throw new Error('DeepSeek Key is required');
    }
  });

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
