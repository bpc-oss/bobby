import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

import { App } from '../src/main';
import { useChatStore } from '../src/store/chat-store';

function resetStore() {
  useChatStore.setState({
    blocks: [],
    liveReasoning: '',
    liveAssistant: '',
    liveToolContent: '',
    busy: false,
    currentTaskId: null,
    currentPlan: [],
    status: 'idle',
    error: null,
    costUsd: 0,
    spendUsd: 0,
    model: null,
    sessionMode: 'standard',
    threads: {},
    taskThreadIds: {},
    pendingThreadIds: [],
    sessions: [],
    activeSessionId: null,
    currentProject: {
      name: 'Bobby',
      path: 'E:\\ai-files\\Bobby',
      lastOpenedAt: '2026-06-12T00:00:00.000Z'
    },
    recentProjects: [],
    previewTarget: null,
    composerInsertion: null,
    _client: null
  });
}

function installBobby(listSessions: unknown[]) {
  (window as Window & { bobby?: unknown }).bobby = {
    send: vi.fn().mockResolvedValue(undefined),
    onEvent: vi.fn().mockReturnValue(() => undefined),
    getSetupStatus: vi.fn().mockResolvedValue({
      homeDir: 'C:\\Users\\Administrator',
      bobbyDir: 'C:\\Users\\Administrator\\.bobby',
      keyPath: 'C:\\Users\\Administrator\\.bobby\\key',
      capabilitiesPath: 'C:\\Users\\Administrator\\.bobby\\capabilities.json',
      hasKey: true,
      hasCapabilities: true,
      hasEnvKey: false
    }),
    getCurrentProject: vi.fn().mockResolvedValue({
      name: 'Bobby',
      path: 'E:\\ai-files\\Bobby',
      lastOpenedAt: '2026-06-12T00:00:00.000Z'
    }),
    listProjects: vi.fn().mockResolvedValue([
      { name: 'Bobby', path: 'E:\\ai-files\\Bobby', lastOpenedAt: '2026-06-12T00:00:00.000Z' }
    ]),
    listSessions: vi.fn().mockResolvedValue(listSessions),
    openQuickstart: vi.fn().mockResolvedValue(undefined),
    listAutomations: vi.fn().mockResolvedValue([]),
    createAutomation: vi.fn().mockResolvedValue(undefined),
    updateAutomation: vi.fn().mockResolvedValue(undefined),
    toggleAutomation: vi.fn().mockResolvedValue(undefined),
    removeAutomation: vi.fn().mockResolvedValue(true),
    runAutomationNow: vi.fn().mockResolvedValue(undefined),
    listTasks: vi.fn().mockResolvedValue([]),
    searchFiles: vi.fn().mockResolvedValue([]),
    saveAttachment: vi.fn().mockResolvedValue({ path: '.bobby/uploads/saved.png' }),
    listCommands: vi.fn().mockResolvedValue([]),
    listMcpServers: vi.fn().mockResolvedValue([]),
    listSubAgents: vi.fn().mockResolvedValue([]),
    getGitStatusSummary: vi.fn().mockResolvedValue({
      isRepo: true,
      branch: 'codex/bobby-cli-parity',
      ahead: 0,
      behind: 0,
      added: 0,
      deleted: 0,
      modified: 0,
      untracked: 0,
      branches: [{ name: 'codex/bobby-cli-parity', current: true, upstream: 'origin/codex/bobby-cli-parity' }]
    }),
    switchGitBranch: vi.fn().mockResolvedValue({ currentBranch: 'codex/bobby-cli-parity' }),
    gitCommit: vi.fn().mockResolvedValue({ committed: true, hash: 'abc1234', output: 'Committed changes' }),
    restoreSnapshot: vi.fn().mockResolvedValue(undefined),
    openProject: vi.fn().mockResolvedValue(undefined),
    selectProject: vi.fn().mockResolvedValue({
      project: { name: 'Bobby', path: 'E:\\ai-files\\Bobby', lastOpenedAt: '2026-06-12T00:00:00.000Z' },
      recentProjects: [{ name: 'Bobby', path: 'E:\\ai-files\\Bobby', lastOpenedAt: '2026-06-12T00:00:00.000Z' }]
    })
  };
}

describe('gui package smoke test', () => {
  beforeEach(() => {
    resetStore();
    localStorage.clear();
    localStorage.setItem('bobby-onboarding-complete', 'true');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    (window as { bobby?: unknown }).bobby = undefined;
    localStorage.clear();
  });

  it('restores the newest persisted task into the workspace when the saved last active id is stale', async () => {
    localStorage.setItem('bobby-last-active-session', 'missing-session');
    installBobby([
      {
        id: 'older',
        title: 'Older task',
        blocks: [{ kind: 'user', id: 'u-older', text: 'Older task' }],
        createdAt: '2026-06-11T00:00:00.000Z',
        updatedAt: '2026-06-11T00:00:00.000Z',
        projectDir: 'E:\\ai-files\\Bobby',
        taskId: 'task-older',
        status: 'done',
        liveReasoning: '',
        liveAssistant: '',
        liveToolContent: '',
        currentPlan: [],
        error: null,
        costUsd: 0,
        spendUsd: 0,
        model: null,
        mode: 'standard'
      },
      {
        id: 'latest',
        title: 'Latest task',
        blocks: [{ kind: 'user', id: 'u-latest', text: 'Latest task' }],
        createdAt: '2026-06-11T01:00:00.000Z',
        updatedAt: '2026-06-11T02:00:00.000Z',
        projectDir: 'E:\\ai-files\\Bobby',
        taskId: 'task-latest',
        status: 'done',
        liveReasoning: '',
        liveAssistant: '',
        liveToolContent: '',
        currentPlan: [],
        error: null,
        costUsd: 0,
        spendUsd: 0,
        model: null,
        mode: 'plan-only'
      }
    ]);

    render(React.createElement(App));

    expect(await screen.findByTestId('chat-workbench')).toBeTruthy();
    await waitFor(() => {
      expect(useChatStore.getState().activeSessionId).toBe('latest');
      expect(useChatStore.getState().currentTaskId).toBe('task-latest');
      expect(useChatStore.getState().sessionMode).toBe('plan-only');
    });
    expect(screen.getAllByText('Latest task').length).toBeGreaterThan(0);
  });
});
