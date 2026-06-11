import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeKernelClient } from '../src/ipc/contract';

type GateCommand = { type: string; input?: string; gateId?: string; decision?: 'allow' | 'always' | 'deny' };
type SetupStatus = {
  homeDir: string;
  bobbyDir: string;
  keyPath: string;
  capabilitiesPath: string;
  hasKey: boolean;
  hasCapabilities: boolean;
  hasEnvKey: boolean;
};

type WindowWithBobby = Window & typeof globalThis & {
  bobby: {
    send: (cmd: GateCommand) => Promise<unknown>;
    onEvent: (callback: (event: unknown) => void) => () => void;
    getSetupStatus: () => Promise<SetupStatus>;
    openQuickstart: () => Promise<unknown>;
    listAutomations: () => Promise<unknown[]>;
    createAutomation: (input: unknown) => Promise<unknown>;
    updateAutomation: (input: unknown) => Promise<unknown>;
    toggleAutomation: (input: unknown) => Promise<unknown>;
    removeAutomation: (input: unknown) => Promise<boolean>;
    runAutomationNow: (input: unknown) => Promise<unknown>;
  };
};

function installBobby(send = vi.fn().mockResolvedValue(undefined), onEvent = vi.fn()): typeof send {
  const host = window as WindowWithBobby;
  host.bobby = {
    send,
    onEvent,
    getSetupStatus: vi.fn().mockResolvedValue({
      homeDir: 'C:\\Users\\Administrator',
      bobbyDir: 'C:\\Users\\Administrator\\.bobby',
      keyPath: 'C:\\Users\\Administrator\\.bobby\\key',
      capabilitiesPath: 'C:\\Users\\Administrator\\.bobby\\capabilities.json',
      hasKey: true,
      hasCapabilities: true,
      hasEnvKey: false
    }),
    openQuickstart: vi.fn().mockResolvedValue(undefined),
    listAutomations: vi.fn().mockResolvedValue([]),
    createAutomation: vi.fn().mockResolvedValue(undefined),
    updateAutomation: vi.fn().mockResolvedValue(undefined),
    toggleAutomation: vi.fn().mockResolvedValue(undefined),
    removeAutomation: vi.fn().mockResolvedValue(true),
    runAutomationNow: vi.fn().mockResolvedValue(undefined)
  };
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

async function expectSetupMethodsToBeExposed(): Promise<void> {
  const getSetupStatus = vi.fn().mockResolvedValue({
    homeDir: 'C:\\Users\\Administrator',
    bobbyDir: 'C:\\Users\\Administrator\\.bobby',
    keyPath: 'C:\\Users\\Administrator\\.bobby\\key',
    capabilitiesPath: 'C:\\Users\\Administrator\\.bobby\\capabilities.json',
    hasKey: true,
    hasCapabilities: false,
    hasEnvKey: true
  });
  const openQuickstart = vi.fn().mockResolvedValue(undefined);
  const host = window as WindowWithBobby;
  host.bobby = {
    send: vi.fn().mockResolvedValue(undefined),
    onEvent: vi.fn(),
    getSetupStatus,
    openQuickstart,
    listAutomations: vi.fn().mockResolvedValue([]),
    createAutomation: vi.fn().mockResolvedValue(undefined),
    updateAutomation: vi.fn().mockResolvedValue(undefined),
    toggleAutomation: vi.fn().mockResolvedValue(undefined),
    removeAutomation: vi.fn().mockResolvedValue(true),
    runAutomationNow: vi.fn().mockResolvedValue(undefined)
  };

  const client = makeKernelClient();
  await expect(client.getSetupStatus()).resolves.toMatchObject({ hasEnvKey: true, hasCapabilities: false });
  await expect(client.openQuickstart()).resolves.toBeUndefined();

  expect(getSetupStatus).toHaveBeenCalledTimes(1);
  expect(openQuickstart).toHaveBeenCalledTimes(1);
}

describe('makeKernelClient IPC contract', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('startTask should dispatch startTask command', expectStartTaskToDispatchCommand);
  it('approveGate should dispatch allow decision command', expectAllowDecisionToDispatchCommand);
  it('approveGate should dispatch always decision command', expectAlwaysDecisionToDispatchCommand);
  it('onEvent should subscribe and return unsubscribe', expectOnEventToSubscribeAndReturnUnsubscribe);
  it('setup methods should delegate to window.bobby', expectSetupMethodsToBeExposed);
});
