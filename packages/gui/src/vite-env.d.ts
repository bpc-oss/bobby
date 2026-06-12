/// <reference types="vite/client" />

import type { KernelCommand, KernelEvent } from '@bobby/shared';
import type {
  AppSettings,
  AppSettingsUpdate,
  CapabilityReport,
  AutomationCreateInput,
  AutomationRemoveInput,
  AutomationRecord,
  AutomationToggleInput,
  AutomationUpdateInput,
  McpServerRecordDto,
  McpServerRemoveInput,
  McpServerToggleInput,
  McpServerUpsertInput,
  OnboardingStatus,
  ProjectList,
  ProjectMeta,
  ProjectSelectResult,
  ProposalApplyInput,
  ProposalDiscardInput,
  GitCommitInput,
  GitCommitResult,
  PreviewStartInput,
  PreviewStartResult,
  ProposalSummary,
  SnapshotListEntry,
  TerminalRunInput,
  TerminalRunResult,
  WorkspaceReadFileResult,
  WorkspaceTreeNode,
  SubAgentDispatchInput,
  SubAgentDispatchRecordDto,
  SubAgentRecordDto,
  SubAgentRemoveInput,
  SubAgentUpsertInput,
  WorkspaceFileSearchEntry,
  SessionRecordDto,
  TaskDetail,
  TaskSummary,
  CommandRecordDto,
  CommandRemoveInput,
  CommandUpsertInput
} from './ipc/contract';

declare global {
  interface Window {
    bobby: {
      send: (cmd: KernelCommand) => Promise<unknown>;
      onEvent: (callback: (event: KernelEvent) => void) => () => void;
      onAppCommand?: (callback: (command: { type: string }) => void) => () => void;
      getSetupStatus: () => Promise<OnboardingStatus>;
      openQuickstart: () => Promise<unknown>;
      openProject?: () => Promise<ProjectSelectResult | null>;
      listProjects?: () => Promise<ProjectList>;
      selectProject?: (projectDir: string) => Promise<ProjectSelectResult>;
      getCurrentProject?: () => Promise<ProjectMeta | null>;
      getSettings?: () => Promise<AppSettings>;
      getCapabilityReport?: () => Promise<CapabilityReport | null>;
      setSettings?: (settings: AppSettingsUpdate) => Promise<AppSettings>;
      listSessions?: () => Promise<SessionRecordDto[]>;
      readSession?: (sessionId: string) => Promise<SessionRecordDto | null>;
      saveSession?: (session: SessionRecordDto) => Promise<SessionRecordDto>;
      listTasks?: () => Promise<TaskSummary[]>;
      readTask?: (taskId: string) => Promise<TaskDetail | null>;
      listCommands?: () => Promise<CommandRecordDto[]>;
      upsertCommand?: (input: CommandUpsertInput) => Promise<CommandRecordDto>;
      removeCommand?: (input: CommandRemoveInput) => Promise<boolean>;
      listProposals?: () => Promise<ProposalSummary[]>;
      readProposal?: (proposalId: string) => Promise<ProposalSummary | null>;
      applyProposal?: (input: ProposalApplyInput) => Promise<ProposalSummary | null>;
      discardProposal?: (input: ProposalDiscardInput) => Promise<boolean>;
      gitIsRepo?: () => Promise<boolean>;
      gitCommit?: (input: GitCommitInput) => Promise<GitCommitResult>;
      listSnapshots?: () => Promise<SnapshotListEntry[]>;
      searchFiles?: (query: string) => Promise<WorkspaceFileSearchEntry[]>;
      listWorkspaceTree?: () => Promise<WorkspaceTreeNode[]>;
      readWorkspaceFile?: (path: string) => Promise<WorkspaceReadFileResult | null>;
      runTerminalCommand?: (input: TerminalRunInput) => Promise<TerminalRunResult>;
      startPreviewServer?: (input: PreviewStartInput) => Promise<PreviewStartResult>;
      listMcpServers?: () => Promise<McpServerRecordDto[]>;
      upsertMcpServer?: (input: McpServerUpsertInput) => Promise<McpServerRecordDto>;
      toggleMcpServer?: (input: McpServerToggleInput) => Promise<McpServerRecordDto>;
      removeMcpServer?: (input: McpServerRemoveInput) => Promise<boolean>;
      listSubAgents?: () => Promise<SubAgentRecordDto[]>;
      upsertSubAgent?: (input: SubAgentUpsertInput) => Promise<SubAgentRecordDto>;
      removeSubAgent?: (input: SubAgentRemoveInput) => Promise<boolean>;
      dispatchSubAgent?: (input: SubAgentDispatchInput) => Promise<SubAgentDispatchRecordDto | null>;
      listSubAgentDispatches?: () => Promise<SubAgentDispatchRecordDto[]>;
      listAutomations: () => Promise<AutomationRecord[]>;
      createAutomation: (input: AutomationCreateInput) => Promise<AutomationRecord>;
      updateAutomation: (input: AutomationUpdateInput) => Promise<AutomationRecord>;
      toggleAutomation: (input: AutomationToggleInput) => Promise<AutomationRecord>;
      removeAutomation: (input: AutomationRemoveInput) => Promise<boolean>;
      runAutomationNow: (input: AutomationToggleInput) => Promise<AutomationRecord | null>;
    } & Record<string, unknown>;
  }
}

export {};
