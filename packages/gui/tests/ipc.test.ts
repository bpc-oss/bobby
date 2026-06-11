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
    listMcpServers: () => Promise<unknown[]>;
    upsertMcpServer: (input: unknown) => Promise<unknown>;
    toggleMcpServer: (input: unknown) => Promise<unknown>;
    removeMcpServer: (input: unknown) => Promise<boolean>;
    listSubAgents: () => Promise<unknown[]>;
    upsertSubAgent: (input: unknown) => Promise<unknown>;
    removeSubAgent: (input: unknown) => Promise<boolean>;
    dispatchSubAgent: (input: unknown) => Promise<unknown>;
    listSubAgentDispatches: () => Promise<unknown[]>;
    listCommands: () => Promise<unknown[]>;
    upsertCommand: (input: unknown) => Promise<unknown>;
    removeCommand: (input: unknown) => Promise<boolean>;
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
    listMcpServers: vi.fn().mockResolvedValue([]),
    upsertMcpServer: vi.fn().mockResolvedValue(undefined),
    toggleMcpServer: vi.fn().mockResolvedValue(undefined),
    removeMcpServer: vi.fn().mockResolvedValue(true),
    listSubAgents: vi.fn().mockResolvedValue([]),
    upsertSubAgent: vi.fn().mockResolvedValue(undefined),
    removeSubAgent: vi.fn().mockResolvedValue(true),
    dispatchSubAgent: vi.fn().mockResolvedValue(undefined),
    listSubAgentDispatches: vi.fn().mockResolvedValue([]),
    listCommands: vi.fn().mockResolvedValue([]),
    upsertCommand: vi.fn().mockResolvedValue(undefined),
    removeCommand: vi.fn().mockResolvedValue(true),
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
    listMcpServers: vi.fn().mockResolvedValue([]),
    upsertMcpServer: vi.fn().mockResolvedValue(undefined),
    toggleMcpServer: vi.fn().mockResolvedValue(undefined),
    removeMcpServer: vi.fn().mockResolvedValue(true),
    listSubAgents: vi.fn().mockResolvedValue([]),
    upsertSubAgent: vi.fn().mockResolvedValue(undefined),
    removeSubAgent: vi.fn().mockResolvedValue(true),
    dispatchSubAgent: vi.fn().mockResolvedValue(undefined),
    listSubAgentDispatches: vi.fn().mockResolvedValue([]),
    listCommands: vi.fn().mockResolvedValue([]),
    upsertCommand: vi.fn().mockResolvedValue(undefined),
    removeCommand: vi.fn().mockResolvedValue(true),
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

async function expectMcpMethodsToDispatchCommands(): Promise<void> {
  installBobby();

  const client = makeKernelClient();
  await client.listMcpServers();
  await client.upsertMcpServer({
    name: 'Demo',
    enabled: true,
    transport: { kind: 'stdio', command: 'node', args: [] },
    tools: []
  });
  await client.toggleMcpServer({ id: 'mcp-1' });
  await client.removeMcpServer({ id: 'mcp-1' });

  const host = window as WindowWithBobby;
  expect(host.bobby.listMcpServers).toHaveBeenCalledTimes(1);
  expect(host.bobby.upsertMcpServer).toHaveBeenCalledWith({
    name: 'Demo',
    enabled: true,
    transport: { kind: 'stdio', command: 'node', args: [] },
    tools: []
  });
  expect(host.bobby.toggleMcpServer).toHaveBeenCalledWith({ id: 'mcp-1' });
  expect(host.bobby.removeMcpServer).toHaveBeenCalledWith({ id: 'mcp-1' });
}

async function expectSubAgentMethodsToDispatchCommands(): Promise<void> {
  installBobby();

  const client = makeKernelClient();
  await client.listSubAgents();
  await client.upsertSubAgent({
    sourcePath: 'E:\\ai-files\\Bobby\\.bobby\\agents\\demo.md',
    name: 'Demo',
    description: 'Demo agent',
    tools: ['read_file'],
    triggers: ['quickfix'],
    systemPrompt: 'You are a demo agent.'
  });
  await client.removeSubAgent({ sourcePath: 'E:\\ai-files\\Bobby\\.bobby\\agents\\demo.md' });
  await client.dispatchSubAgent({
    sourcePath: 'E:\\ai-files\\Bobby\\.bobby\\agents\\demo.md',
    task: 'Fix the test'
  });
  await client.listSubAgentDispatches();

  const host = window as WindowWithBobby;
  expect(host.bobby.listSubAgents).toHaveBeenCalledTimes(1);
  expect(host.bobby.upsertSubAgent).toHaveBeenCalledWith({
    sourcePath: 'E:\\ai-files\\Bobby\\.bobby\\agents\\demo.md',
    name: 'Demo',
    description: 'Demo agent',
    tools: ['read_file'],
    triggers: ['quickfix'],
    systemPrompt: 'You are a demo agent.'
  });
  expect(host.bobby.removeSubAgent).toHaveBeenCalledWith({ sourcePath: 'E:\\ai-files\\Bobby\\.bobby\\agents\\demo.md' });
  expect(host.bobby.dispatchSubAgent).toHaveBeenCalledWith({
    sourcePath: 'E:\\ai-files\\Bobby\\.bobby\\agents\\demo.md',
    task: 'Fix the test'
  });
  expect(host.bobby.listSubAgentDispatches).toHaveBeenCalledTimes(1);
}

async function expectCommandMethodsToDispatchCommands(): Promise<void> {
  installBobby();

  const client = makeKernelClient();
  await client.listCommands();
  await client.upsertCommand({
    sourcePath: 'E:\\ai-files\\Bobby\\.bobby\\commands\\summarize.md',
    name: 'summarize',
    description: 'Summarize the current task',
    promptTemplate: 'Summarize: {{input}}'
  });
  await client.removeCommand({ sourcePath: 'E:\\ai-files\\Bobby\\.bobby\\commands\\summarize.md' });

  const host = window as WindowWithBobby;
  expect(host.bobby.listCommands).toHaveBeenCalledTimes(1);
  expect(host.bobby.upsertCommand).toHaveBeenCalledWith({
    sourcePath: 'E:\\ai-files\\Bobby\\.bobby\\commands\\summarize.md',
    name: 'summarize',
    description: 'Summarize the current task',
    promptTemplate: 'Summarize: {{input}}'
  });
  expect(host.bobby.removeCommand).toHaveBeenCalledWith({ sourcePath: 'E:\\ai-files\\Bobby\\.bobby\\commands\\summarize.md' });
}

describe('makeKernelClient IPC contract', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('startTask should dispatch startTask command', expectStartTaskToDispatchCommand);
  it('approveGate should dispatch allow decision command', expectAllowDecisionToDispatchCommand);
  it('approveGate should dispatch always decision command', expectAlwaysDecisionToDispatchCommand);
  it('mcp methods should dispatch commands', expectMcpMethodsToDispatchCommands);
  it('agent methods should dispatch commands', expectSubAgentMethodsToDispatchCommands);
  it('command methods should dispatch commands', expectCommandMethodsToDispatchCommands);
  it('onEvent should subscribe and return unsubscribe', expectOnEventToSubscribeAndReturnUnsubscribe);
  it('setup methods should delegate to window.bobby', expectSetupMethodsToBeExposed);
});
