import { expect, it, vi } from 'vitest';

import { runInteractiveSession, type InteractiveDeps, type InteractiveIO } from '../src/interactive';

type SubmitCallback = (value: string) => Promise<void>;
type HostStub = {
  subscribe: (fn: (event: unknown) => void) => () => void;
  send: ReturnType<typeof vi.fn>;
};

let capturedSubmit: SubmitCallback | null = null;

vi.mock('../src/ui/App', () => ({
  App: ({ onSubmit }: { onSubmit: SubmitCallback }) => {
    capturedSubmit = onSubmit;
    return null;
  }
}));

const createTTYDeps = (): InteractiveDeps => ({
  stdin: { isTTY: true } as NodeJS.ReadStream,
  stdout: { isTTY: true } as NodeJS.WriteStream
});

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
