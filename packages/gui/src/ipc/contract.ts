import { z } from 'zod';
import type { GateDecision, KernelEvent } from '@bobby/shared';

export const ProjectMetaSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  lastOpenedAt: z.string().min(1)
});
export type ProjectMeta = z.infer<typeof ProjectMetaSchema>;
export const ProjectListSchema = z.array(ProjectMetaSchema);
export type ProjectList = z.infer<typeof ProjectListSchema>;

export const ProjectSelectResultSchema = z.object({
  project: ProjectMetaSchema,
  recentProjects: ProjectListSchema
});
export type ProjectSelectResult = z.infer<typeof ProjectSelectResultSchema>;

export const OnboardingStatusSchema = z.object({
  homeDir: z.string().min(1),
  bobbyDir: z.string().min(1),
  keyPath: z.string().min(1),
  capabilitiesPath: z.string().min(1),
  hasKey: z.boolean(),
  hasCapabilities: z.boolean(),
  hasEnvKey: z.boolean()
});
export type OnboardingStatus = z.infer<typeof OnboardingStatusSchema>;

export const AutomationKindSchema = z.enum(['reminder', 'monitor', 'follow-up', 'wake', 'schedule']);
export type AutomationKind = z.infer<typeof AutomationKindSchema>;

export const AutomationRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: AutomationKindSchema,
  prompt: z.string().min(1),
  intervalMinutes: z.number().int().positive(),
  enabled: z.boolean(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  lastRunAt: z.string().nullable(),
  nextRunAt: z.string().min(1)
});
export type AutomationRecord = z.infer<typeof AutomationRecordSchema>;

export const AutomationCreateInputSchema = z.object({
  title: z.string().min(1),
  kind: AutomationKindSchema,
  prompt: z.string().min(1),
  intervalMinutes: z.number().int().positive()
});
export type AutomationCreateInput = z.infer<typeof AutomationCreateInputSchema>;

export const AutomationUpdateInputSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  kind: AutomationKindSchema.optional(),
  prompt: z.string().min(1).optional(),
  intervalMinutes: z.number().int().positive().optional(),
  enabled: z.boolean().optional()
});
export type AutomationUpdateInput = z.infer<typeof AutomationUpdateInputSchema>;

export const AutomationToggleInputSchema = z.object({
  id: z.string().min(1)
});
export type AutomationToggleInput = z.infer<typeof AutomationToggleInputSchema>;

export const AutomationRemoveInputSchema = z.object({
  id: z.string().min(1)
});
export type AutomationRemoveInput = z.infer<typeof AutomationRemoveInputSchema>;

export const AppSettingsSchema = z.object({
  modelStrategy: z.enum(['auto', 'flash', 'pro', 'conservative']),
  baseUrl: z.string().min(1),
  workspaceDir: z.string().min(1),
  budgetUsd: z.number().nonnegative(),
  defaultPermission: z.enum(['L0', 'L1', 'L2', 'L3', 'L4']),
  strongSandbox: z.boolean(),
  hasApiKey: z.boolean()
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;

export const AppSettingsUpdateSchema = AppSettingsSchema.omit({ hasApiKey: true }).partial().extend({
  apiKey: z.string().min(1).optional()
});
export type AppSettingsUpdate = z.infer<typeof AppSettingsUpdateSchema>;

export const CapabilityReportSchema = z.object({
  runnerModel: z.string().min(1),
  graderModel: z.string().min(1),
  useToolCalling: z.boolean(),
  useJsonMode: z.boolean(),
  useFim: z.boolean(),
  useCaching: z.boolean(),
  useReasoning: z.boolean(),
  useVision: z.boolean(),
  useStreaming: z.boolean(),
  contextWindow: z.number().int().positive()
});
export type CapabilityReport = z.infer<typeof CapabilityReportSchema>;

export const PlanStepRecordSchema = z.object({
  id: z.string(),
  desc: z.string(),
  satisfiesAcIds: z.array(z.string()),
  dependsOn: z.array(z.string())
});
export type PlanStepRecord = z.infer<typeof PlanStepRecordSchema>;

export const SessionRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  blocks: z.array(z.unknown()),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  projectDir: z.string().nullable(),
  taskId: z.string().nullable(),
  mode: z.enum(['plan-only', 'standard', 'enhanced', 'full']).optional(),
  status: z.enum(['idle', 'running', 'done', 'failed', 'blocked']),
  liveReasoning: z.string(),
  liveAssistant: z.string(),
  liveToolContent: z.string(),
  currentPlan: z.array(PlanStepRecordSchema),
  error: z.string().nullable(),
  costUsd: z.number(),
  spendUsd: z.number(),
  model: z.string().nullable()
});
export type SessionRecordDto = z.infer<typeof SessionRecordSchema>;

export const TaskSummarySchema = z.object({
  taskId: z.string().min(1),
  userGoal: z.string().min(1),
  state: z.string().min(1),
  taskType: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  traceCount: z.number().int().nonnegative(),
  hasContract: z.boolean(),
  hasPlan: z.boolean(),
  hasReport: z.boolean()
});
export type TaskSummary = z.infer<typeof TaskSummarySchema>;

export const TaskDetailSchema = z.object({
  summary: TaskSummarySchema,
  contract: z.unknown().nullable(),
  plan: z.array(PlanStepRecordSchema).nullable(),
  report: z.string().nullable(),
  trace: z.array(z.unknown()),
  sessionIds: z.array(z.string())
});
export type TaskDetail = z.infer<typeof TaskDetailSchema>;

export const CommandRecordSchema = z.object({
  sourcePath: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  promptTemplate: z.string().min(1)
});
export type CommandRecordDto = z.infer<typeof CommandRecordSchema>;

export const CommandUpsertInputSchema = CommandRecordSchema.omit({ sourcePath: true }).extend({
  sourcePath: z.string().min(1).optional()
});
export type CommandUpsertInput = z.infer<typeof CommandUpsertInputSchema>;

export const CommandRemoveInputSchema = z.object({
  sourcePath: z.string().min(1)
});
export type CommandRemoveInput = z.infer<typeof CommandRemoveInputSchema>;

export const ProposalSummarySchema = z.object({
  proposalId: z.string().min(1),
  proposalPath: z.string().min(1),
  createdAt: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  lineCount: z.number().int().nonnegative(),
  patch: z.string()
});
export type ProposalSummary = z.infer<typeof ProposalSummarySchema>;

export const ProposalApplyInputSchema = z.object({
  proposalId: z.string().min(1),
  gatePassed: z.boolean(),
  proReviewPassed: z.boolean(),
  humanConfirmed: z.boolean()
});
export type ProposalApplyInput = z.infer<typeof ProposalApplyInputSchema>;

export const ProposalDiscardInputSchema = z.object({
  proposalId: z.string().min(1)
});
export type ProposalDiscardInput = z.infer<typeof ProposalDiscardInputSchema>;

export const GitCommitInputSchema = z.object({
  message: z.string().min(1)
});
export type GitCommitInput = z.infer<typeof GitCommitInputSchema>;

export const GitCommitResultSchema = z.object({
  committed: z.boolean(),
  hash: z.string().nullable(),
  output: z.string()
});
export type GitCommitResult = z.infer<typeof GitCommitResultSchema>;

export const SnapshotListEntrySchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  copied: z.array(z.object({ path: z.string(), bytes: z.number().nonnegative() })),
  skipped: z.array(z.object({ path: z.string(), reason: z.enum(['binary-or-non-text', 'excluded']) })),
  snapshotDir: z.string().min(1),
  taskId: z.string().min(1).optional(),
  stepId: z.string().min(1).optional()
});
export type SnapshotListEntry = z.infer<typeof SnapshotListEntrySchema>;

export const SessionModeSchema = z.enum(['plan-only', 'standard', 'enhanced', 'full']);
export type SessionMode = z.infer<typeof SessionModeSchema>;

export const WorkspaceFileSearchEntrySchema = z.object({
  path: z.string().min(1),
  preview: z.string().nullable().optional()
});
export type WorkspaceFileSearchEntry = z.infer<typeof WorkspaceFileSearchEntrySchema>;

export type WorkspaceTreeNode = {
  name: string;
  path: string;
  kind: 'file' | 'directory';
  size?: number;
  children?: WorkspaceTreeNode[];
};

export const WorkspaceTreeNodeSchema: z.ZodType<WorkspaceTreeNode> = z.lazy(() => z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  kind: z.enum(['file', 'directory']),
  size: z.number().nonnegative().optional(),
  children: z.array(WorkspaceTreeNodeSchema).optional()
}));

export const WorkspaceReadFileInputSchema = z.object({
  path: z.string().min(1)
});
export type WorkspaceReadFileInput = z.infer<typeof WorkspaceReadFileInputSchema>;

export const WorkspaceReadFileResultSchema = z.object({
  path: z.string().min(1),
  content: z.string()
});
export type WorkspaceReadFileResult = z.infer<typeof WorkspaceReadFileResultSchema>;

export const TerminalRunInputSchema = z.object({
  command: z.string().min(1),
  timeoutMs: z.number().int().positive().optional()
});
export type TerminalRunInput = z.infer<typeof TerminalRunInputSchema>;

export const TerminalRunResultSchema = z.object({
  evidence: z.array(z.unknown()),
  result: z.object({
    exitCode: z.number().int()
  })
});
export type TerminalRunResult = z.infer<typeof TerminalRunResultSchema>;

export const McpToolSchema = z.object({
  name: z.string().min(1),
  permissionTier: z.enum(['L0', 'L1', 'L2', 'L3', 'L4']),
  description: z.string().min(1).optional(),
  evidenceType: z.enum(['command_output', 'file_diff', 'file_exists']).optional()
});
export type McpTool = z.infer<typeof McpToolSchema>;

export const McpStdioTransportSchema = z.object({
  kind: z.literal('stdio'),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  cwd: z.string().min(1).optional(),
  env: z.record(z.string()).optional()
});
export const McpUrlTransportSchema = z.object({
  kind: z.literal('url'),
  url: z.string().url(),
  headers: z.record(z.string()).optional()
});
export const McpTransportSchema = z.discriminatedUnion('kind', [McpStdioTransportSchema, McpUrlTransportSchema]);
export type McpTransport = z.infer<typeof McpTransportSchema>;

export const McpServerRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean(),
  transport: McpTransportSchema,
  tools: z.array(McpToolSchema),
  health: z.enum(['unknown', 'healthy', 'error', 'disabled']),
  lastCheckedAt: z.string().nullable().optional(),
  lastError: z.string().nullable().optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});
export type McpServerRecordDto = z.infer<typeof McpServerRecordSchema>;

export const McpServerUpsertInputSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  enabled: z.boolean().optional(),
  transport: McpTransportSchema,
  tools: z.array(McpToolSchema)
});
export type McpServerUpsertInput = z.infer<typeof McpServerUpsertInputSchema>;

export const McpServerToggleInputSchema = z.object({
  id: z.string().min(1)
});
export type McpServerToggleInput = z.infer<typeof McpServerToggleInputSchema>;

export const McpServerRemoveInputSchema = z.object({
  id: z.string().min(1)
});
export type McpServerRemoveInput = z.infer<typeof McpServerRemoveInputSchema>;

export const SubAgentRecordSchema = z.object({
  sourcePath: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  model: z.string().min(1).optional(),
  tools: z.array(z.string()),
  triggers: z.array(z.string()),
  systemPrompt: z.string().min(1)
});
export type SubAgentRecordDto = z.infer<typeof SubAgentRecordSchema>;

export const SubAgentUpsertInputSchema = SubAgentRecordSchema.omit({ sourcePath: true }).extend({
  sourcePath: z.string().min(1).optional()
});
export type SubAgentUpsertInput = z.infer<typeof SubAgentUpsertInputSchema>;

export const SubAgentRemoveInputSchema = z.object({
  sourcePath: z.string().min(1)
});
export type SubAgentRemoveInput = z.infer<typeof SubAgentRemoveInputSchema>;

export const SubAgentDispatchInputSchema = z.object({
  sourcePath: z.string().min(1),
  task: z.string().min(1)
});
export type SubAgentDispatchInput = z.infer<typeof SubAgentDispatchInputSchema>;

export const SubAgentDispatchRecordSchema = z.object({
  id: z.string().min(1),
  agentSourcePath: z.string().min(1),
  agentName: z.string().min(1),
  task: z.string().min(1),
  status: z.enum(['queued', 'running', 'completed', 'failed']),
  mergeState: z.enum(['pending', 'ready', 'applied', 'blocked']),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  worktreePath: z.string().nullable(),
  proposalId: z.string().nullable(),
  proposalPath: z.string().nullable(),
  error: z.string().nullable()
});
export type SubAgentDispatchRecordDto = z.infer<typeof SubAgentDispatchRecordSchema>;

export function makeKernelClient() {
  return {
    startTask: (input: string, mode?: SessionMode) => window.bobby.send({ type: 'startTask', input, mode }),
    approveGate: (gateId: string, decision: GateDecision) =>
      window.bobby.send({ type: 'approveGate', gateId, decision }),
    onEvent: (cb: (event: KernelEvent) => void) => window.bobby.onEvent(cb),
    getSetupStatus: () => window.bobby.getSetupStatus(),
    openQuickstart: () => window.bobby.openQuickstart(),
    openProject: () => window.bobby.openProject!(),
    listProjects: () => window.bobby.listProjects!(),
    selectProject: (projectDir: string) => window.bobby.selectProject!(projectDir),
    getCurrentProject: () => window.bobby.getCurrentProject!(),
    getSettings: () => window.bobby.getSettings!(),
    getCapabilityReport: () => window.bobby.getCapabilityReport?.() ?? Promise.resolve(null),
    setSettings: (settings: AppSettingsUpdate) => window.bobby.setSettings!(settings),
    listSessions: () => window.bobby.listSessions!(),
    readSession: (sessionId: string) => window.bobby.readSession!(sessionId),
    saveSession: (session: SessionRecordDto) => window.bobby.saveSession!(session),
    listTasks: () => window.bobby.listTasks!(),
    readTask: (taskId: string) => window.bobby.readTask!(taskId),
    listProposals: () => window.bobby.listProposals!(),
    readProposal: (proposalId: string) => window.bobby.readProposal!(proposalId),
    listCommands: () => window.bobby.listCommands?.() ?? Promise.resolve([]),
    upsertCommand: (input: CommandUpsertInput) => window.bobby.upsertCommand!(input),
    removeCommand: (input: CommandRemoveInput) => window.bobby.removeCommand!(input),
    listSnapshots: () => window.bobby.listSnapshots!(),
    searchFiles: (query: string) => window.bobby.searchFiles!(query),
    listWorkspaceTree: () => window.bobby.listWorkspaceTree!(),
    readWorkspaceFile: (path: string) => window.bobby.readWorkspaceFile!(path),
    runTerminalCommand: (input: TerminalRunInput) => window.bobby.runTerminalCommand!(input) as Promise<TerminalRunResult>,
    restoreSnapshot: (snapshotId?: string) => window.bobby.send({ type: 'restoreSnapshot', snapshotId }),
    applyProposal: (input: ProposalApplyInput) => window.bobby.applyProposal!(input),
    discardProposal: (input: ProposalDiscardInput) => window.bobby.discardProposal!(input),
    gitIsRepo: () => window.bobby.gitIsRepo?.() ?? Promise.resolve(false),
    gitCommit: (input: GitCommitInput) => window.bobby.gitCommit!(input),
    listMcpServers: () => window.bobby.listMcpServers!(),
    upsertMcpServer: (input: McpServerUpsertInput) => window.bobby.upsertMcpServer!(input),
    toggleMcpServer: (input: McpServerToggleInput) => window.bobby.toggleMcpServer!(input),
    removeMcpServer: (input: McpServerRemoveInput) => window.bobby.removeMcpServer!(input),
    listSubAgents: () => window.bobby.listSubAgents!(),
    upsertSubAgent: (input: SubAgentUpsertInput) => window.bobby.upsertSubAgent!(input),
    removeSubAgent: (input: SubAgentRemoveInput) => window.bobby.removeSubAgent!(input),
    dispatchSubAgent: (input: SubAgentDispatchInput) => window.bobby.dispatchSubAgent!(input),
    listSubAgentDispatches: () => window.bobby.listSubAgentDispatches!(),
    listAutomations: () => window.bobby.listAutomations(),
    createAutomation: (input: AutomationCreateInput) => window.bobby.createAutomation(input),
    updateAutomation: (input: AutomationUpdateInput) => window.bobby.updateAutomation(input),
    toggleAutomation: (input: AutomationToggleInput) => window.bobby.toggleAutomation(input),
    removeAutomation: (input: AutomationRemoveInput) => window.bobby.removeAutomation(input),
    runAutomationNow: (input: AutomationToggleInput) => window.bobby.runAutomationNow(input)
  };
}
