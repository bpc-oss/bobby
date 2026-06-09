import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeKernelClient } from '../src/ipc/contract';

type GateCommand = { type: string; input?: string; gateId?: string; decision?: 'allow' | 'always' | 'deny' };

type WindowWithBobby = Window & typeof globalThis & {
  bobby: {
    send: (cmd: GateCommand) => Promise<unknown>;
    onEvent: (callback: (event: unknown) => void) => () => void;
  };
};

function installBobby(send = vi.fn().mockResolvedValue(undefined), onEvent = vi.fn()): typeof send {
  const host = window as WindowWithBobby;
  host.bobby = { send, onEvent };
  return send;
}

async function expectStartTaskToDispatchCommand(): Promise<void> {
  const send = installBobby();

  const client = makeKernelClient();
  await client.startTask('organize files');

  expect(send).toHaveBeenCalledWith({
    type: 'startTask',
    input: 'organize files'
  });
}

async function expectAllowDecisionToDispatchCommand(): Promise<void> {
  const send = installBobby();

  const client = makeKernelClient();
  await client.approveGate('g1', 'allow');

  expect(send).toHaveBeenCalledWith({
    type: 'approveGate',
    gateId: 'g1',
    decision: 'allow'
  });
}

async function expectAlwaysDecisionToDispatchCommand(): Promise<void> {
  const send = installBobby();

  const client = makeKernelClient();
  await client.approveGate('g2', 'always');

  expect(send).toHaveBeenCalledWith({
    type: 'approveGate',
    gateId: 'g2',
    decision: 'always'
  });
}

function expectOnEventToSubscribeAndReturnUnsubscribe(): void {
  const unsubscribe = vi.fn();
  const onEvent = vi.fn().mockReturnValue(unsubscribe);
  installBobby(vi.fn(), onEvent);

  const client = makeKernelClient();
  const handler = vi.fn();
  const result = client.onEvent(handler);

  expect(onEvent).toHaveBeenCalledWith(handler);
  expect(result).toBe(unsubscribe);
}

describe('makeKernelClient IPC contract', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('startTask should dispatch startTask command', expectStartTaskToDispatchCommand);
  it('approveGate should dispatch allow decision command', expectAllowDecisionToDispatchCommand);
  it('approveGate should dispatch always decision command', expectAlwaysDecisionToDispatchCommand);
  it('onEvent should subscribe and return unsubscribe', expectOnEventToSubscribeAndReturnUnsubscribe);
});
