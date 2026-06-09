import { expect, it, vi } from 'vitest';
import type { SlashCommandInput } from '../src/ui/input-commands';

import { runInteractiveSession, type InteractiveDeps, type InteractiveIO } from '../src/interactive';

type SubmitCallback = (value: string) => Promise<void>;
type HostStub = {
  subscribe: (fn: (event: unknown) => void) => () => void;
  send: ReturnType<typeof vi.fn>;
};

let capturedSubmit: SubmitCallback | null = null;
let capturedCommand: ((command: SlashCommandInput) => void) | null = null;

vi.mock('../src/ui/App', () => ({
  App: ({
    onSubmit,
    onSlashCommand
  }: {
    onSubmit: SubmitCallback;
    onSlashCommand?: (command: SlashCommandInput) => void;
  }) => {
    capturedSubmit = onSubmit;
    capturedCommand = onSlashCommand ?? null;
    return null;
  }
}));

const createTTYDeps = (): InteractiveDeps => ({
  stdin: { isTTY: true } as NodeJS.ReadStream,
  stdout: { isTTY: true } as NodeJS.WriteStream
});

const runLine = async (handlers: {
  runTask: ReturnType<typeof vi.fn>;
  createHost: ReturnType<typeof vi.fn>;
  printHelp: ReturnType<typeof vi.fn>;
  printStatus: ReturnType<typeof vi.fn>;
  probe: ReturnType<typeof vi.fn>;
}, lines: string[]): Promise<{ session: Promise<void>; io: InteractiveIO }> => {
  const io: InteractiveIO = { log: vi.fn() };
  let index = 0;
  const session = runInteractiveSession(io, handlers, {
    ask: async () => {
      const value = lines[index];
      index += 1;
      return value;
    }
  });

  return { session, io };
};

const runInk = async (handlers: {
  runTask: ReturnType<typeof vi.fn>;
  createHost: ReturnType<typeof vi.fn>;
  printHelp: ReturnType<typeof vi.fn>;
  printStatus: ReturnType<typeof vi.fn>;
  probe: ReturnType<typeof vi.fn>;
}): Promise<{ session: Promise<void>; submit: SubmitCallback; io: InteractiveIO }> => {
  capturedSubmit = null;
  const io: InteractiveIO = { log: vi.fn() };
  const session = runInteractiveSession(io, handlers, createTTYDeps());

  for (let i = 0; i < 25; i += 1) {
    if (capturedSubmit) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  if (!capturedSubmit) {
    throw new Error('Ink App submit callback was not captured');
  }

  return { session, submit: capturedSubmit, io };
};

it('sends normal Ink input through host.startTask command', async () => {
  const host: HostStub = {
    subscribe: vi.fn(() => vi.fn()),
    send: vi.fn(async () => undefined)
  };
  const handlers = {
    runTask: vi.fn(async () => 0),
    createHost: vi.fn(async () => host),
    printHelp: vi.fn(),
    printStatus: vi.fn(),
    probe: vi.fn(async () => 0)
  };

  const { session, submit } = await runInk(handlers);

  await submit('hello');
  expect(handlers.runTask).not.toHaveBeenCalled();
  expect(host.send).toHaveBeenCalledWith({ type: 'startTask', input: 'hello' });

  await submit('/exit');
  await session;
});

it('handles /help in Ink mode without sending host commands', async () => {
  const host: HostStub = {
    subscribe: vi.fn(() => vi.fn()),
    send: vi.fn(async () => undefined)
  };
  const handlers = {
    runTask: vi.fn(async () => 0),
    createHost: vi.fn(async () => host),
    printHelp: vi.fn(),
    printStatus: vi.fn(),
    probe: vi.fn(async () => 0)
  };

  const { session, submit } = await runInk(handlers);

  await submit('/help');
  expect(handlers.printHelp).toHaveBeenCalledTimes(1);
  expect(host.send).not.toHaveBeenCalled();

  await submit('/exit');
  await session;
});

it('treats unknown slash commands as local unknown-command input in line mode', async () => {
  const handlers = {
    runTask: vi.fn(async () => 0),
    createHost: vi.fn(async () => ({ subscribe: vi.fn(), send: vi.fn(async () => undefined) })),
    printHelp: vi.fn(),
    printStatus: vi.fn(),
    probe: vi.fn(async () => 0)
  };

  const { session, io } = await runLine(handlers, ['/not-real args', '/exit']);

  expect(handlers.runTask).not.toHaveBeenCalled();
  const logs = (io.log as ReturnType<typeof vi.fn>).mock.calls.map((args) => args[0]).join('\n');
  expect(logs).toContain('unknown command: /not-real args');
  expect(logs).toContain('commands: /help /clear /status /probe /cost /undo /agents /resume /exit');

  await session;
});

it.each([
  '/help details',
  '/status now',
  '/exit now'
])('shows user-friendly response for unsupported args on known slash command %s in line mode', async (input) => {
  const handlers = {
    runTask: vi.fn(async () => 0),
    createHost: vi.fn(async () => ({ subscribe: vi.fn(), send: vi.fn(async () => undefined) })),
    printHelp: vi.fn(),
    printStatus: vi.fn(),
    probe: vi.fn(async () => 0)
  };

  const { session, io } = await runLine(handlers, [input, '/exit']);

  expect(handlers.runTask).not.toHaveBeenCalled();
  const logs = (io.log as ReturnType<typeof vi.fn>).mock.calls.map((args) => args[0]).join('\n');
  expect(logs).toContain(`unknown command: ${input}`);
  expect(logs).toContain('commands: /help /clear /status /probe /cost /undo /agents /resume /exit');
  expect(logs).not.toContain('command handler unavailable in this UI session');
  expect(logs).not.toContain('not wired yet');

  await session;
});

it('does not runTask for unsupported known slash commands in line mode', async () => {
  const handlers = {
    runTask: vi.fn(async () => 0),
    createHost: vi.fn(async () => ({ subscribe: vi.fn(), send: vi.fn(async () => undefined) })),
    printHelp: vi.fn(),
    printStatus: vi.fn(),
    probe: vi.fn(async () => 0)
  };

  const { session, io } = await runLine(handlers, ['/undo', '/exit']);

  expect(handlers.runTask).not.toHaveBeenCalled();
  const logs = (io.log as ReturnType<typeof vi.fn>).mock.calls.map((args) => args[0]).join('\n');
  expect(logs).toContain('undo: no snapshots available');
  expect(logs).toContain('commands: /help /clear /status /probe /cost /undo /agents /resume /exit');
  expect(logs).not.toContain('command handler unavailable in this UI session');
  expect(logs).not.toContain('not wired yet');

  await session;
});

it('shows empty-state response for /cost in line mode', async () => {
  const handlers = {
    runTask: vi.fn(async () => 0),
    createHost: vi.fn(async () => ({ subscribe: vi.fn(), send: vi.fn(async () => undefined) })),
    printHelp: vi.fn(),
    printStatus: vi.fn(),
    probe: vi.fn(async () => 0)
  };

  const { session, io } = await runLine(handlers, ['/cost', '/exit']);

  expect(handlers.runTask).not.toHaveBeenCalled();
  const logs = (io.log as ReturnType<typeof vi.fn>).mock.calls.map((args) => args[0]).join('\n');
  expect(logs).toContain('cost: no usage data yet');
  expect(logs).toContain('commands: /help /clear /status /probe /cost /undo /agents /resume /exit');
  expect(logs).not.toContain('command handler unavailable in this UI session');
  expect(logs).not.toContain('not wired yet');

  await session;
});

it('handles /clear in line mode with transcript-cleared short response', async () => {
  const handlers = {
    runTask: vi.fn(async () => 0),
    createHost: vi.fn(async () => ({ subscribe: vi.fn(), send: vi.fn(async () => undefined) })),
    printHelp: vi.fn(),
    printStatus: vi.fn(),
    probe: vi.fn(async () => 0)
  };

  const { session, io } = await runLine(handlers, ['/clear', '/exit']);

  expect(handlers.runTask).not.toHaveBeenCalled();
  const logs = (io.log as ReturnType<typeof vi.fn>).mock.calls.map((args) => args[0]).join('\n');
  expect(logs).toContain('clear: transcript cleared');
  expect(logs).toContain('commands: /help /clear /status /probe /cost /undo /agents /resume /exit');
  expect(logs).not.toContain('command handler unavailable in this UI session');
  expect(logs).not.toContain('not wired yet');

  await session;
});

it.each([
  ['/agents', 'agents: no agents'],
  ['/resume', 'resume: no resumable trace in current process']
])('shows empty-state response for known slash %s in line mode', async (command, expected) => {
  const handlers = {
    runTask: vi.fn(async () => 0),
    createHost: vi.fn(async () => ({ subscribe: vi.fn(), send: vi.fn(async () => undefined) })),
    printHelp: vi.fn(),
    printStatus: vi.fn(),
    probe: vi.fn(async () => 0)
  };

  const { session, io } = await runLine(handlers, [command, '/exit']);

  expect(handlers.runTask).not.toHaveBeenCalled();
  const logs = (io.log as ReturnType<typeof vi.fn>).mock.calls.map((args) => args[0]).join('\n');
  expect(logs).toContain(expected);
  expect(logs).toContain('commands: /help /clear /status /probe /cost /undo /agents /resume /exit');
  expect(logs).not.toContain('command handler unavailable in this UI session');
  expect(logs).not.toContain('not wired yet');

  await session;
});

it('forwards /undo through Ink App slash command callback to host.restoreSnapshot', async () => {
  const host: HostStub = {
    subscribe: vi.fn(() => vi.fn()),
    send: vi.fn(async () => undefined)
  };
  const handlers = {
    runTask: vi.fn(async () => 0),
    createHost: vi.fn(async () => host),
    printHelp: vi.fn(),
    printStatus: vi.fn(),
    probe: vi.fn(async () => 0)
  };

  const { session, submit } = await runInk(handlers);
  if (!capturedCommand) {
    throw new Error('Ink App command callback was not captured');
  }

  capturedCommand({ kind: 'slash', command: 'undo', args: [], normalized: '/undo' });
  expect(host.send).toHaveBeenCalledWith({ type: 'restoreSnapshot', snapshotId: undefined });

  capturedCommand({ kind: 'slash', command: 'undo', args: ['snapshot-1'], normalized: '/undo snapshot-1' });
  expect(host.send).toHaveBeenCalledWith({ type: 'restoreSnapshot', snapshotId: 'snapshot-1' });

  await submit('/exit');
  await session;
});

it('forwards /agents and /resume through Ink App slash command callback to host commands', async () => {
  const host: HostStub = {
    subscribe: vi.fn(() => vi.fn()),
    send: vi.fn(async () => undefined)
  };
  const handlers = {
    runTask: vi.fn(async () => 0),
    createHost: vi.fn(async () => host),
    printHelp: vi.fn(),
    printStatus: vi.fn(),
    probe: vi.fn(async () => 0)
  };

  const { session, submit } = await runInk(handlers);
  if (!capturedCommand) {
    throw new Error('Ink App command callback was not captured');
  }

  capturedCommand({ kind: 'slash', command: 'agents', args: [], normalized: '/agents' });
  expect(host.send).toHaveBeenCalledWith({ type: 'listAgents' });

  capturedCommand({ kind: 'slash', command: 'resume', args: [], normalized: '/resume' });
  expect(host.send).toHaveBeenCalledWith({ type: 'resumeSession' });

  await submit('/exit');
  await session;
});
