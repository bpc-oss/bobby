import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import type { KernelCommand, KernelEvent } from '@bobby/shared';
import type { KernelHost } from '@bobby/kernel';
import { runCli } from '../src/index';
import { runHeadless } from '../src/headless';
import { App } from '../src/ui/App';
import { initialVM } from '../src/ui/view-model';
import { parseInputLine, type SlashCommandInput, type UnknownSlashCommandInput } from '../src/ui/input-commands';
import { loadInteractionFixtures, assertOrderedContainments, type AssertionSet } from './transcript-fixtures';

type TestIO = {
  argv: string[];
  log: (msg: string) => void;
  exit: (code: number) => void;
};

type CommandCallback = (command: SlashCommandInput | UnknownSlashCommandInput) => void;
type TranscriptFixture = ReturnType<typeof loadInteractionFixtures>[number];
type SlashHost = {
  subscribe: (handler: (event: KernelEvent) => void) => () => void;
  send: (command: KernelCommand) => Promise<void>;
};
type SlashHarness = {
  host?: SlashHost;
  onSlashCommand?: CommandCallback;
};

let capturedCommand: CommandCallback | null = null;

vi.mock('../src/ui/InputBox', () => ({
  InputBox: ({
    onCommand
  }: {
    onCommand?: CommandCallback;
  }) => {
    capturedCommand = onCommand ?? null;
    return <Text>input</Text>;
  }
}));

type HeadlessFixture = ReturnType<typeof loadInteractionFixtures>[number] & { kind: 'headless' };
type RunFixture = ReturnType<typeof loadInteractionFixtures>[number] & { kind: 'run' };
type SlashFixture = ReturnType<typeof loadInteractionFixtures>[number] & { kind: 'slash' };

const createHeadlessHost = (events: KernelEvent[]) => ({
  subscribe: (handler: (event: KernelEvent) => void) => {
    for (const event of events) {
      handler(event);
    }
    return () => undefined;
  },
  send: async () => undefined
});

const runFixtureHeadless = async (fixture: HeadlessFixture): Promise<{ logs: string[]; exitCode: number; status: string }> => {
  const logs: string[] = [];
  const host = createHeadlessHost(fixture.events) as unknown as KernelHost;
  const result = await runHeadless(host, fixture.input, (msg) => {
    logs.push(msg);
  });

  if (fixture.assertions.orderedLines) {
    assertOrderedContainments(logs.join('\n'), fixture.assertions.orderedLines);
  }

  return {
    logs,
    exitCode: result.exitCode,
    status: result.status
  };
};

type RunResult = {
  logs: string[];
  exits: number[];
  workspaceRoot: string;
};

const runFixtureRun = async (fixture: RunFixture): Promise<RunResult> => {
  const originalCwd = process.cwd();
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'bobby-parity-run-'));
  const logs: string[] = [];
  const exits: number[] = [];
  const io: TestIO = {
    argv: fixture.argv,
    log: (msg: string) => {
      logs.push(msg);
    },
    exit: (code: number) => {
      exits.push(code);
    }
  };

  try {
    process.chdir(workspaceRoot);

    if (fixture.environment.homeMode === 'ready') {
      const bobbyDir = join(workspaceRoot, '.bobby');
      mkdirSyncIfNeeded(bobbyDir);
      if (fixture.environment.hasKey ?? true) {
        writeFileSync(join(bobbyDir, 'key'), 'deepseek-key\n');
      }
      if (fixture.environment.hasCapabilities ?? true) {
        writeFileSync(join(bobbyDir, 'capabilities.json'), '{}\n');
      }
    }

    await runCli(io, {
      onboarding: { homeDir: workspaceRoot }
    });
  } finally {
    process.chdir(originalCwd);
  }

  return { logs, exits, workspaceRoot };
};

const mkdirSyncIfNeeded = (path: string): void => {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
};

const normalizeOutput = (logs: string[]): string => logs.join('\n');

const applyAssertions = (output: string, assertions: AssertionSet, workspaceRoot?: string): void => {
  for (const expected of assertions.contains ?? []) {
    expect(output).toContain(expected);
  }

  for (const unexpected of assertions.notContains ?? []) {
    expect(output).not.toContain(unexpected);
  }

  for (const required of assertions.notExist ?? []) {
    if (!workspaceRoot) {
      throw new Error('notExist assertions require workspaceRoot in run fixtures');
    }
    expect(existsSync(join(workspaceRoot, required as string))).toBe(false);
  }
};

const runHeadlessCase = async (fixture: HeadlessFixture): Promise<void> => {
  const result = await runFixtureHeadless(fixture);

  applyAssertions(result.logs.join('\n'), fixture.assertions);
  expect(result.exitCode).toBe(fixture.assertions.exitCode ?? 0);
  expect(['done', 'failed', 'blocked']).toContain(result.status);
};

const runCase = async (fixture: RunFixture): Promise<void> => {
  const result = await runFixtureRun(fixture);
  try {
    const output = normalizeOutput(result.logs);
    applyAssertions(output, fixture.assertions, result.workspaceRoot);
    expect(result.exits).toEqual([fixture.assertions.exitCode]);
  } finally {
    rmSync(result.workspaceRoot, { force: true, recursive: true });
  }
};

const flushInk = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const createHostEmptySlashHarness = (): SlashHarness => {
  let emitSlashEvent: (event: KernelEvent) => void = () => {};
  const host = {
    subscribe: (handler: (event: KernelEvent) => void) => {
      emitSlashEvent = handler;
      return () => {
        emitSlashEvent = () => {};
      };
    },
    send: async (command: KernelCommand): Promise<void> => {
      if (command.type === 'listAgents') {
        emitSlashEvent({ type: 'direct_answer', taskId: 'system', text: 'agents: no agents' });
        return;
      }

      if (command.type === 'restoreSnapshot') {
        emitSlashEvent({ type: 'direct_answer', taskId: 'system', text: 'undo: no snapshots available' });
        return;
      }

      if (command.type === 'resumeSession') {
        emitSlashEvent({ type: 'direct_answer', taskId: 'system', text: 'resume: no resumable trace in current process' });
        return;
      }
    }
  } satisfies SlashHost;

  return {
    host,
    onSlashCommand: async (command) => {
      if (command.command === 'agents') {
        await host.send({ type: 'listAgents' });
        return;
      }

      if (command.command === 'undo') {
        await host.send({ type: 'restoreSnapshot', snapshotId: undefined });
        return;
      }

      if (command.command === 'resume') {
        await host.send({ type: 'resumeSession' });
        return;
      }
    }
  };
};

const createSlashHarness = (fixture: SlashFixture): SlashHarness => {
  if (fixture.handler === 'host-empty') {
    return createHostEmptySlashHarness();
  }

  return {};
};

const runSlashCase = async (fixture: SlashFixture): Promise<void> => {
  capturedCommand = null;
  const harness = createSlashHarness(fixture);
  const onSubmit = vi.fn();

  const { lastFrame } = render(
    <App
      initialVm={initialVM()}
      host={harness.host as KernelHost | undefined}
      onSubmit={onSubmit}
      onGate={() => undefined}
      onSlashCommand={harness.onSlashCommand}
    />
  );

  if (harness.host) {
    await flushInk();
  }

  if (!capturedCommand) {
    throw new Error('Input command callback not captured');
  }

  const commandHandler: CommandCallback = capturedCommand;
  const rawInput = fixture.command.raw ?? `/${fixture.command.name}${fixture.command.args.length ? ` ${fixture.command.args.join(' ')}` : ''}`;
  const parsedInput = parseInputLine(rawInput);

  if (parsedInput.kind === 'text') {
    throw new Error(`Expected parsed slash input, got text for "${rawInput}"`);
  }

  commandHandler(parsedInput);

  await flushInk();

  const output = lastFrame() ?? '';
  applyAssertions(output, fixture.assertions);
  expect(onSubmit).not.toHaveBeenCalled();
  expect(output).not.toContain('not wired yet');
};

const runFixture = async (fixture: TranscriptFixture): Promise<void> => {
  if (fixture.kind === 'headless') {
    return runHeadlessCase(fixture);
  }
  if (fixture.kind === 'run') {
    return runCase(fixture);
  }

  return runSlashCase(fixture);
};

describe('CLI parity transcript fixtures', () => {
  for (const fixture of loadInteractionFixtures()) {
    it(`transcript baseline: ${fixture.description}`, () => runFixture(fixture));
  }
});
