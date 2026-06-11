import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';

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
  WorkspaceFileSearchEntry,
  SessionRecordDto,
  TaskDetail,
  TaskSummary
} from '../src/ipc/contract';

contextBridge.exposeInMainWorld('bobby', {
  send: (cmd: KernelCommand) => ipcRenderer.invoke('kernel:command', cmd),
  onEvent: (callback: (event: KernelEvent) => void) => {
    const listener = (_: IpcRendererEvent, event: KernelEvent) => {
      callback(event);
    };

    ipcRenderer.on('kernel:event', listener);

    return () => {
      ipcRenderer.removeListener('kernel:event', listener);
    };
  },
  onAppCommand: (callback: (command: { type: string }) => void) => {
    const listener = (_: IpcRendererEvent, command: { type: string }) => {
      callback(command);
    };
    ipcRenderer.on('app:command', listener);
    return () => {
      ipcRenderer.removeListener('app:command', listener);
    };
  },
  getSetupStatus: () => ipcRenderer.invoke('setup:status') as Promise<OnboardingStatus>,
  openQuickstart: () => ipcRenderer.invoke('setup:openQuickstart'),
  openProject: () => ipcRenderer.invoke('project:open') as Promise<ProjectSelectResult | null>,
  listProjects: () => ipcRenderer.invoke('project:list') as Promise<ProjectList>,
  selectProject: (projectDir: string) => ipcRenderer.invoke('project:select', { projectDir }) as Promise<ProjectSelectResult>,
  getCurrentProject: () => ipcRenderer.invoke('project:getCurrent') as Promise<ProjectMeta | null>,
  getSettings: () => ipcRenderer.invoke('settings:get') as Promise<AppSettings>,
  setSettings: (settings: AppSettingsUpdate) => ipcRenderer.invoke('settings:set', settings) as Promise<AppSettings>,
  listSessions: () => ipcRenderer.invoke('sessions:list') as Promise<SessionRecordDto[]>,
  readSession: (sessionId: string) => ipcRenderer.invoke('sessions:read', { sessionId }) as Promise<SessionRecordDto | null>,
  saveSession: (session: SessionRecordDto) => ipcRenderer.invoke('sessions:save', session) as Promise<SessionRecordDto>,
  listTasks: () => ipcRenderer.invoke('tasks:list') as Promise<TaskSummary[]>,
  readTask: (taskId: string) => ipcRenderer.invoke('tasks:read', { taskId }) as Promise<TaskDetail | null>,
  listProposals: () => ipcRenderer.invoke('proposals:list') as Promise<ProposalSummary[]>,
  readProposal: (proposalId: string) => ipcRenderer.invoke('proposals:read', { proposalId }) as Promise<ProposalSummary | null>,
  listSnapshots: () => ipcRenderer.invoke('snapshots:list') as Promise<SnapshotListEntry[]>,
  searchFiles: (query: string) => ipcRenderer.invoke('workspace:searchFiles', { query }) as Promise<WorkspaceFileSearchEntry[]>,
  applyProposal: (input: ProposalApplyInput) => ipcRenderer.invoke('proposals:apply', input) as Promise<ProposalSummary | null>,
  discardProposal: (input: ProposalDiscardInput) => ipcRenderer.invoke('proposals:discard', input) as Promise<boolean>,
  listAutomations: () => ipcRenderer.invoke('automations:list') as Promise<AutomationRecord[]>,
  createAutomation: (input: AutomationCreateInput) => ipcRenderer.invoke('automations:create', input) as Promise<AutomationRecord>,
  updateAutomation: (input: AutomationUpdateInput) => ipcRenderer.invoke('automations:update', input) as Promise<AutomationRecord>,
  toggleAutomation: (input: AutomationToggleInput) => ipcRenderer.invoke('automations:toggle', input) as Promise<AutomationRecord>,
  removeAutomation: (input: AutomationRemoveInput) => ipcRenderer.invoke('automations:remove', input) as Promise<boolean>,
  runAutomationNow: (input: AutomationToggleInput) => ipcRenderer.invoke('automations:runNow', input) as Promise<AutomationRecord | null>
});
