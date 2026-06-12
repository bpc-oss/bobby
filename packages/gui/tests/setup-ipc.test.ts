import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { BrowserWindow } from 'electron';
import type { AutomationRecord, CommandRecordDto, PreviewStartResult, SessionRecordDto, SnapshotListEntry } from '../src/ipc/contract';

const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
let tempHome = '';
let originalHome = '';
let originalUserProfile = '';
let originalDeepSeekApiKey = '';

const appWhenReady = vi.fn(async () => undefined);
const appOn = vi.fn();
const appGetPath = vi.fn(() => tempHome);
const shellOpenExternal = vi.fn(async () => undefined);
const dialogShowOpenDialog = vi.fn(async () => ({ canceled: false, filePaths: ['E:\\projects\\selected'] }));
const menuSetApplicationMenu = vi.fn();
const menuBuildFromTemplate = vi.fn((template: unknown) => template);
const traySetToolTip = vi.fn();
const traySetContextMenu = vi.fn();
const notificationShow = vi.fn();
let notificationClick: (() => void) | null = null;
const NotificationMock = Object.assign(vi.fn(() => ({
  show: notificationShow,
  on: vi.fn((event: string, handler: () => void) => {
    if (event === 'click') {
      notificationClick = handler;
    }
  })
})), {
  isSupported: vi.fn(() => true)
});
const safeStorageIsEncryptionAvailable = vi.fn(() => true);
const safeStorageEncryptString = vi.fn((value: string) => Buffer.from(`encrypted:${value}`, 'utf8'));
const safeStorageDecryptString = vi.fn((value: Buffer) => value.toString('utf8').replace(/^encrypted:/, ''));

const BrowserWindowMock = vi.fn(() => ({
  isDestroyed: vi.fn(() => false),
  show: vi.fn(),
  focus: vi.fn(),
  webContents: {
    send: vi.fn(),
    once: vi.fn((event: string, handler: () => void) => {
      if (event === 'did-finish-load') {
        handler();
      }
    })
  },
  loadURL: vi.fn(),
  loadFile: vi.fn()
})) as unknown as typeof BrowserWindow;
BrowserWindowMock.getAllWindows = vi.fn((): BrowserWindow[] => []);

const KernelHostMock = vi.fn(() => ({
  subscribe: vi.fn(() => () => undefined),
  send: vi.fn(async () => undefined)
}));
class ToolRegistryMock {
  private readonly tools = new Map<string, { name: string; permissionTier: string }>();

  register(tool: { name: string; permissionTier: string }): void {
    this.tools.set(tool.name, tool);
  }

  clear(): void {
    this.tools.clear();
  }

  list(): Array<{ name: string; permissionTier: string }> {
    return [...this.tools.values()];
  }
}
class ToolEvidenceProviderMock {
  constructor(private readonly registry: ToolRegistryMock) {}

  evidenceFor = vi.fn(async () => []);
  context = vi.fn(() => ({ touchedPaths: [] }));
}
class ExecToolMock {
  name = 'exec';
  permissionTier = 'L2';
  description = 'execute a command';
  constructor(_workspaceRoot: string) {}
}
class WriteFileToolMock {
  name = 'write_file';
  permissionTier = 'L1';
  description = 'write a file';
  constructor(_workspace: unknown) {}
}
class FileExistsToolMock {
  name = 'file_exists';
  permissionTier = 'L0';
  description = 'check file';
  constructor(_workspace: unknown) {}
}
class WorkspaceMock {
  constructor(public root: string) {}
}
class VerificationEngineMock {
  constructor(_oracles: unknown[]) {}
}
class CompletionGateMock {}
class CommandExitOracleMock {}
class FileDiffOracleMock {}
class FileExistsOracleMock {}
class NoForbiddenPathCheckerMock {}
const createMcpTransport = vi.fn(() => ({
  probe: vi.fn(async () => undefined),
  call: vi.fn(async (tool: string, args: unknown) => ({ stdout: tool, isError: false, payload: { tool, args } }))
}));
const loadSubAgents = vi.fn((repoRoot: string) => {
  const agentsDir = join(repoRoot, '.bobby', 'agents');
  if (!existsSync(agentsDir)) {
    return { agents: [], diagnostics: [] };
  }

  const agents = readdirSync(agentsDir)
    .filter((entry) => entry.endsWith('.md'))
    .map((entry) => {
      const sourcePath = join(agentsDir, entry);
      const content = readFileSync(sourcePath, 'utf8');
      const nameMatch = content.match(/name:\s*("?)([^\n"]+)\1/i);
      const descriptionMatch = content.match(/description:\s*("?)([^\n"]+)\1/i);
      const body = content.split(/---\r?\n/).slice(2).join('---\n').trim();
      return {
        sourcePath,
        name: nameMatch?.[2] ?? entry.replace(/\.md$/, ''),
        description: (descriptionMatch?.[2] ?? body.slice(0, 60)) || 'Agent',
        tools: [],
        triggers: [],
        model: undefined,
        systemPrompt: body || 'You are a helper.'
      };
    });

  return { agents, diagnostics: [] };
});
const dispatchSubAgent = vi.fn(async (_agent: unknown, _task: string, options: { runInWorktree?: (agent: unknown, task: string, worktreePath: string) => Promise<void> | void; repoRoot?: string; proposalRoot?: string }) => {
  const worktreePath = join(tempHome, 'worktree');
  await options.runInWorktree?.(_agent, _task, worktreePath);
  return {
    proposalPath: join(tempHome, '.bobby', 'proposals', 'proposal.patch'),
    proposalId: 'proposal-1',
    worktreePath
  };
});
const applySubAgentProposal = vi.fn();
const mcpToolToBobbyTool = vi.fn((name: string, transport: { call: (tool: string, args: unknown) => Promise<unknown> }, options?: { serverId?: string; permissionTier?: string; description?: string; evidenceType?: string }) => ({
  name: options?.serverId ? `mcp:${options.serverId}:${name}` : `mcp:${name}`,
  permissionTier: options?.permissionTier ?? 'L3',
  description: options?.description ?? '',
  run: async (input: Record<string, unknown>, ctx: { acId: string; claimId: string }) => {
    const result = await transport.call(name, input);
    return {
      evidence: [{ claimId: ctx.claimId, acId: ctx.acId, evidenceType: 'command_output', payload: result, producedBy: 'tool' }],
      result
    };
  }
}));
const makeDeepSeekClient = vi.fn(() => ({}));
const listSnapshots = vi.fn(async () => [] as SnapshotListEntry[]);
const loadDeepSeekConfig = vi.fn(async () => ({
  apiKey: 'legacy-deepseek-key',
  report: {
    runnerModel: 'deepseek-chat',
    graderModel: 'deepseek-reasoner',
    useToolCalling: true,
    useJsonMode: true,
    useFim: false,
    useCaching: true,
    useReasoning: true,
    useStreaming: false,
    contextWindow: 128000
  }
}));

vi.mock('electron', () => ({
  app: {
    whenReady: appWhenReady,
    on: appOn,
    getPath: appGetPath,
    quit: vi.fn()
  },
  BrowserWindow: BrowserWindowMock as unknown as typeof BrowserWindow,
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, handler);
    })
  },
  shell: {
    openExternal: shellOpenExternal
  },
  dialog: {
    showOpenDialog: dialogShowOpenDialog
  },
  safeStorage: {
    isEncryptionAvailable: safeStorageIsEncryptionAvailable,
    encryptString: safeStorageEncryptString,
    decryptString: safeStorageDecryptString
  },
  Menu: {
    setApplicationMenu: menuSetApplicationMenu,
    buildFromTemplate: menuBuildFromTemplate
  },
  nativeImage: {
    createEmpty: vi.fn(() => ({}))
  },
  Tray: vi.fn(() => ({
    setToolTip: traySetToolTip,
    setContextMenu: traySetContextMenu
  })),
  Notification: NotificationMock
}));

vi.mock('@bobby/kernel', () => ({
  KernelHost: KernelHostMock,
  ToolRegistry: ToolRegistryMock,
  ToolEvidenceProvider: ToolEvidenceProviderMock,
  ExecTool: ExecToolMock,
  FileExistsTool: FileExistsToolMock,
  WriteFileTool: WriteFileToolMock,
  Workspace: WorkspaceMock,
  VerificationEngine: VerificationEngineMock,
  CompletionGate: CompletionGateMock,
  CommandExitOracle: CommandExitOracleMock,
  FileDiffOracle: FileDiffOracleMock,
  FileExistsOracle: FileExistsOracleMock,
  NoForbiddenPathChecker: NoForbiddenPathCheckerMock,
  createMcpTransport,
  loadSubAgents,
  dispatchSubAgent,
  applySubAgentProposal,
  mcpToolToBobbyTool,
  listSnapshots,
  makeDeepSeekClient,
  loadDeepSeekConfig
}));

vi.mock('../electron/updater', () => ({
  initAutoUpdate: vi.fn()
}));

async function loadMain(initialAutomations: AutomationRecord[] = [], initialProjectDir?: string): Promise<void> {
  vi.resetModules();
  handlers.clear();
  tempHome = mkdtempSync(join(tmpdir(), 'bobby-gui-setup-'));
  mkdirSync(join(tempHome, '.bobby'), { recursive: true });
  writeFileSync(join(tempHome, '.bobby', 'key'), 'deepseek-key\n', 'utf8');
  writeFileSync(join(tempHome, '.bobby', 'capabilities.json'), '{}\n', 'utf8');
  originalHome = process.env.HOME ?? '';
  originalUserProfile = process.env.USERPROFILE ?? '';
  originalDeepSeekApiKey = process.env.DEEPSEEK_API_KEY ?? '';
  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;
  delete process.env.DEEPSEEK_API_KEY;
  appGetPath.mockReturnValue(tempHome);
  safeStorageIsEncryptionAvailable.mockReturnValue(true);
  safeStorageEncryptString.mockImplementation((value: string) => Buffer.from(`encrypted:${value}`, 'utf8'));
  safeStorageDecryptString.mockImplementation((value: Buffer) => value.toString('utf8').replace(/^encrypted:/, ''));
  makeDeepSeekClient.mockClear();
  loadDeepSeekConfig.mockClear();
  applySubAgentProposal.mockClear();

  await import('../electron/main');
  await appWhenReady.mock.results[0]?.value;

  if (initialProjectDir) {
    const selectProject = handlers.get('project:select');
    if (!selectProject) {
      throw new Error('project:select handler not registered');
    }

    await selectProject(undefined, { projectDir: initialProjectDir });
    mkdirSync(join(initialProjectDir, '.bobby'), { recursive: true });
    writeFileSync(join(initialProjectDir, '.bobby', 'automations.json'), JSON.stringify(initialAutomations, null, 2), 'utf8');
  } else {
    writeFileSync(join(tempHome, '.bobby', 'automations.json'), JSON.stringify(initialAutomations, null, 2), 'utf8');
  }
}

afterEach(() => {
  vi.useRealTimers();
  rmSync(tempHome, { recursive: true, force: true });
  if (originalHome) {
    process.env.HOME = originalHome;
  } else {
    delete process.env.HOME;
  }
  if (originalUserProfile) {
    process.env.USERPROFILE = originalUserProfile;
  } else {
    delete process.env.USERPROFILE;
  }
  if (originalDeepSeekApiKey) {
    process.env.DEEPSEEK_API_KEY = originalDeepSeekApiKey;
  } else {
    delete process.env.DEEPSEEK_API_KEY;
  }
  vi.clearAllMocks();
});

describe('setup IPC handlers', () => {
  beforeEach(() => {
    handlers.clear();
  });

  it('reports onboarding status from the local Bobby files', async () => {
    await loadMain();
    const handler = handlers.get('setup:status');
    if (!handler) throw new Error('setup:status handler not found');

    const status = await handler() as { hasKey: boolean; hasCapabilities: boolean; hasEnvKey: boolean; keyPath: string };
    expect(status).toMatchObject({
      hasKey: true,
      hasCapabilities: true,
      hasEnvKey: false,
      keyPath: join(tempHome, '.bobby', 'key')
    });
    expect(readFileSync(join(tempHome, '.bobby', 'key'), 'utf8')).toContain('deepseek-key');
  });

  it('opens the quickstart docs in the system browser', async () => {
    await loadMain();
    const handler = handlers.get('setup:openQuickstart');
    if (!handler) throw new Error('setup:openQuickstart handler not found');

    await handler();
    expect(shellOpenExternal).toHaveBeenCalledWith('https://github.com/bpc-oss/bobby/blob/main/docs/quickstart.md');
  });
});

describe('settings IPC handlers', () => {
  beforeEach(() => {
    handlers.clear();
  });

  it('stores API key outside public settings and never returns key material', async () => {
    await loadMain();
    const setSettings = handlers.get('settings:set');
    const getSettings = handlers.get('settings:get');
    if (!setSettings || !getSettings) throw new Error('settings handlers not registered');

    const result = await setSettings(undefined, {
      baseUrl: 'https://api.deepseek.com/beta',
      modelStrategy: 'pro',
      workspaceDir: 'E:\\ai-files\\Bobby',
      budgetUsd: 20,
      defaultPermission: 'L2',
      strongSandbox: false,
      apiKey: 'sk-real-secret'
    }) as { hasApiKey: boolean; baseUrl: string };

    expect(result).toMatchObject({ hasApiKey: true, baseUrl: 'https://api.deepseek.com/beta' });
    expect(result).not.toHaveProperty('apiKey');

    const settingsJson = readFileSync(join(tempHome, 'settings.json'), 'utf8');
    expect(settingsJson).toContain('https://api.deepseek.com/beta');
    expect(settingsJson).not.toContain('sk-real-secret');

    const secretFile = readFileSync(join(tempHome, 'deepseek.key'), 'utf8');
    expect(secretFile).not.toContain('sk-real-secret');

    const publicSettings = await getSettings() as Record<string, unknown>;
    expect(publicSettings.hasApiKey).toBe(true);
    expect(publicSettings).not.toHaveProperty('apiKey');
    expect(JSON.stringify(publicSettings)).not.toContain('sk-real-secret');
  });

  it('refuses to persist a new API key when secure storage is unavailable', async () => {
    await loadMain();
    safeStorageIsEncryptionAvailable.mockReturnValue(false);
    const setSettings = handlers.get('settings:set');
    if (!setSettings) throw new Error('settings handler not registered');

    await expect(setSettings(undefined, {
      baseUrl: 'https://api.deepseek.com',
      modelStrategy: 'auto',
      workspaceDir: 'E:\\ai-files\\Bobby',
      budgetUsd: 10,
      defaultPermission: 'L1',
      strongSandbox: true,
      apiKey: 'sk-should-not-hit-disk'
    })).rejects.toThrow(/Secure API key storage is unavailable/);

    expect(existsSync(join(tempHome, 'deepseek.key'))).toBe(false);
  });

  it('rebuilds the kernel host from settings baseUrl and stored secret', async () => {
    await loadMain();
    const setSettings = handlers.get('settings:set');
    const command = handlers.get('kernel:command');
    if (!setSettings || !command) throw new Error('settings or kernel handlers not registered');

    await setSettings(undefined, {
      baseUrl: 'https://deepseek.example.test',
      modelStrategy: 'auto',
      workspaceDir: 'E:\\ai-files\\Bobby',
      budgetUsd: 10,
      defaultPermission: 'L1',
      strongSandbox: true,
      apiKey: 'sk-settings-secret'
    });

    await command(undefined, { type: 'startTask', input: 'probe settings wiring' });

    expect(makeDeepSeekClient).toHaveBeenLastCalledWith(
      'sk-settings-secret',
      expect.objectContaining({ runnerModel: 'deepseek-chat' }),
      'https://deepseek.example.test'
    );
  });
});

describe('deepseek capability IPC handlers', () => {
  beforeEach(() => {
    handlers.clear();
  });

  it('reads the probe report without exposing key material', async () => {
    await loadMain();
    mkdirSync(join(tempHome, '.bobby'), { recursive: true });
    writeFileSync(
      join(tempHome, '.bobby', 'capabilities.json'),
      JSON.stringify({
        runnerModel: 'deepseek-v4-flash',
        graderModel: 'deepseek-v4-pro',
        useToolCalling: true,
        useJsonMode: true,
        useFim: false,
        useCaching: true,
        useReasoning: true,
        useVision: false,
        useStreaming: true,
        contextWindow: 128000
      }, null, 2),
      'utf8'
    );
    const getCapabilities = handlers.get('deepseek:capabilities');
    if (!getCapabilities) throw new Error('deepseek capability handler not registered');

    const report = await getCapabilities() as {
      runnerModel: string;
      graderModel: string;
      useVision: boolean;
    };

    expect(report).toMatchObject({
      runnerModel: 'deepseek-v4-flash',
      graderModel: 'deepseek-v4-pro',
      useVision: false
    });
    expect(JSON.stringify(report)).not.toContain('sk-real-secret');
  });
});

describe('mcp IPC handlers', () => {
  beforeEach(() => {
    handlers.clear();
  });

  it('lists the built-in filesystem demo and supports add toggle remove flows', async () => {
    await loadMain();
    const list = handlers.get('mcp:list');
    const upsert = handlers.get('mcp:upsert');
    const toggle = handlers.get('mcp:toggle');
    const remove = handlers.get('mcp:remove');
    if (!list || !upsert || !toggle || !remove) throw new Error('mcp handlers not registered');

    const initial = await list() as Array<{ id: string; name: string; tools: Array<{ name: string }> }>;
    expect(initial.some((server) => server.id === 'filesystem-demo')).toBe(true);
    expect(initial.find((server) => server.id === 'filesystem-demo')?.tools.map((tool) => tool.name)).toEqual([
      'read_file',
      'write_file',
      'list_directory',
      'stat_path'
    ]);

    const created = await upsert(undefined, {
      name: 'HTTP Files',
      enabled: true,
      transport: { kind: 'url', url: 'http://localhost:3010/mcp' },
      tools: [
        { name: 'read_remote', permissionTier: 'L2', description: 'Read remote file', evidenceType: 'command_output' }
      ]
    }) as { id: string; enabled: boolean; transport: { kind: string } };

    expect(created.enabled).toBe(true);
    expect(created.transport.kind).toBe('url');

    const afterCreate = await list() as Array<{ id: string; enabled: boolean }>;
    expect(afterCreate.some((server) => server.id === created.id)).toBe(true);

    const toggled = await toggle(undefined, { id: created.id }) as { enabled: boolean };
    expect(toggled.enabled).toBe(false);

    const removed = await remove(undefined, { id: created.id });
    expect(removed).toBe(true);

    const afterRemove = await list() as Array<{ id: string }>;
    expect(afterRemove.some((server) => server.id === created.id)).toBe(false);
  });
});

describe('git IPC handlers', () => {
  beforeEach(() => {
    handlers.clear();
  });

  it('detects git projects and commits workspace changes', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'bobby-git-project-'));
    spawnSync('git', ['init', '-q'], { cwd: projectRoot, encoding: 'utf8' });
    spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: projectRoot, encoding: 'utf8' });
    spawnSync('git', ['config', 'user.name', 'Bobby Test'], { cwd: projectRoot, encoding: 'utf8' });
    mkdirSync(join(projectRoot, 'src'), { recursive: true });
    writeFileSync(join(projectRoot, 'src', 'note.txt'), 'before\n', 'utf8');

    await loadMain([], projectRoot);
    const isRepo = handlers.get('git:isRepo');
    const commit = handlers.get('git:commit');
    if (!isRepo || !commit) throw new Error('git handlers not registered');

    await expect(isRepo()).resolves.toBe(true);
    writeFileSync(join(projectRoot, 'src', 'note.txt'), 'after\n', 'utf8');

    const result = await commit(undefined, { message: 'Test Bobby commit' }) as { committed: boolean; hash: string | null; output: string };
    expect(result.committed).toBe(true);
    expect(result.hash).toMatch(/^[0-9a-f]+$/i);
    expect(result.output).toContain('Test Bobby commit');
    expect(spawnSync('git', ['-C', projectRoot, 'log', '-1', '--pretty=%s'], { encoding: 'utf8' }).stdout.trim()).toBe('Test Bobby commit');
  });
});

describe('agent IPC handlers', () => {
  beforeEach(() => {
    handlers.clear();
  });

  it('lists, upserts, dispatches, and records background task state', async () => {
    await loadMain();
    const projectRoot = mkdtempSync(join(tempHome, 'agents-project-'));
    mkdirSync(join(projectRoot, '.bobby', 'agents'), { recursive: true });

    const selectProject = handlers.get('project:select');
    const list = handlers.get('agents:list');
    const upsert = handlers.get('agents:upsert');
    const dispatch = handlers.get('agents:dispatch');
    const dispatches = handlers.get('agents:dispatches');
    const remove = handlers.get('agents:remove');
    if (!selectProject || !list || !upsert || !dispatch || !dispatches || !remove) {
      throw new Error('agent handlers not registered');
    }

    await selectProject(undefined, { projectDir: projectRoot });

    const created = await upsert(undefined, {
      name: 'Writer',
      description: 'Writes a patch proposal',
      tools: ['write_file'],
      triggers: ['fix'],
      systemPrompt: 'You are a writer agent.'
    }) as { sourcePath: string };

    const agents = await list() as Array<{ name: string; sourcePath: string }>;
    expect(agents.some((agent) => agent.name === 'Writer')).toBe(true);

    const completed = await dispatch(undefined, {
      sourcePath: created.sourcePath,
      task: 'Update the notes file'
    }) as { status: string; mergeState: string; proposalId: string | null; proposalPath: string | null; worktreePath: string | null };

    expect(completed.status).toBe('completed');
    expect(completed.mergeState).toBe('ready');
    expect(completed.proposalId).toBe('proposal-1');
    expect(completed.proposalPath).toContain('.bobby');

    const records = await dispatches() as Array<{ proposalId: string | null; status: string }>;
    expect(records.some((record) => record.proposalId === 'proposal-1' && record.status === 'completed')).toBe(true);

    expect(await remove(undefined, { sourcePath: created.sourcePath })).toBe(true);
  });
});

describe('proposal IPC handlers', () => {
  beforeEach(() => {
    handlers.clear();
  });

  it('does not trust renderer-supplied merge booleans without a ready background dispatch', async () => {
    await loadMain();
    const projectRoot = mkdtempSync(join(tempHome, 'proposal-project-'));
    const proposalDir = join(projectRoot, '.bobby', 'proposals');
    mkdirSync(proposalDir, { recursive: true });
    const proposalPath = join(proposalDir, 'proposal-1.patch');
    writeFileSync(proposalPath, 'diff --git a/target.txt b/target.txt\n', 'utf8');

    const selectProject = handlers.get('project:select');
    const apply = handlers.get('proposals:apply');
    if (!selectProject || !apply) {
      throw new Error('proposal handlers not registered');
    }

    await selectProject(undefined, { projectDir: projectRoot });

    await expect(apply(undefined, {
      proposalId: 'proposal-1',
      gatePassed: true,
      proReviewPassed: true,
      humanConfirmed: true
    })).rejects.toThrow(/completed ready background task/);
    expect(applySubAgentProposal).not.toHaveBeenCalled();
    expect(existsSync(proposalPath)).toBe(true);
  });

  it('applies proposals only when the main process finds a ready dispatch record', async () => {
    await loadMain();
    const projectRoot = mkdtempSync(join(tempHome, 'proposal-ready-project-'));
    const bobbyDir = join(projectRoot, '.bobby');
    const proposalDir = join(bobbyDir, 'proposals');
    mkdirSync(proposalDir, { recursive: true });
    const proposalPath = join(proposalDir, 'proposal-1.patch');
    writeFileSync(proposalPath, 'diff --git a/target.txt b/target.txt\n', 'utf8');
    writeFileSync(join(bobbyDir, 'subagent-dispatches.json'), JSON.stringify([
      {
        id: 'dispatch-1',
        agentSourcePath: join(projectRoot, '.bobby', 'agents', 'writer.md'),
        agentName: 'Writer',
        task: 'Update target',
        status: 'completed',
        mergeState: 'ready',
        createdAt: '2026-06-12T00:00:00.000Z',
        updatedAt: '2026-06-12T00:01:00.000Z',
        worktreePath: join(tempHome, 'worktree'),
        proposalId: 'proposal-1',
        proposalPath,
        error: null
      }
    ], null, 2), 'utf8');

    const selectProject = handlers.get('project:select');
    const apply = handlers.get('proposals:apply');
    if (!selectProject || !apply) {
      throw new Error('proposal handlers not registered');
    }

    await selectProject(undefined, { projectDir: projectRoot });
    const summary = await apply(undefined, {
      proposalId: 'proposal-1',
      gatePassed: false,
      proReviewPassed: false,
      humanConfirmed: true
    }) as { proposalId: string };

    expect(summary.proposalId).toBe('proposal-1');
    expect(applySubAgentProposal).toHaveBeenCalledWith(proposalPath, {
      gatePassed: true,
      proReviewPassed: true,
      humanConfirmed: true
    }, projectRoot);
    expect(existsSync(proposalPath)).toBe(false);
  });
});

describe('task IPC handlers', () => {
  beforeEach(() => {
    handlers.clear();
  });

  it('lists and reads trace-backed tasks when no task artifact directory exists', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'bobby-trace-task-'));
    mkdirSync(join(projectRoot, '.bobby', 'traces'), { recursive: true });
    writeFileSync(
      join(projectRoot, '.bobby', 'traces', 'trace-task-1.jsonl'),
      [
        JSON.stringify({
          taskId: 'trace-task-1',
          type: 'intent_proposed',
          contract: {
            goal: 'Trace-backed task',
            acceptanceCriteria: [{ id: 'AC1', desc: 'Add the note', oracleHint: 'file' }],
            constraints: [],
            inputs: [],
            outOfScope: []
          }
        }),
        JSON.stringify({
          taskId: 'trace-task-1',
          type: 'plan_ready',
          steps: [{ id: 'S1', desc: 'Add the note', satisfiesAcIds: ['AC1'], dependsOn: [] }]
        }),
        JSON.stringify({
          taskId: 'trace-task-1',
          type: 'final_result',
          status: 'done'
        })
      ].join('\n'),
      'utf8'
    );

    await loadMain([], projectRoot);
    const selectProject = handlers.get('project:select');
    const listTasks = handlers.get('tasks:list');
    const readTask = handlers.get('tasks:read');
    if (!selectProject || !listTasks || !readTask) {
      throw new Error('task handlers not registered');
    }

    await selectProject(undefined, { projectDir: projectRoot });

    const tasks = await listTasks() as Array<{ taskId: string; userGoal: string; state: string; traceCount: number; hasContract: boolean; hasPlan: boolean; hasReport: boolean }>;
    expect(tasks.some((task) => task.taskId === 'trace-task-1')).toBe(true);

    const detail = await readTask(undefined, { taskId: 'trace-task-1' }) as {
      summary: { taskId: string; userGoal: string; state: string; traceCount: number; hasContract: boolean; hasPlan: boolean; hasReport: boolean };
      contract: { goal?: string } | null;
      plan: Array<{ id: string }> | null;
      report: string | null;
      trace: Array<{ type: string }>;
      sessionIds: string[];
    };

    expect(detail.summary).toMatchObject({
      taskId: 'trace-task-1',
      userGoal: 'Trace-backed task',
      state: 'done',
      traceCount: 3,
      hasContract: true,
      hasPlan: true,
      hasReport: true
    });
    expect(detail.contract).toMatchObject({ goal: 'Trace-backed task' });
    expect(detail.plan).toHaveLength(1);
    expect(detail.report).toContain('Trace-backed task');
    expect(detail.trace.map((event) => event.type)).toEqual(['intent_proposed', 'plan_ready', 'final_result']);
    expect(detail.sessionIds).toEqual([]);
  });
});

describe('command IPC handlers', () => {
  beforeEach(() => {
    handlers.clear();
  });

  it('lists, upserts, and removes command templates in .bobby/commands', async () => {
    await loadMain();
    const projectRoot = mkdtempSync(join(tempHome, 'commands-project-'));
    mkdirSync(join(projectRoot, '.bobby', 'commands'), { recursive: true });

    const selectProject = handlers.get('project:select');
    const list = handlers.get('commands:list');
    const upsert = handlers.get('commands:upsert');
    const remove = handlers.get('commands:remove');
    if (!selectProject || !list || !upsert || !remove) {
      throw new Error('command handlers not registered');
    }

    await selectProject(undefined, { projectDir: projectRoot });
    writeFileSync(
      join(projectRoot, '.bobby', 'commands', 'summarize.md'),
      ['---', 'name: summarize', 'description: Summarize the current task', '---', 'Summarize: {{input}}'].join('\n'),
      'utf8'
    );

    const initial = await list() as CommandRecordDto[];
    expect(initial).toHaveLength(1);
    expect(initial[0]).toMatchObject({
      name: 'summarize',
      description: 'Summarize the current task',
      promptTemplate: 'Summarize: {{input}}'
    });

    const created = await upsert(undefined, {
      name: 'rewrite',
      description: 'Rewrite text',
      promptTemplate: 'Rewrite the following:\n{{input}}'
    }) as CommandRecordDto;
    expect(created.sourcePath).toContain('.bobby');
    expect(readFileSync(created.sourcePath, 'utf8')).toContain('Rewrite the following');

    expect(await remove(undefined, { sourcePath: created.sourcePath })).toBe(true);
    const afterRemove = await list() as CommandRecordDto[];
    expect(afterRemove.some((item) => item.name === 'rewrite')).toBe(false);
  });
});

describe('session IPC handlers', () => {
  beforeEach(() => {
    handlers.clear();
  });

  function session(id: string, updatedAt: string): SessionRecordDto {
    return {
      id,
      title: 'Run this through Mission Control',
      blocks: [{ kind: 'user', id: `user-${id}`, text: 'Run this through Mission Control' }],
      createdAt: '2026-06-11T00:00:00.000Z',
      updatedAt,
      projectDir: 'E:\\ai-files\\Bobby',
      taskId: null,
      status: 'done',
      liveReasoning: '',
      liveAssistant: '',
      liveToolContent: '',
      currentPlan: [],
      error: null,
      costUsd: 0,
      spendUsd: 0,
      model: null
    };
  }

  it('prunes same-title session files and returns only the newest session', async () => {
    await loadMain();
    const save = handlers.get('sessions:save');
    const list = handlers.get('sessions:list');
    if (!save || !list) throw new Error('session handlers not registered');

    await save(undefined, session('old-copy', '2026-06-11T00:00:00.000Z'));
    await save(undefined, session('new-copy', '2026-06-11T01:00:00.000Z'));

    const sessions = await list() as SessionRecordDto[];

    expect(sessions.map((item) => item.id)).toEqual(['new-copy']);
    expect(existsSync(join(tempHome, 'sessions', 'old-copy.json'))).toBe(false);
    expect(existsSync(join(tempHome, 'sessions', 'new-copy.json'))).toBe(true);
  });

  it('links saved sessions back to task detail sessionIds after restart', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'bobby-session-task-'));
    mkdirSync(join(projectRoot, '.bobby', 'traces'), { recursive: true });
    writeFileSync(
      join(projectRoot, '.bobby', 'traces', 'session-task-1.jsonl'),
      [
        JSON.stringify({
          taskId: 'session-task-1',
          type: 'intent_proposed',
          contract: {
            goal: 'Session-backed task',
            acceptanceCriteria: [{ id: 'AC1', desc: 'Keep the session attached', oracleHint: 'file' }],
            constraints: [],
            inputs: [],
            outOfScope: []
          }
        }),
        JSON.stringify({
          taskId: 'session-task-1',
          type: 'plan_ready',
          steps: [{ id: 'S1', desc: 'Keep the session attached', satisfiesAcIds: ['AC1'], dependsOn: [] }]
        }),
        JSON.stringify({
          taskId: 'session-task-1',
          type: 'final_result',
          status: 'done'
        })
      ].join('\n'),
      'utf8'
    );

    await loadMain([], projectRoot);
    const selectProject = handlers.get('project:select');
    const save = handlers.get('sessions:save');
    const readTask = handlers.get('tasks:read');
    if (!selectProject || !save || !readTask) throw new Error('session/task handlers not registered');

    await selectProject(undefined, { projectDir: projectRoot });
    await save(undefined, {
      id: 'session-1',
      title: 'Session-backed task',
      blocks: [{ kind: 'user', id: 'user-1', text: 'Keep the session attached' }],
      createdAt: '2026-06-11T00:00:00.000Z',
      updatedAt: '2026-06-11T01:00:00.000Z',
      projectDir: projectRoot,
      taskId: 'session-task-1',
      status: 'done',
      liveReasoning: '',
      liveAssistant: '',
      liveToolContent: '',
      currentPlan: [],
      error: null,
      costUsd: 0,
      spendUsd: 0,
      model: null
    } satisfies SessionRecordDto);

    const detail = await readTask(undefined, { taskId: 'session-task-1' }) as {
      sessionIds: string[];
      summary: { taskId: string };
    };

    expect(detail.summary.taskId).toBe('session-task-1');
    expect(detail.sessionIds).toEqual(['session-1']);
  });
});

describe('preview IPC handlers', () => {
  beforeEach(() => {
    handlers.clear();
  });

  it('starts a detached preview server from the selected workspace', async () => {
    await loadMain();
    const startPreview = handlers.get('preview:startDevServer');
    if (!startPreview) throw new Error('preview:startDevServer handler not registered');

    const result = await startPreview(undefined, {
      command: 'node -e "process.exit(0)"',
      url: 'http://localhost:5173'
    }) as PreviewStartResult;

    expect(result).toMatchObject({
      started: true,
      command: 'node -e "process.exit(0)"',
      url: 'http://localhost:5173',
      pid: expect.any(Number)
    });
  });
});

describe('project IPC handlers', () => {
  beforeEach(() => {
    handlers.clear();
  });

  it('binds later kernel work to the selected project root', async () => {
    await loadMain();
    const selectProject = handlers.get('project:select');
    const command = handlers.get('kernel:command');
    if (!selectProject || !command) throw new Error('project or kernel handlers not registered');

    await selectProject(undefined, { projectDir: 'E:\\projects\\selected' });
    await command(undefined, { type: 'startTask', input: 'check project root' });

    const hostCall = (KernelHostMock as unknown as { mock: { calls: Array<Array<unknown>> } }).mock.calls.at(-1);
    expect(hostCall?.[2]).toBe('E:\\projects\\selected');
  });

  it('returns the open-dialog project as the current project and recent project list', async () => {
    await loadMain();
    const openProject = handlers.get('project:open');
    if (!openProject) throw new Error('project:open handler not registered');

    const result = await openProject() as { project: { path: string }; recentProjects: Array<{ path: string }> };

    expect(result.project.path).toBe('E:\\projects\\selected');
    expect(result.recentProjects[0]?.path).toBe('E:\\projects\\selected');
    expect(dialogShowOpenDialog).toHaveBeenCalledTimes(1);
  });

  it('lists snapshots for the current workspace root', async () => {
    await loadMain();
    const selectProject = handlers.get('project:select');
    const listSnapshotsHandler = handlers.get('snapshots:list');
    if (!selectProject || !listSnapshotsHandler) throw new Error('snapshot handlers not registered');

    listSnapshots.mockResolvedValueOnce([
      {
        id: 'snap-1',
        createdAt: '2026-06-11T01:00:00.000Z',
        copied: [{ path: 'src/index.ts', bytes: 42 }],
        skipped: [],
        snapshotDir: 'E:\\projects\\selected\\.bobby\\snapshots\\snap-1'
      }
    ]);

    await selectProject(undefined, { projectDir: 'E:\\projects\\selected' });
    const snapshots = await listSnapshotsHandler() as Array<{ id: string; copied: Array<{ path: string }> }>;

    expect(listSnapshots).toHaveBeenCalledWith('E:\\projects\\selected');
    expect(snapshots[0]?.id).toBe('snap-1');
    expect(snapshots[0]?.copied[0]?.path).toBe('src/index.ts');
  });

  it('searches workspace files from the current project root', async () => {
    await loadMain();
    const selectProject = handlers.get('project:select');
    const searchFilesHandler = handlers.get('workspace:searchFiles');
    if (!selectProject || !searchFilesHandler) throw new Error('workspace search handler not registered');

    const projectRoot = mkdtempSync(join(tempHome, 'workspace-'));
    mkdirSync(join(projectRoot, 'src'), { recursive: true });
    writeFileSync(join(projectRoot, 'src', 'app.ts'), 'export const app = true;', 'utf8');
    await selectProject(undefined, { projectDir: projectRoot });
    const matches = await searchFilesHandler(undefined, { query: 'app' }) as Array<{ path: string }>;

    expect(matches.every((match) => match.path.startsWith('src'))).toBe(true);
    expect(matches.length).toBeGreaterThan(0);
  });
});

describe('desktop integration', () => {
  beforeEach(() => {
    handlers.clear();
    menuSetApplicationMenu.mockClear();
    menuBuildFromTemplate.mockClear();
    traySetToolTip.mockClear();
    traySetContextMenu.mockClear();
    notificationShow.mockClear();
    notificationClick = null;
  });

  it('installs a desktop menu and tray and routes new task commands back to the window', async () => {
    const originalVitest = process.env.VITEST;
    // The integration path is guarded off during tests; drop the flag for this import only.
    delete process.env.VITEST;
    try {
      await loadMain();
    } finally {
      if (originalVitest !== undefined) {
        process.env.VITEST = originalVitest;
      }
    }

    expect(menuSetApplicationMenu).toHaveBeenCalledTimes(1);
    expect(traySetToolTip).toHaveBeenCalledWith('Bobby');
    expect(traySetContextMenu).toHaveBeenCalledTimes(1);

    const appMenu = menuBuildFromTemplate.mock.calls[0]?.[0] as Array<{ label?: string; submenu?: Array<{ label?: string; click?: () => void }> }>;
    const newTaskItem = appMenu?.find((item) => item.label === 'Bobby')?.submenu?.find((item) => item.label === 'New Task');
    newTaskItem?.click?.();

    const windowInstance = (BrowserWindowMock as unknown as {
      mock: { results: Array<{ value: { webContents: { send: ReturnType<typeof vi.fn> } } }> };
    }).mock.results[0]?.value;
    expect(windowInstance.webContents.send).toHaveBeenCalledWith('app:command', { type: 'new-task' });
  });

  it('clicking automation notifications jumps back into the history page', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'automation-notify-'));
    mkdirSync(join(projectRoot, '.bobby'), { recursive: true });
    await loadMain([
      {
        id: 'auto-1',
        title: 'Daily check-in',
        kind: 'schedule',
        prompt: 'Summarize the current Bobby session.',
        intervalMinutes: 30,
        enabled: true,
        createdAt: '2026-06-11T00:00:00.000Z',
        updatedAt: '2026-06-11T00:00:00.000Z',
        lastRunAt: null,
        nextRunAt: '2026-06-11T00:30:00.000Z'
      }
    ], projectRoot);

    const runNow = handlers.get('automations:runNow');
    if (!runNow) throw new Error('automations:runNow handler not registered');

    await runNow(undefined, { id: 'auto-1' });
    expect(notificationShow).toHaveBeenCalled();

    notificationClick?.();

    const windowInstance = (BrowserWindowMock as unknown as {
      mock: { results: Array<{ value: { webContents: { send: ReturnType<typeof vi.fn> } } }> };
    }).mock.results[0]?.value;
    expect(windowInstance.webContents.send).toHaveBeenCalledWith('app:command', { type: 'open-page', page: 'history' });
  });
});

describe('automation IPC handlers', () => {
  beforeEach(() => {
    handlers.clear();
  });

  it('persists create, update, toggle, and remove operations to local storage', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'automation-project-'));
    mkdirSync(join(projectRoot, '.bobby'), { recursive: true });
    await loadMain([], projectRoot);

    const create = handlers.get('automations:create');
    const list = handlers.get('automations:list');
    const update = handlers.get('automations:update');
    const toggle = handlers.get('automations:toggle');
    const remove = handlers.get('automations:remove');

    if (!create || !list || !update || !toggle || !remove) {
      throw new Error('automation handlers not registered');
    }

    const created = await create(undefined, {
      title: 'Daily check-in',
      kind: 'schedule',
      prompt: 'Summarize the current Bobby session.',
      intervalMinutes: 30
    }) as AutomationRecord;

    expect(created.enabled).toBe(true);
    expect(created.nextRunAt).toBeTruthy();

    const storedAfterCreate = await list() as AutomationRecord[];
    expect(storedAfterCreate).toHaveLength(1);
    expect(readFileSync(join(projectRoot, '.bobby', 'automations.json'), 'utf8')).toContain('Daily check-in');

    const updated = await update(undefined, {
      id: created.id,
      prompt: 'Summarize the current Bobby session and mention blockers.',
      intervalMinutes: 45
    }) as AutomationRecord;
    expect(updated.intervalMinutes).toBe(45);
    expect(updated.prompt).toContain('blockers');

    const toggled = await toggle(undefined, { id: created.id }) as AutomationRecord;
    expect(toggled.enabled).toBe(false);

    const removed = await remove(undefined, { id: created.id }) as boolean;
    expect(removed).toBe(true);
    expect(await list()).toEqual([]);
  });

  it('surfaces run-now failures through visible error and notification hooks', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'automation-failure-'));
    mkdirSync(join(projectRoot, '.bobby'), { recursive: true });
    const failingSend = vi.fn(async () => {
      throw new Error('boom');
    });
    KernelHostMock.mockImplementation(() => ({
      subscribe: vi.fn(() => () => undefined),
      send: failingSend
    }));

    try {
      await loadMain([], projectRoot);
      const create = handlers.get('automations:create');
      const runNow = handlers.get('automations:runNow');
      if (!create || !runNow) throw new Error('automation handlers not registered');

      const created = await create(undefined, {
        title: 'Failure ping',
        kind: 'monitor',
        prompt: 'Summarize the latest session.',
        intervalMinutes: 15
      }) as AutomationRecord;

      await runNow(undefined, { id: created.id });

      expect(notificationShow).toHaveBeenCalled();
      const windowInstance = (BrowserWindowMock as unknown as {
        mock: { results: Array<{ value: { webContents: { send: ReturnType<typeof vi.fn> } } }> };
      }).mock.results[0]?.value;
      expect(windowInstance.webContents.send).toHaveBeenCalledWith(
        'kernel:event',
        expect.objectContaining({
          type: 'error',
          taskId: 'system'
        })
      );
    } finally {
      KernelHostMock.mockImplementation(() => ({
        subscribe: vi.fn(() => () => undefined),
        send: vi.fn(async () => undefined)
      }));
    }
  });

  it('runs due automations on the background timer', async () => {
    vi.useFakeTimers();

    const listeners = new Set<(event: unknown) => void>();
    KernelHostMock.mockImplementation(() => ({
      subscribe: vi.fn((listener: (event: unknown) => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
          return undefined;
        };
      }),
      send: vi.fn(async () => {
        const taskId = 'automation-task-1';
        const events = [
          { type: 'intent_proposed', taskId, contract: { goal: 'Morning ping', acceptanceCriteria: [{ id: 'AC1', desc: 'Reply', oracleHint: 'human' }], constraints: [], inputs: [], outOfScope: [] } },
          { type: 'plan_ready', taskId, steps: [{ id: 'S1', desc: 'Send reminder', satisfiesAcIds: ['AC1'], dependsOn: [] }] },
          { type: 'direct_answer', taskId, text: 'Ping complete' },
          { type: 'final_result', taskId, status: 'done' }
        ] as const;
        for (const event of events) {
          for (const listener of listeners) {
            listener(event);
          }
        }
      })
    }));

    const due = new Date(Date.now() - 60_000).toISOString();
    const automation: AutomationRecord = {
      id: 'automation-test-1',
      title: 'Morning ping',
      kind: 'reminder',
      prompt: 'Ping Bobby and report back.',
      intervalMinutes: 15,
      enabled: true,
      createdAt: due,
      updatedAt: due,
      lastRunAt: null,
      nextRunAt: due
    };

    const projectRoot = mkdtempSync(join(tmpdir(), 'automation-timer-'));
    mkdirSync(join(projectRoot, '.bobby'), { recursive: true });
    await loadMain([automation], projectRoot);
    await vi.advanceTimersByTimeAsync(15_000);

    const hostResults = (KernelHostMock as unknown as { mock: { results: Array<{ value: { send: ReturnType<typeof vi.fn> } }> } }).mock.results.map((result) => result.value);
    expect(hostResults.some((host) => host.send.mock.calls.some(([cmd]) =>
      (cmd as { type?: string; mode?: string }).type === 'startTask' &&
      (cmd as { mode?: string }).mode === 'full'
    ))).toBe(true);

    const taskDir = join(projectRoot, '.bobby', 'tasks', 'automation-task-1');
    expect(existsSync(join(taskDir, 'task.json'))).toBe(true);
    expect(readFileSync(join(taskDir, 'task.json'), 'utf8')).toContain('Morning ping');
    expect(readFileSync(join(taskDir, 'report.md'), 'utf8')).toContain('Ping complete');
    expect(notificationShow).toHaveBeenCalled();
  });
});
