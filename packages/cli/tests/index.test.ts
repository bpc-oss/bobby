import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeEach, expect, it, vi } from 'vitest';
import * as interactive from '../src/interactive';

import { MockModelClient, type ModelClient } from '@bobby/kernel';
import type { KernelEvent } from '@bobby/shared';
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

it('shows all slash commands in interactive help output', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'bobby-interactive-help-'));
  const { io, logs, exits } = collectOutput();
  io.argv = ['interactive'];
  const answers = ['/help', '/exit'];

  try {
    mkdirSync(join(tempDir, '.bobby'));
    writeFileSync(join(tempDir, '.bobby', 'key'), 'deepseek-key\n');
    writeFileSync(join(tempDir, '.bobby', 'capabilities.json'), '{}\n');

    await runCli(io, {
      onboarding: {
        homeDir: tempDir,
        env: {}
      },
      interactive: {
        ask: async () => answers.shift()
      }
    });

    const output = logsText(logs);
    expect(output).toContain('Interactive commands');
    expect(output).toContain('<task>');
    expect(output).toContain('/status');
    expect(output).toContain('/probe');
    expect(output).toContain('/help');
    expect(output).toContain('/exit');
    expect(output).toContain('/clear');
    expect(output).toContain('/cost');
    expect(output).toContain('/undo');
    expect(output).toContain('/agents');
    expect(output).toContain('/resume');
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

it('clarifies degraded run input before setup preflight', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'bobby-run-unclear-not-ready-'));
  const { io, logs, exits } = collectOutput();
  const mockedRunHeadless = vi.mocked(runHeadless);
  io.argv = ['run', 'a'];

  try {
    mockedRunHeadless.mockResolvedValueOnce({ exitCode: 0, status: 'done' });

    await runCli(io, {
      onboarding: {
        homeDir: tempDir,
        env: {},
        execFileSync: () => ''
      }
    });

    const output = logsText(logs);
    expect(output).not.toContain('DeepSeek key: missing');
    expect(output).not.toContain('Capability probe: missing');
    expect(mockedRunHeadless).toHaveBeenCalledWith(expect.anything(), 'a', expect.any(Function));
    expect(exits).toEqual([0]);
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
  expect(output).toContain('Supported commands: login, run, interactive, status, probe, help');
  expect(exits).toEqual([1]);
});

it('prints onboarding status for status command, exits 0, and stays read-only', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'bobby-status-'));
  const { io, logs, exits } = collectOutput();
  io.argv = ['status'];
  const runHeadlessMock = vi.mocked(runHeadless);
  const interactiveSessionSpy = vi.spyOn(interactive, 'runInteractiveSession');

  try {
    await runCli(io, {
      onboarding: {
        homeDir: tempDir,
        env: {}
      }
    });

    const output = logsText(logs);
    expect(output).toContain('Status');
    expect(output).toContain('bobby status          Show Bobby setup status');
    expect(output).toContain('DeepSeek key: missing (~/.bobby/key)');
    expect(output).toContain('Capability probe: missing (~/.bobby/capabilities.json)');
    expect(output).not.toContain('abc-SECRET-key');
    expect(runHeadlessMock).not.toHaveBeenCalled();
    expect(interactiveSessionSpy).not.toHaveBeenCalled();
    expect(exits).toEqual([0]);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

it('prints configured values when key and capabilities are present', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'bobby-status-configured-'));
  const { io, logs, exits } = collectOutput();
  io.argv = ['status'];
  const keyPath = join(tempDir, '.bobby', 'key');
  const capabilitiesPath = join(tempDir, '.bobby', 'capabilities.json');

  try {
    mkdirSync(join(tempDir, '.bobby'));
    writeFileSync(keyPath, 'abc-SECRET-key\n', { encoding: 'utf8' });
    writeFileSync(capabilitiesPath, '{}\n', { encoding: 'utf8' });

    await runCli(io, {
      onboarding: {
        homeDir: tempDir,
        env: {}
      }
    });

    const output = logsText(logs);
    expect(output).toContain('Status');
    expect(output).toContain('DeepSeek key: configured (~/.bobby/key)');
    expect(output).toContain('Capability probe: ready (~/.bobby/capabilities.json)');
    expect(output).not.toContain('abc-SECRET-key');
    expect(exits).toEqual([0]);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
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

const createDefaultConscienceRegressionModel = (): MockModelClient => {
  const contract = {
    goal: 'Create hello.txt with exactly hi',
    acceptanceCriteria: [
      { id: 'AC1', desc: 'A command verification runs successfully', oracleHint: 'run' },
      { id: 'AC2', desc: "hello.txt contains exactly 'hi'", oracleHint: 'file' }
    ],
    constraints: [],
    inputs: ['hello.txt'],
    outOfScope: []
  };
  const steps = [
    { id: 'S1', desc: 'write and verify', satisfiesAcIds: ['AC1', 'AC2'], dependsOn: [] }
  ];
  const runnerCalls = {
    calls: [
      { tool: 'exec', input: { cmd: 'node', args: ['-e', 'process.exit(1)'] } },
      { tool: 'write_file', input: { path: 'hello.txt', content: 'hi' } }
    ]
  };
  const graderCalls = {
    calls: [{ tool: 'exec', input: { cmd: 'node', args: ['-e', 'process.exit(1)'] } }]
  };

  return new MockModelClient({
    grader: [JSON.stringify(contract), JSON.stringify(steps), JSON.stringify(graderCalls)],
    runner: [JSON.stringify(runnerCalls)]
  });
};

async function runDefaultConscienceRegression(io: TestIO['io'], events: KernelEvent[]): Promise<void> {
  const model = createDefaultConscienceRegressionModel();
  vi.mocked(runHeadless).mockImplementationOnce(async (host, task) => {
    host.subscribe((event) => events.push(event));
    host.subscribe((event) => {
      if (event.type === 'plan_ready' && event.taskId) {
        void host.send({ type: 'planDecision', taskId: event.taskId, decision: 'approve' });
      }
    });
    await host.send({ type: 'startTask', input: task });
    return { exitCode: 1, status: 'failed' };
  });

  await runCli(io, {
    makeModel: async () => model
  });
}

it('default conscience keeps file AC verdicts from being polluted by failing command evidence', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'bobby-cli-default-conscience-'));
  const originalCwd = process.cwd();
  const { io, exits } = collectOutput();
  const events: KernelEvent[] = [];
  io.argv = ['run', 'Create hello.txt with exactly hi'];

  try {
    process.chdir(tempDir);
    await runDefaultConscienceRegression(io, events);
  } finally {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  }

  const verdicts = events
    .filter((event): event is Extract<KernelEvent, { type: 'verdict' }> => event.type === 'verdict')
    .map((event) => [event.verdict.acId, event.verdict.result]);
  const ac2EvidenceTypes = events
    .filter((event): event is Extract<KernelEvent, { type: 'evidence_produced' }> => {
      return event.type === 'evidence_produced' && event.evidence.acId === 'AC2';
    })
    .map((event) => event.evidence.evidenceType);

  expect(ac2EvidenceTypes).not.toContain('command_output');
  expect(verdicts).toContainEqual(['AC1', 'fail']);
  expect(verdicts).toContainEqual(['AC2', 'pass']);
  expect(exits).toEqual([1]);
});
