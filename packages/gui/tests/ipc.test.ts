import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeKernelClient } from '../src/ipc/contract';

type WindowWithBobby = Window & typeof globalThis & {
  bobby: {
    send: (cmd: { type: string; input?: string; gateId?: string; decision?: 'allow' | 'deny' }) => Promise<unknown>;
    onEvent: (callback: (event: unknown) => void) => () => void;
  };
};

describe('makeKernelClient IPC contract', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('startTask should dispatch startTask command', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const host = window as WindowWithBobby;
    host.bobby = { send, onEvent: vi.fn() };

    const client = makeKernelClient();
    await client.startTask('整理文件');

    expect(send).toHaveBeenCalledWith({
      type: 'startTask',
      input: '整理文件'
    });
  });

  it('approveGate should dispatch allow decision command', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const host = window as WindowWithBobby;
    host.bobby = { send, onEvent: vi.fn() };

    const client = makeKernelClient();
    await client.approveGate('g1', 'allow');

    expect(send).toHaveBeenCalledWith({
      type: 'approveGate',
      gateId: 'g1',
      decision: 'allow'
    });
  });

  it('onEvent should subscribe and return unsubscribe', () => {
    const unsubscribe = vi.fn();
    const onEvent = vi.fn().mockReturnValue(unsubscribe);
    const host = window as WindowWithBobby;
    host.bobby = { send: vi.fn(), onEvent };

    const client = makeKernelClient();
    const handler = vi.fn();
    const result = client.onEvent(handler);

    expect(onEvent).toHaveBeenCalledWith(handler);
    expect(result).toBe(unsubscribe);
  });
});
