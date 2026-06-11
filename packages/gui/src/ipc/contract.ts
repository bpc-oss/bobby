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

export const SnapshotListEntrySchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  copied: z.array(z.object({ path: z.string(), bytes: z.number().nonnegative() })),
  skipped: z.array(z.object({ path: z.string(), reason: z.enum(['binary-or-non-text', 'excluded']) })),
  snapshotDir: z.string().min(1)
});
export type SnapshotListEntry = z.infer<typeof SnapshotListEntrySchema>;

export const WorkspaceFileSearchEntrySchema = z.object({
  path: z.string().min(1),
  preview: z.string().nullable().optional()
});
export type WorkspaceFileSearchEntry = z.infer<typeof WorkspaceFileSearchEntrySchema>;

export function makeKernelClient() {
  return {
    startTask: (input: string) => window.bobby.send({ type: 'startTask', input }),
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
    setSettings: (settings: AppSettingsUpdate) => window.bobby.setSettings!(settings),
    listSessions: () => window.bobby.listSessions!(),
    readSession: (sessionId: string) => window.bobby.readSession!(sessionId),
    saveSession: (session: SessionRecordDto) => window.bobby.saveSession!(session),
    listTasks: () => window.bobby.listTasks!(),
    readTask: (taskId: string) => window.bobby.readTask!(taskId),
    listProposals: () => window.bobby.listProposals!(),
    readProposal: (proposalId: string) => window.bobby.readProposal!(proposalId),
    listSnapshots: () => window.bobby.listSnapshots!(),
    searchFiles: (query: string) => window.bobby.searchFiles!(query),
    restoreSnapshot: (snapshotId?: string) => window.bobby.send({ type: 'restoreSnapshot', snapshotId }),
    applyProposal: (input: ProposalApplyInput) => window.bobby.applyProposal!(input),
    discardProposal: (input: ProposalDiscardInput) => window.bobby.discardProposal!(input),
    listAutomations: () => window.bobby.listAutomations(),
    createAutomation: (input: AutomationCreateInput) => window.bobby.createAutomation(input),
    updateAutomation: (input: AutomationUpdateInput) => window.bobby.updateAutomation(input),
    toggleAutomation: (input: AutomationToggleInput) => window.bobby.toggleAutomation(input),
    removeAutomation: (input: AutomationRemoveInput) => window.bobby.removeAutomation(input),
    runAutomationNow: (input: AutomationToggleInput) => window.bobby.runAutomationNow(input)
  };
}
