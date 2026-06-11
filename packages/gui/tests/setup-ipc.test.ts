import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { BrowserWindow } from 'electron';
import type { AutomationRecord, SessionRecordDto } from '../src/ipc/contract';

const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
let tempHome = '';
let originalHome = '';
let originalUserProfile = '';

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
const NotificationMock = Object.assign(vi.fn(() => ({
  show: notificationShow
})), {
  isSupported: vi.fn(() => true)
});
const safeStorageIsEncryptionAvailable = vi.fn(() => true);
const safeStorageEncryptString = vi.fn((value: string) => Buffer.from(`encrypted:${value}`, 'utf8'));
const safeStorageDecryptString = vi.fn((value: Buffer) => value.toString('utf8').replace(/^encrypted:/, ''));

const BrowserWindowMock = vi.fn(() => ({
  isDestroyed: vi.fn(() => false),
  webContents: { send: vi.fn() },
  loadURL: vi.fn(),
  loadFile: vi.fn()
})) as unknown as typeof BrowserWindow;
BrowserWindowMock.getAllWindows = vi.fn((): BrowserWindow[] => []);

const KernelHostMock = vi.fn(() => ({
  subscribe: vi.fn(() => () => undefined),
  send: vi.fn(async () => undefined)
}));
const makeDeepSeekClient = vi.fn(() => ({}));
const listSnapshots = vi.fn(async () => []);
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
  listSnapshots,
  makeDeepSeekClient,
  loadDeepSeekConfig
}));

vi.mock('../electron/updater', () => ({
  initAutoUpdate: vi.fn()
}));

async function loadMain(initialAutomations: AutomationRecord[] = []): Promise<void> {
  vi.resetModules();
  handlers.clear();
  tempHome = mkdtempSync(join(tmpdir(), 'bobby-gui-setup-'));
  mkdirSync(join(tempHome, '.bobby'), { recursive: true });
  writeFileSync(join(tempHome, '.bobby', 'key'), 'deepseek-key\n', 'utf8');
  writeFileSync(join(tempHome, '.bobby', 'capabilities.json'), '{}\n', 'utf8');
  writeFileSync(join(tempHome, '.bobby', 'automations.json'), JSON.stringify(initialAutomations, null, 2), 'utf8');
  originalHome = process.env.HOME ?? '';
  originalUserProfile = process.env.USERPROFILE ?? '';
  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;
  appGetPath.mockReturnValue(tempHome);
  safeStorageIsEncryptionAvailable.mockReturnValue(true);
  safeStorageEncryptString.mockImplementation((value: string) => Buffer.from(`encrypted:${value}`, 'utf8'));
  safeStorageDecryptString.mockImplementation((value: Buffer) => value.toString('utf8').replace(/^encrypted:/, ''));
  makeDeepSeekClient.mockClear();
  loadDeepSeekConfig.mockClear();

  await import('../electron/main');
  await appWhenReady.mock.results[0]?.value;
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
});

describe('automation IPC handlers', () => {
  beforeEach(() => {
    handlers.clear();
  });

  it('persists create, update, toggle, and remove operations to local storage', async () => {
    await loadMain();

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
    expect(readFileSync(join(tempHome, '.bobby', 'automations.json'), 'utf8')).toContain('Daily check-in');

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
    const failingSend = vi.fn(async () => {
      throw new Error('boom');
    });
    KernelHostMock.mockImplementation(() => ({
      subscribe: vi.fn(() => () => undefined),
      send: failingSend
    }));

    try {
      await loadMain();
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

    await loadMain([automation]);
    await vi.advanceTimersByTimeAsync(15_000);

    const host = (KernelHostMock as unknown as { mock: { results: Array<{ value: { send: ReturnType<typeof vi.fn> } }> } }).mock.results[0]?.value;
    expect(host.send).toHaveBeenCalledWith({
      type: 'startTask',
      input: 'Ping Bobby and report back.'
    });

    const windowInstance = (BrowserWindowMock as unknown as {
      mock: { results: Array<{ value: { webContents: { send: ReturnType<typeof vi.fn> } } }> };
    }).mock.results[0]?.value;
    expect(windowInstance.webContents.send).toHaveBeenCalledWith(
      'kernel:event',
      expect.objectContaining({
        type: 'direct_answer',
        taskId: 'automation:automation-test-1'
      })
    );
  });
});
