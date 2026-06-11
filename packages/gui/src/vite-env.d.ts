/// <reference types="vite/client" />

import type { KernelCommand, KernelEvent } from '@bobby/shared';
import type {
  AppSettings,
  AppSettingsUpdate,
  AutomationCreateInput,
  AutomationRemoveInput,
  AutomationRecord,
  AutomationToggleInput,
  AutomationUpdateInput,
  OnboardingStatus,
  ProjectList,
  ProjectMeta,
  ProjectSelectResult,
  ProposalApplyInput,
  ProposalDiscardInput,
  ProposalSummary,
  SnapshotListEntry,
  SessionRecordDto,
  TaskDetail,
  TaskSummary
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
      setSettings?: (settings: AppSettingsUpdate) => Promise<AppSettings>;
      listSessions?: () => Promise<SessionRecordDto[]>;
      readSession?: (sessionId: string) => Promise<SessionRecordDto | null>;
      saveSession?: (session: SessionRecordDto) => Promise<SessionRecordDto>;
      listTasks?: () => Promise<TaskSummary[]>;
      readTask?: (taskId: string) => Promise<TaskDetail | null>;
      listProposals?: () => Promise<ProposalSummary[]>;
      readProposal?: (proposalId: string) => Promise<ProposalSummary | null>;
      applyProposal?: (input: ProposalApplyInput) => Promise<ProposalSummary | null>;
      discardProposal?: (input: ProposalDiscardInput) => Promise<boolean>;
      listSnapshots?: () => Promise<SnapshotListEntry[]>;
      listAutomations: () => Promise<AutomationRecord[]>;
      createAutomation: (input: AutomationCreateInput) => Promise<AutomationRecord>;
      updateAutomation: (input: AutomationUpdateInput) => Promise<AutomationRecord>;
      toggleAutomation: (input: AutomationToggleInput) => Promise<AutomationRecord>;
      removeAutomation: (input: AutomationRemoveInput) => Promise<boolean>;
      runAutomationNow: (input: AutomationToggleInput) => Promise<AutomationRecord | null>;
    } & Record<string, any>;
  }
}

export {};
