import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Notification, safeStorage, shell, Tray } from 'electron';
import {
  applySubAgentProposal,
  CompletionGate,
  CommandExitOracle,
  ExecTool,
  FileDiffOracle,
  FileExistsOracle,
  FileExistsTool,
  KernelHost,
  listSnapshots,
  loadDeepSeekConfig,
  makeDeepSeekClient,
  NoForbiddenPathChecker,
  dispatchSubAgent,
  ToolEvidenceProvider,
  ToolRegistry,
  VerificationEngine,
  Workspace,
  WriteFileTool
} from '@bobby/kernel';
import {
  AppSettingsSchema,
  AppSettingsUpdateSchema,
  AutomationCreateInputSchema,
  AutomationRecordSchema,
  AutomationRemoveInputSchema,
  AutomationToggleInputSchema,
  AutomationUpdateInputSchema,
  ProjectSelectResultSchema,
  ProposalApplyInputSchema,
  ProposalDiscardInputSchema,
  ProposalSummarySchema,
  McpServerRecordSchema,
  McpServerRemoveInputSchema,
  McpServerToggleInputSchema,
  McpServerUpsertInputSchema,
  SessionRecordSchema,
  SnapshotListEntrySchema,
  TerminalRunInputSchema,
  SubAgentDispatchInputSchema,
  SubAgentRemoveInputSchema,
  SubAgentUpsertInputSchema,
  WorkspaceReadFileInputSchema,
  WorkspaceReadFileResultSchema,
  WorkspaceTreeNodeSchema,
  WorkspaceFileSearchEntrySchema,
  TaskDetailSchema,
  TaskSummarySchema,
  type AppSettings,
  type AutomationRecord,
  type OnboardingStatus,
  type ProjectMeta,
  type ProjectSelectResult,
  type ProposalSummary,
  type McpServerRecordDto,
  type McpServerRemoveInput,
  type McpServerToggleInput,
  type McpServerUpsertInput,
  type SessionRecordDto,
  type SubAgentRecordDto,
  type TaskDetail,
  type TaskSummary,
  type WorkspaceReadFileResult,
  type WorkspaceTreeNode,
  type WorkspaceFileSearchEntry
} from '../src/ipc/contract';
import {
  createSubAgentDispatchRecord,
  listSubAgentDispatches,
  listSubAgents,
  markProposalApplied,
  removeSubAgent,
  resolveAgentPath,
  updateSubAgentDispatchRecord,
  upsertSubAgent
} from './agents-manager';
import {
  ensureDefaultMcpServers,
  listMcpServers,
  registerMcpTools,
  removeMcpServer,
  resolveMcpServersFile,
  saveMcpServers,
  toggleMcpServer,
  upsertMcpServer
} from './mcp-manager';
import { initAutoUpdate } from './updater';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const QUICKSTART_URL = 'https://github.com/bpc-oss/bobby/blob/main/docs/quickstart.md';
const BOBBY_DIR = '.bobby';
const KEY_FILE = 'key';
const CAPABILITIES_FILE = 'capabilities.json';
const AUTOMATIONS_FILE = 'automations.json';
const AUTOMATION_TICK_MS = 15_000;
const PROJECTS_FILE = 'projects.json';
const SETTINGS_FILE = 'settings.json';
const SECRET_FILE = 'deepseek.key';
const SESSIONS_DIR = 'sessions';
const WINDOW_STATE_FILE = 'window-state.json';

let pendingHost: Promise<KernelHost | null> | null = null;
let hostInitError: Error | null = null;
let automationTimer: NodeJS.Timeout | null = null;
let currentProjectDir: string | null = null;
let currentProject: ProjectMeta | null = null;
let currentHost: KernelHost | null = null;
let tray: Tray | null = null;
const toolRegistry = new ToolRegistry();
const toolEvidenceProvider = new ToolEvidenceProvider(toolRegistry);

function registerWorkspaceTools(registry: ToolRegistry, workspaceRoot: string): void {
  const workspace = new Workspace(workspaceRoot);
  registry.register(new ExecTool(workspaceRoot));
  registry.register(new WriteFileTool(workspace));
  registry.register(new FileExistsTool(workspace));
  const servers = ensureDefaultMcpServers(app.getPath('userData'), workspaceRoot);
  registerMcpTools(registry, servers, workspaceRoot);
}

function createConscienceDepsForWorkspace(workspaceRoot: string, registry = new ToolRegistry()) {
  registerWorkspaceTools(registry, workspaceRoot);
  const evidenceProvider = new ToolEvidenceProvider(registry);
  return {
    engine: new VerificationEngine([new CommandExitOracle(), new FileDiffOracle(), new FileExistsOracle()]),
    gate: new CompletionGate(),
    evidenceFor: (
      stepId: string,
      acIds: string[],
      calls?: Parameters<ToolEvidenceProvider['evidenceFor']>[2],
      acCriteria?: Parameters<ToolEvidenceProvider['evidenceFor']>[3]
    ) => evidenceProvider.evidenceFor(stepId, acIds, calls, acCriteria),
    constraintCheckers: [new NoForbiddenPathChecker()],
    context: () => evidenceProvider.context(),
    toolRegistry: registry
  };
}

let conscienceDeps = {
  engine: new VerificationEngine([new CommandExitOracle(), new FileDiffOracle(), new FileExistsOracle()]),
  gate: new CompletionGate(),
  evidenceFor: (
    stepId: string,
    acIds: string[],
    calls?: Parameters<ToolEvidenceProvider['evidenceFor']>[2],
    acCriteria?: Parameters<ToolEvidenceProvider['evidenceFor']>[3]
  ) => toolEvidenceProvider.evidenceFor(stepId, acIds, calls, acCriteria),
  constraintCheckers: [new NoForbiddenPathChecker()],
  context: () => toolEvidenceProvider.context(),
  toolRegistry
};

let mainWindow: BrowserWindow | null = null;

const DEFAULT_SETTINGS: AppSettings = {
  modelStrategy: 'auto',
  baseUrl: 'https://api.deepseek.com',
  workspaceDir: process.cwd(),
  budgetUsd: 10,
  defaultPermission: 'L1',
  strongSandbox: true,
  hasApiKey: false
};

type WindowState = {
  width: number;
  height: number;
  x?: number;
  y?: number;
};

function resolveSetupPaths() {
  const homeDir = homedir();
  const bobbyDir = join(homeDir, BOBBY_DIR);
  return {
    homeDir,
    bobbyDir,
    keyPath: join(bobbyDir, KEY_FILE),
    capabilitiesPath: join(bobbyDir, CAPABILITIES_FILE)
  };
}

function userDataPath(fileName: string): string {
  return join(app.getPath('userData'), fileName);
}

function readJsonFile<T>(path: string, fallback: T): T {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2), 'utf8');
}

function readWindowState(): WindowState {
  const parsed = readJsonFile<Partial<WindowState>>(userDataPath(WINDOW_STATE_FILE), {});
  return {
    width: typeof parsed.width === 'number' ? parsed.width : 1180,
    height: typeof parsed.height === 'number' ? parsed.height : 760,
    x: typeof parsed.x === 'number' ? parsed.x : undefined,
    y: typeof parsed.y === 'number' ? parsed.y : undefined
  };
}

function writeWindowState(window: BrowserWindow): void {
  if (window.isDestroyed()) return;
  writeJsonFile(userDataPath(WINDOW_STATE_FILE), window.getBounds());
}

function projectName(projectDir: string): string {
  return projectDir.split(/[\\/]/).filter(Boolean).at(-1) ?? projectDir;
}

function fileSearchScore(path: string, query: string): number {
  const lowerPath = path.toLowerCase();
  const lowerQuery = query.toLowerCase();
  if (!lowerQuery) return 0;
  if (lowerPath === lowerQuery) return 0;
  if (lowerPath.includes(lowerQuery)) return lowerPath.indexOf(lowerQuery);

  let score = 0;
  let cursor = 0;
  for (const char of lowerQuery) {
    const index = lowerPath.indexOf(char, cursor);
    if (index === -1) {
      return Number.POSITIVE_INFINITY;
    }
    score += index - cursor;
    cursor = index + 1;
  }

  return score + lowerPath.length;
}

function searchWorkspaceFiles(workspaceRoot: string, query: string, limit = 20): WorkspaceFileSearchEntry[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const matches: Array<WorkspaceFileSearchEntry & { score: number }> = [];
  const queue: string[] = [workspaceRoot];
  const excluded = new Set(['node_modules', '.git', '.bobby']);

  while (queue.length > 0 && matches.length < 200) {
    const current = queue.shift();
    if (!current) continue;

    try {
      const entries = readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        if (excluded.has(entry.name) && entry.isDirectory()) {
          continue;
        }

        const absolute = join(current, entry.name);
        const rel = relative(workspaceRoot, absolute).split('\\').join('/');
        if (entry.isDirectory()) {
          if (!excluded.has(entry.name)) {
            queue.push(absolute);
          }
          continue;
        }

        const score = fileSearchScore(rel, normalizedQuery);
        if (!Number.isFinite(score)) {
          continue;
        }

        matches.push({
          path: rel,
          preview: basename(entry.name),
          score
        });
      }
    } catch {
      continue;
    }
  }

  return matches
    .sort((left, right) => left.score - right.score || left.path.localeCompare(right.path))
    .slice(0, limit)
    .map(({ score, ...entry }) => entry);
}

function isWorkspaceTreeExcluded(name: string): boolean {
  return name === 'node_modules' || name === '.git' || name === '.bobby' || name === 'dist' || name === 'build';
}

function buildWorkspaceTreeEntries(workspaceRoot: string, currentPath = workspaceRoot, depth = 0, maxDepth = 4): WorkspaceTreeNode[] {
  try {
    const entries = readdirSync(currentPath, { withFileTypes: true });
    return entries
      .filter((entry) => !isWorkspaceTreeExcluded(entry.name))
      .sort((left, right) => {
        if (left.isDirectory() !== right.isDirectory()) {
          return left.isDirectory() ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
      })
      .map((entry) => {
        const absolute = join(currentPath, entry.name);
        const node: WorkspaceTreeNode = {
          name: entry.name,
          path: relative(workspaceRoot, absolute).split('\\').join('/'),
          kind: entry.isDirectory() ? 'directory' : 'file'
        };

        if (!entry.isDirectory()) {
          try {
            node.size = statSync(absolute).size;
          } catch {
            node.size = undefined;
          }
          return node;
        }

        if (depth < maxDepth) {
          node.children = buildWorkspaceTreeEntries(workspaceRoot, absolute, depth + 1, maxDepth);
        }
        return node;
      });
  } catch {
    return [];
  }
}

function readWorkspaceTextFile(workspaceRoot: string, relativePath: string): WorkspaceReadFileResult | null {
  const absolute = resolve(workspaceRoot, relativePath);
  const normalizedRoot = resolve(workspaceRoot);
  if (relative(normalizedRoot, absolute).startsWith('..')) {
    return null;
  }

  try {
    const content = readFileSync(absolute, 'utf8');
    return {
      path: relative(normalizedRoot, absolute).split('\\').join('/'),
      content
    };
  } catch {
    return null;
  }
}

function readRecentProjects(): ProjectMeta[] {
  const parsed = readJsonFile<unknown[]>(userDataPath(PROJECTS_FILE), []);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item) => {
      const result = ProjectSelectResultSchema.shape.project.safeParse(item);
      return result.success ? result.data : null;
    })
    .filter((item): item is ProjectMeta => item !== null);
}

function writeRecentProjects(projects: ProjectMeta[]): void {
  writeJsonFile(userDataPath(PROJECTS_FILE), projects.slice(0, 20));
}

function rememberProject(projectDir: string): ProjectSelectResult {
  const project: ProjectMeta = {
    name: projectName(projectDir),
    path: projectDir,
    lastOpenedAt: new Date().toISOString()
  };
  const recentProjects = [project, ...readRecentProjects().filter((item) => item.path !== projectDir)];
  writeRecentProjects(recentProjects);
  currentProjectDir = projectDir;
  currentProject = project;
  pendingHost = createHost();
  return ProjectSelectResultSchema.parse({ project, recentProjects });
}

function secretPath(): string {
  return userDataPath(SECRET_FILE);
}

function hasStoredSecret(): boolean {
  return existsSync(secretPath()) || fileHasText(resolveSetupPaths().keyPath) || Boolean(process.env.DEEPSEEK_API_KEY?.trim());
}

function writeSecret(secret: string): void {
  mkdirSync(dirname(secretPath()), { recursive: true });
  const value = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(secret).toString('base64')
    : Buffer.from(secret, 'utf8').toString('base64');
  writeFileSync(secretPath(), value, 'utf8');
}

function readSecret(): string | null {
  const envKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (envKey) return envKey;
  try {
    if (!existsSync(secretPath())) return null;
    const raw = readFileSync(secretPath(), 'utf8').trim();
    if (!raw) return null;
    const buffer = Buffer.from(raw, 'base64');
    return safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(buffer)
      : buffer.toString('utf8');
  } catch {
    return null;
  }
}

function readPublicSettings(): AppSettings {
  const raw = readJsonFile<unknown>(userDataPath(SETTINGS_FILE), {});
  const parsed = AppSettingsSchema.omit({ hasApiKey: true }).partial().safeParse(raw);
  return AppSettingsSchema.parse({
    ...DEFAULT_SETTINGS,
    ...(parsed.success ? parsed.data : {}),
    workspaceDir: currentProjectDir ?? (parsed.success ? parsed.data.workspaceDir : undefined) ?? DEFAULT_SETTINGS.workspaceDir,
    hasApiKey: hasStoredSecret()
  });
}

function writePublicSettings(update: unknown): AppSettings {
  const parsed = AppSettingsUpdateSchema.parse(update);
  if (parsed.apiKey) {
    writeSecret(parsed.apiKey);
  }
  const { apiKey: _apiKey, ...publicUpdate } = parsed;
  const next = {
    ...readPublicSettings(),
    ...publicUpdate,
    hasApiKey: hasStoredSecret()
  };
  const { hasApiKey: _hasApiKey, ...persisted } = next;
  writeJsonFile(userDataPath(SETTINGS_FILE), persisted);
  pendingHost = createHost();
  return AppSettingsSchema.parse(next);
}

function sessionsDir(): string {
  return userDataPath(SESSIONS_DIR);
}

function dedupeSessionRecords(records: SessionRecordDto[], pruneFiles = false): SessionRecordDto[] {
  const sorted = [...records].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  const kept = new Map<string, SessionRecordDto>();
  const pruned: SessionRecordDto[] = [];
  for (const session of sorted) {
    if (kept.has(session.title)) {
      pruned.push(session);
    } else {
      kept.set(session.title, session);
    }
  }
  if (pruneFiles) {
    for (const session of pruned) {
      try {
        unlinkSync(join(sessionsDir(), `${session.id}.json`));
      } catch {
        // Stale session cleanup is best-effort.
      }
    }
  }
  return Array.from(kept.values());
}

function readSessions(): SessionRecordDto[] {
  try {
    if (!existsSync(sessionsDir())) return [];
    const records = readdirSync(sessionsDir())
      .filter((name) => name.endsWith('.json'))
      .map((name) => readJsonFile<unknown>(join(sessionsDir(), name), null))
      .map((item) => SessionRecordSchema.safeParse(item))
      .filter((result): result is { success: true; data: SessionRecordDto } => result.success)
      .map((result) => result.data);
    return dedupeSessionRecords(records, true);
  } catch {
    return [];
  }
}

function readSession(sessionId: string): SessionRecordDto | null {
  const parsed = SessionRecordSchema.safeParse(readJsonFile<unknown>(join(sessionsDir(), `${sessionId}.json`), null));
  return parsed.success ? parsed.data : null;
}

function writeSession(session: unknown): SessionRecordDto {
  const parsed = SessionRecordSchema.parse(session);
  for (const existing of readSessions()) {
    if (existing.id !== parsed.id && existing.title === parsed.title) {
      try {
        unlinkSync(join(sessionsDir(), `${existing.id}.json`));
      } catch {
        // A concurrently removed stale session can be ignored.
      }
    }
  }
  writeJsonFile(join(sessionsDir(), `${parsed.id}.json`), parsed);
  return parsed;
}

function taskRoot(): string | null {
  return currentProjectDir ? join(currentProjectDir, BOBBY_DIR, 'tasks') : null;
}

function currentWorkspaceRoot(): string {
  return currentProjectDir ?? process.cwd();
}

function refreshToolRegistry(): void {
  toolRegistry.clear();
  registerWorkspaceTools(toolRegistry, currentWorkspaceRoot());
}

function readTaskFile(taskId: string, fileName: string): unknown | null {
  const root = taskRoot();
  if (!root) return null;
  return readJsonFile<unknown>(join(root, taskId, fileName), null);
}

function readTextTaskFile(taskId: string, fileName: string): string | null {
  const root = taskRoot();
  if (!root) return null;
  try {
    const path = join(root, taskId, fileName);
    return existsSync(path) ? readFileSync(path, 'utf8') : null;
  } catch {
    return null;
  }
}

function taskIds(): string[] {
  const root = taskRoot();
  try {
    if (!root || !existsSync(root)) return [];
    return readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

function taskSummary(taskId: string): TaskSummary | null {
  const root = taskRoot();
  if (!root) return null;
  const taskDir = join(root, taskId);
  const meta = readJsonFile<Record<string, unknown>>(join(taskDir, 'task.json'), {});
  const fallbackTime = existsSync(taskDir) ? new Date(statSync(taskDir).mtimeMs).toISOString() : new Date().toISOString();
  const summary = {
    taskId,
    userGoal: String(meta.userGoal ?? meta.goal ?? taskId),
    state: String(meta.state ?? meta.status ?? 'unknown'),
    taskType: String(meta.taskType ?? 'task'),
    createdAt: String(meta.createdAt ?? fallbackTime),
    updatedAt: String(meta.updatedAt ?? fallbackTime),
    traceCount: Array.isArray(currentHost?.getTrace(taskId)) ? currentHost!.getTrace(taskId).length : 0,
    hasContract: existsSync(join(taskDir, 'contract.json')),
    hasPlan: existsSync(join(taskDir, 'plan.json')),
    hasReport: existsSync(join(taskDir, 'report.md'))
  };
  const parsed = TaskSummarySchema.safeParse(summary);
  return parsed.success ? parsed.data : null;
}

function taskDetail(taskId: string): TaskDetail | null {
  const summary = taskSummary(taskId);
  if (!summary) return null;
  return TaskDetailSchema.parse({
    summary,
    contract: readTaskFile(taskId, 'contract.json'),
    plan: readTaskFile(taskId, 'plan.json'),
    report: readTextTaskFile(taskId, 'report.md'),
    trace: currentHost?.getTrace(taskId) ?? [],
    sessionIds: readSessions().filter((session) => session.taskId === taskId).map((session) => session.id)
  });
}

function proposalsDir(): string | null {
  return currentProjectDir ? join(currentProjectDir, BOBBY_DIR, 'proposals') : null;
}

function proposalPath(proposalId: string): string | null {
  const root = proposalsDir();
  if (!root) return null;
  return join(root, `${proposalId}.patch`);
}

function readProposalSummary(path: string): ProposalSummary | null {
  try {
    const patch = readFileSync(path, 'utf8');
    const id = path.split(/[\\/]/).pop()?.replace(/\.patch$/, '');
    if (!id) return null;
    return ProposalSummarySchema.parse({
      proposalId: id,
      proposalPath: path,
      createdAt: new Date(statSync(path).mtimeMs).toISOString(),
      bytes: Buffer.byteLength(patch),
      lineCount: patch.split(/\r?\n/).length,
      patch
    });
  } catch {
    return null;
  }
}

function listProposals(): ProposalSummary[] {
  const root = proposalsDir();
  try {
    if (!root || !existsSync(root)) return [];
    return readdirSync(root)
      .filter((name) => name.endsWith('.patch'))
      .map((name) => readProposalSummary(join(root, name)))
      .filter((item): item is ProposalSummary => item !== null)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  } catch {
    return [];
  }
}

function fileHasText(path: string): boolean {
  try {
    return existsSync(path) && readFileSync(path, 'utf8').trim().length > 0;
  } catch {
    return false;
  }
}

function resolveAutomationsPath() {
  return join(homedir(), BOBBY_DIR, AUTOMATIONS_FILE);
}

function nowIso(): string {
  return new Date().toISOString();
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function readAutomations(): AutomationRecord[] {
  const filePath = resolveAutomationsPath();
  try {
    if (!existsSync(filePath)) {
      return [];
    }

    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => AutomationRecordSchema.safeParse(entry))
      .filter((result): result is { success: true; data: AutomationRecord } => result.success)
      .map((result) => result.data)
      .sort((left, right) => new Date(left.nextRunAt).getTime() - new Date(right.nextRunAt).getTime());
  } catch {
    return [];
  }
}

function writeAutomations(records: AutomationRecord[]): void {
  const filePath = resolveAutomationsPath();
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf8');
}

function upsertAutomation(nextAutomation: AutomationRecord): AutomationRecord {
  const current = readAutomations();
  const next = current.some((item) => item.id === nextAutomation.id)
    ? current.map((item) => (item.id === nextAutomation.id ? nextAutomation : item))
    : [...current, nextAutomation];
  writeAutomations(next);
  return nextAutomation;
}

function getAutomationById(id: string): AutomationRecord | null {
  return readAutomations().find((item) => item.id === id) ?? null;
}

function createAutomation(input: unknown): AutomationRecord {
  const parsed = AutomationCreateInputSchema.parse(input);
  const createdAt = nowIso();
  return {
    id: `automation-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    title: parsed.title,
    kind: parsed.kind,
    prompt: parsed.prompt,
    intervalMinutes: parsed.intervalMinutes,
    enabled: true,
    createdAt,
    updatedAt: createdAt,
    lastRunAt: null,
    nextRunAt: addMinutes(createdAt, parsed.intervalMinutes)
  };
}

async function runAutomation(automation: AutomationRecord): Promise<AutomationRecord> {
  const updated: AutomationRecord = {
    ...automation,
    lastRunAt: nowIso(),
    nextRunAt: addMinutes(nowIso(), automation.intervalMinutes),
    updatedAt: nowIso()
  };

  upsertAutomation(updated);

  const host = await (pendingHost ?? (pendingHost = createHost()));
  if (!host) {
    notifySystem(`Automation "${automation.title}" is ready, but Bobby is not configured yet.`);
    return updated;
  }

  try {
    await host.send({ type: 'startTask', input: automation.prompt });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('kernel:event', {
        type: 'direct_answer',
        taskId: `automation:${automation.id}`,
        text: `Automation triggered: ${automation.title}`
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    notifySystem(`Automation "${automation.title}" failed: ${message}`);
  }

  return updated;
}

async function tickAutomations(): Promise<void> {
  const records = readAutomations();
  const now = Date.now();
  for (const record of records) {
    if (!record.enabled) {
      continue;
    }

    if (new Date(record.nextRunAt).getTime() > now) {
      continue;
    }

    await runAutomation(record);
  }
}

function startAutomationTimer(): void {
  if (automationTimer) {
    return;
  }

  automationTimer = setInterval(() => {
    void tickAutomations();
  }, AUTOMATION_TICK_MS);
}

function stopAutomationTimer(): void {
  if (automationTimer) {
    clearInterval(automationTimer);
    automationTimer = null;
  }
}

function getSetupStatus(): OnboardingStatus {
  const paths = resolveSetupPaths();
  return {
    ...paths,
    hasKey: fileHasText(paths.keyPath),
    hasCapabilities: fileHasText(paths.capabilitiesPath),
    hasEnvKey: Boolean(process.env.DEEPSEEK_API_KEY?.trim())
  };
}

const notifySystem = (message: string) => {
  if (Notification.isSupported()) {
    new Notification({ title: 'Bobby', body: message }).show();
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send('kernel:event', {
    type: 'error',
    taskId: 'system',
    message
  });
};

const createWindow = () => {
  const state = readWindowState();
  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  if (typeof mainWindow.on === 'function') {
    mainWindow.on('close', () => {
      if (mainWindow) writeWindowState(mainWindow);
    });
  }

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }
};

function setupDesktopIntegration(): void {
  if (process.env.VITEST) {
    return;
  }

  const openMainWindow = () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
      return;
    }
    mainWindow.show();
    mainWindow.focus();
  };

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Bobby',
      submenu: [
        { label: 'New Task', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.send('app:command', { type: 'new-task' }) },
        { label: 'Focus Task', accelerator: 'CmdOrCtrl+L', click: openMainWindow },
        { type: 'separator' },
        { label: 'Quit', role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', role: 'reload' },
        { label: 'Toggle Developer Tools', role: 'toggleDevTools' }
      ]
    }
  ]));

  if (!tray) {
    tray = new Tray(nativeImage.createEmpty());
    tray.setToolTip('Bobby');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open Bobby', click: openMainWindow },
      { label: 'New Task', click: () => mainWindow?.webContents.send('app:command', { type: 'new-task' }) },
      { type: 'separator' },
      { label: 'Quit', role: 'quit' }
    ]));
  }
}

async function createModelClient(agent?: SubAgentRecordDto) {
  const settings = readPublicSettings();
  const loaded = await loadDeepSeekConfig();
  const report = agent?.model ? { ...loaded.report, runnerModel: agent.model } : loaded.report;
  return makeDeepSeekClient(readSecret() ?? loaded.apiKey, report, settings.baseUrl);
}

function createSubAgentConscienceDeps(workspaceRoot: string) {
  return createConscienceDepsForWorkspace(workspaceRoot);
}

async function runSubAgentTaskInWorktree(agent: SubAgentRecordDto, task: string, worktreePath: string): Promise<void> {
  const model = await createModelClient(agent);
  const host = new KernelHost(() => model, createSubAgentConscienceDeps(worktreePath), worktreePath, false);
  await host.send({
    type: 'startTask',
    input: `${agent.systemPrompt}\n\nTask:\n${task}\n\nTools: ${agent.tools.join(', ')}`
  });
}

const createHost = async () => {
  try {
    const model = await createModelClient();
    const workspaceRoot = currentProjectDir ?? process.cwd();
    refreshToolRegistry();
    const host = new KernelHost(() => model, conscienceDeps, workspaceRoot, true);
    currentHost = host;
    return host;
  } catch (err) {
    if (err instanceof Error) {
      hostInitError = err;
    } else {
      hostInitError = new Error('Kernel 启动失败');
    }
    return null;
  }
};

const bootstrap = async () => {
  const runtimeHost = await (pendingHost ?? (pendingHost = createHost()));
  if (!runtimeHost) {
    return;
  }

  runtimeHost.subscribe((event) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    mainWindow.webContents.send('kernel:event', event);
  });
};

ipcMain.handle('setup:status', async () => getSetupStatus());

ipcMain.handle('setup:openQuickstart', async () => shell.openExternal(QUICKSTART_URL));

ipcMain.handle('project:list', async () => readRecentProjects());

ipcMain.handle('project:getCurrent', async () => currentProject);

ipcMain.handle('project:open', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths[0]) {
    return null;
  }
  return rememberProject(result.filePaths[0]);
});

ipcMain.handle('project:select', async (_event, input) => {
  const parsed = ProjectSelectResultSchema.pick({ project: true }).shape.project.pick({ path: true }).parse({
    path: typeof input === 'object' && input !== null && 'projectDir' in input ? (input as { projectDir?: unknown }).projectDir : input
  });
  return rememberProject(parsed.path);
});

ipcMain.handle('settings:get', async () => readPublicSettings());

ipcMain.handle('settings:set', async (_event, input) => writePublicSettings(input));

ipcMain.handle('sessions:list', async () => readSessions());

ipcMain.handle('sessions:read', async (_event, input) => {
  const sessionId = typeof input === 'object' && input !== null && 'sessionId' in input ? String((input as { sessionId?: unknown }).sessionId) : '';
  return sessionId ? readSession(sessionId) : null;
});

ipcMain.handle('sessions:save', async (_event, input) => writeSession(input));

ipcMain.handle('tasks:list', async () => taskIds().map(taskSummary).filter((item): item is TaskSummary => item !== null));

ipcMain.handle('tasks:read', async (_event, input) => {
  const taskId = typeof input === 'object' && input !== null && 'taskId' in input ? String((input as { taskId?: unknown }).taskId) : '';
  return taskId ? taskDetail(taskId) : null;
});

ipcMain.handle('proposals:list', async () => listProposals());

ipcMain.handle('proposals:read', async (_event, input) => {
  const proposalId = typeof input === 'object' && input !== null && 'proposalId' in input ? String((input as { proposalId?: unknown }).proposalId) : '';
  const path = proposalId ? proposalPath(proposalId) : null;
  return path ? readProposalSummary(path) : null;
});

ipcMain.handle('proposals:apply', async (_event, input) => {
  const parsed = ProposalApplyInputSchema.parse(input);
  const path = proposalPath(parsed.proposalId);
  if (!path || !currentProjectDir || !existsSync(path)) {
    return null;
  }
  applySubAgentProposal(path, parsed, currentProjectDir);
  markProposalApplied(currentWorkspaceRoot(), parsed.proposalId);
  const summary = readProposalSummary(path);
  unlinkSync(path);
  return summary;
});

ipcMain.handle('proposals:discard', async (_event, input) => {
  const parsed = ProposalDiscardInputSchema.parse(input);
  const path = proposalPath(parsed.proposalId);
  if (!path || !existsSync(path)) {
    return false;
  }
  unlinkSync(path);
  return true;
});

ipcMain.handle('snapshots:list', async () => {
  const parsed = SnapshotListEntrySchema.array().safeParse(await listSnapshots(currentWorkspaceRoot()));
  return parsed.success ? parsed.data : [];
});

ipcMain.handle('workspace:searchFiles', async (_event, input) => {
  const query = typeof input === 'object' && input !== null && 'query' in input ? String((input as { query?: unknown }).query ?? '') : '';
  const parsed = WorkspaceFileSearchEntrySchema.array().safeParse(searchWorkspaceFiles(currentWorkspaceRoot(), query));
  return parsed.success ? parsed.data : [];
});

ipcMain.handle('workspace:listTree', async () => {
  const parsed = WorkspaceTreeNodeSchema.array().safeParse(buildWorkspaceTreeEntries(currentWorkspaceRoot()));
  return parsed.success ? parsed.data : [];
});

ipcMain.handle('workspace:readFile', async (_event, input) => {
  const parsed = WorkspaceReadFileInputSchema.safeParse(input);
  if (!parsed.success) {
    return null;
  }

  const result = readWorkspaceTextFile(currentWorkspaceRoot(), parsed.data.path);
  return result ? WorkspaceReadFileResultSchema.parse(result) : null;
});

ipcMain.handle('terminal:run', async (_event, input) => {
  const parsed = TerminalRunInputSchema.safeParse(input);
  if (!parsed.success) {
    return null;
  }

  const tool = new ExecTool(currentWorkspaceRoot());
  return tool.run({ command: parsed.data.command, timeoutMs: parsed.data.timeoutMs }, { acId: 'terminal', claimId: 'terminal' });
});

ipcMain.handle('agents:list', async () => listSubAgents(currentWorkspaceRoot()));

ipcMain.handle('agents:upsert', async (_event, input) => {
  const parsed = SubAgentUpsertInputSchema.parse(input);
  return upsertSubAgent(currentWorkspaceRoot(), parsed);
});

ipcMain.handle('agents:remove', async (_event, input) => {
  const parsed = SubAgentRemoveInputSchema.parse(input);
  return removeSubAgent(currentWorkspaceRoot(), parsed);
});

ipcMain.handle('agents:dispatches', async () => listSubAgentDispatches(currentWorkspaceRoot()));

ipcMain.handle('agents:dispatch', async (_event, input) => {
  const parsed = SubAgentDispatchInputSchema.parse(input);
  const workspaceRoot = currentWorkspaceRoot();
  const agentPath = resolveAgentPath(workspaceRoot, parsed.sourcePath);
  const agent = listSubAgents(workspaceRoot).find((item) => item.sourcePath === agentPath || resolveAgentPath(workspaceRoot, item.sourcePath) === agentPath);
  if (!agent) {
    throw new Error('Subagent not found');
  }

  const initial = createSubAgentDispatchRecord(workspaceRoot, agent, parsed.task);
  updateSubAgentDispatchRecord(workspaceRoot, initial.id, {
    status: 'running',
    mergeState: 'pending'
  });

  try {
    const result = await dispatchSubAgent(agent, parsed.task, {
      repoRoot: workspaceRoot,
      proposalRoot: join(workspaceRoot, BOBBY_DIR, 'proposals'),
      runInWorktree: async (agentDescriptor, task, worktreePath) =>
        runSubAgentTaskInWorktree(agentDescriptor as SubAgentRecordDto, task, worktreePath)
    });

    return updateSubAgentDispatchRecord(workspaceRoot, initial.id, {
      status: 'completed',
      mergeState: 'ready',
      worktreePath: result.worktreePath,
      proposalId: result.proposalId,
      proposalPath: result.proposalPath,
      error: null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return updateSubAgentDispatchRecord(workspaceRoot, initial.id, {
      status: 'failed',
      mergeState: 'blocked',
      error: message
    });
  }
});

ipcMain.handle('mcp:list', async () => listMcpServers(app.getPath('userData'), currentWorkspaceRoot()));

ipcMain.handle('mcp:upsert', async (_event, input) => {
  const parsed = McpServerUpsertInputSchema.parse(input);
  const next = upsertMcpServer(app.getPath('userData'), currentWorkspaceRoot(), parsed);
  refreshToolRegistry();
  return next;
});

ipcMain.handle('mcp:toggle', async (_event, input) => {
  const parsed = McpServerToggleInputSchema.parse(input);
  const next = toggleMcpServer(app.getPath('userData'), parsed);
  refreshToolRegistry();
  return next;
});

ipcMain.handle('mcp:remove', async (_event, input) => {
  const parsed = McpServerRemoveInputSchema.parse(input);
  const removed = removeMcpServer(app.getPath('userData'), parsed);
  refreshToolRegistry();
  return removed;
});

ipcMain.handle('automations:list', async () => readAutomations());

ipcMain.handle('automations:create', async (_event, input) => {
  const automation = createAutomation(input);
  return upsertAutomation(automation);
});

ipcMain.handle('automations:update', async (_event, input) => {
  const parsed = AutomationUpdateInputSchema.parse(input);
  const existing = getAutomationById(parsed.id);
  if (!existing) {
    throw new Error('Automation not found');
  }

  const next: AutomationRecord = AutomationRecordSchema.parse({
    ...existing,
    ...parsed,
    updatedAt: nowIso(),
    nextRunAt:
      parsed.intervalMinutes !== undefined
        ? addMinutes(existing.lastRunAt ?? existing.createdAt, parsed.intervalMinutes)
        : existing.nextRunAt
  });

  return upsertAutomation(next);
});

ipcMain.handle('automations:toggle', async (_event, input) => {
  const parsed = AutomationToggleInputSchema.parse(input);
  const existing = getAutomationById(parsed.id);
  if (!existing) {
    throw new Error('Automation not found');
  }

  const next = AutomationRecordSchema.parse({
    ...existing,
    enabled: !existing.enabled,
    updatedAt: nowIso()
  });

  return upsertAutomation(next);
});

ipcMain.handle('automations:remove', async (_event, input) => {
  const parsed = AutomationRemoveInputSchema.parse(input);
  const records = readAutomations();
  const next = records.filter((item) => item.id !== parsed.id);
  writeAutomations(next);
  return next.length !== records.length;
});

ipcMain.handle('automations:runNow', async (_event, input) => {
  const parsed = AutomationToggleInputSchema.parse(input);
  const existing = getAutomationById(parsed.id);
  if (!existing) {
    return null;
  }

  return runAutomation(existing);
});

ipcMain.handle('kernel:command', async (_event, cmd) => {
  const currentHost = await (pendingHost ?? (pendingHost = createHost()));
  if (!currentHost) {
    throw hostInitError ?? new Error('Kernel 主机未就绪，请先完成配置');
  }
  await currentHost.send(cmd);
});

app.whenReady().then(() => {
  createWindow();
  setupDesktopIntegration();
  startAutomationTimer();
  void bootstrap();
  void initAutoUpdate(notifySystem);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopAutomationTimer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
