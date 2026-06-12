import React from 'react';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

import type { Evidence, KernelEvent } from '@bobby/shared';
import { useChatStore } from '../src/store/chat-store';

import { EvidencePanel } from '../src/components/EvidencePanel';
import { App } from '../src/main';
import { Workspace } from '../src/screens/Workspace';
import type { CapabilityReport, SessionRecordDto } from '../src/ipc/contract';

type KernelClientMock = {
  startTask: ReturnType<typeof vi.fn>;
  approveGate: ReturnType<typeof vi.fn>;
  restoreSnapshot: ReturnType<typeof vi.fn>;
  listProjects: ReturnType<typeof vi.fn>;
  listSessions: ReturnType<typeof vi.fn>;
  listTasks: ReturnType<typeof vi.fn>;
  searchFiles: ReturnType<typeof vi.fn>;
  saveAttachment: ReturnType<typeof vi.fn>;
  listCommands: ReturnType<typeof vi.fn>;
  listMcpServers: ReturnType<typeof vi.fn>;
  listSubAgents: ReturnType<typeof vi.fn>;
  getGitStatusSummary: ReturnType<typeof vi.fn>;
  switchGitBranch: ReturnType<typeof vi.fn>;
  gitCommit: ReturnType<typeof vi.fn>;
  getCapabilityReport?: ReturnType<typeof vi.fn>;
  onEvent: (callback: (event: KernelEvent) => void) => () => void;
};

function noopOnEvent(_callback: (event: KernelEvent) => void): () => void {
  return () => {};
}

function makeKernelClientMock(): KernelClientMock {
  return {
    startTask: vi.fn().mockResolvedValue(undefined),
    approveGate: vi.fn().mockResolvedValue(undefined),
    restoreSnapshot: vi.fn().mockResolvedValue(undefined),
    listProjects: vi.fn().mockResolvedValue([
      { name: 'Bobby', path: 'E:\\ai-files\\Bobby', lastOpenedAt: '2026-06-12T00:00:00.000Z' }
    ]),
    listSessions: vi.fn().mockResolvedValue([]),
    listTasks: vi.fn().mockResolvedValue([]),
    searchFiles: vi.fn().mockResolvedValue([]),
    saveAttachment: vi.fn().mockResolvedValue({ path: '.bobby/uploads/saved.png' }),
    listCommands: vi.fn().mockResolvedValue([]),
    listMcpServers: vi.fn().mockResolvedValue([]),
    listSubAgents: vi.fn().mockResolvedValue([]),
    getGitStatusSummary: vi.fn().mockResolvedValue({
      isRepo: true,
      branch: 'feature/env-card',
      ahead: 0,
      behind: 0,
      added: 7,
      deleted: 3,
      modified: 2,
      untracked: 1,
      branches: [
        { name: 'feature/env-card', current: true, upstream: 'origin/feature/env-card' },
        { name: 'main', current: false, upstream: 'origin/main' }
      ]
    }),
    switchGitBranch: vi.fn().mockResolvedValue({ currentBranch: 'main' }),
    gitCommit: vi.fn().mockResolvedValue({ committed: true, hash: 'abc1234', output: 'Committed changes' }),
    onEvent: noopOnEvent
  };
}

beforeEach(() => {
  window.localStorage.setItem('bobby-onboarding-complete', 'true');
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
    currentProject: null,
    recentProjects: [],
    previewTarget: null,
    _client: null
  });
});

describe('workspace UI smoke', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    (window as unknown as { bobby?: unknown }).bobby = undefined;
    window.localStorage.clear();
  });

  it('renders evidence file_exists as plain-language entry', () => {
    render(
      <EvidencePanel
        evidence={[
          {
            claimId: 'c1',
            acId: 'AC1',
            evidenceType: 'file_exists',
            payload: { exists: true, path: '/x/a.txt' },
            producedBy: 'tool'
          } satisfies Evidence
        ]}
      />
    );

    expect(screen.getByText('path: /x/a.txt')).toBeTruthy();
  });

  it('smoke renders workspace core areas', () => {
    const client = makeKernelClientMock();
    render(<Workspace kernelClient={client} />);

    expect(screen.getByPlaceholderText(/Describe a task/)).toBeTruthy();
    expect(screen.getByText('Send')).toBeTruthy();
    expect(screen.getByText('Bobby')).toBeTruthy();
  });

  it('sendMessage calls client.startTask via store', async () => {
    const client = makeKernelClientMock();
    useChatStore.getState().setClient(client);
    useChatStore.getState().sendMessage('hello world');
    await vi.waitFor(() => {
      expect(client.startTask).toHaveBeenCalledWith('hello world', 'standard', expect.stringMatching(/^task-/));
    });
  });

  it('keeps the composer usable while a task is already running', async () => {
    const client = makeKernelClientMock();
    useChatStore.setState({ busy: true, status: 'running' });
    render(<Workspace kernelClient={client} />);

    const input = screen.getByPlaceholderText(/随心输入|Describe a task/) as HTMLTextAreaElement;
    expect(input.disabled).toBe(false);

    fireEvent.change(input, { target: { value: 'run another task' } });
    fireEvent.click(screen.getByText('Send'));

    await vi.waitFor(() => {
      expect(client.startTask).toHaveBeenCalledWith('run another task', 'standard', expect.stringMatching(/^task-/));
    });
  });

  it('switches the composer into plan-only mode and forwards that mode to startTask', async () => {
    const client = makeKernelClientMock();
    render(<Workspace kernelClient={client} />);

    fireEvent.click(screen.getByTestId('composer-plan-toggle'));
    const input = screen.getByPlaceholderText(/随心输入|Describe a task/) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'plan this task' } });
    fireEvent.click(screen.getByText('Send'));

    await vi.waitFor(() => {
      expect(client.startTask).toHaveBeenCalledWith('plan this task', 'plan-only', expect.stringMatching(/^task-/));
    });
  });

  it('wraps file mutation prompts with an isolated worktree instruction', async () => {
    const client = makeKernelClientMock();
    render(<Workspace kernelClient={client} />);

    const input = screen.getByPlaceholderText(/随心输入|Describe a task/) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Edit src/screens/Workspace.tsx to fix the layout' } });
    expect(screen.getByText(/Worktree proposal enabled/)).toBeTruthy();
    fireEvent.click(screen.getByText('Send'));

    await vi.waitFor(() => {
      expect(client.startTask).toHaveBeenCalledWith(expect.stringContaining('isolated git worktree'), 'standard', expect.stringMatching(/^task-/));
    });
    expect(client.startTask).toHaveBeenCalledWith(
      expect.stringContaining('Edit src/screens/Workspace.tsx to fix the layout'),
      'standard',
      expect.stringMatching(/^task-/)
    );
  });

  it('inserts a fuzzy file reference from the @ menu into the composer', async () => {
    const client = makeKernelClientMock();
    client.searchFiles.mockResolvedValueOnce([
      { path: 'src/screens/Workspace.tsx', preview: 'Composer preview' }
    ]);
    render(<Workspace kernelClient={client} />);

    const input = screen.getByPlaceholderText(/随心输入|Describe a task/) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '@wor' } });
    expect(await screen.findByText('Workspace.tsx')).toBeTruthy();
    expect(screen.getByText(/Composer preview/)).toBeTruthy();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input.value).toContain('@src/screens/Workspace.tsx');
  });

  it('executes the slash menu undo action without sending a task', async () => {
    const client = makeKernelClientMock();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Workspace kernelClient={client} />);

    const input = screen.getByPlaceholderText(/随心输入|Describe a task/) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '/undo' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(window.confirm).toHaveBeenCalledWith('Restore the latest checkpoint?');
    expect(client.restoreSnapshot).toHaveBeenCalledWith(undefined);
    expect(client.startTask).not.toHaveBeenCalled();
  });

  it('does not execute slash undo when restore confirmation is cancelled', async () => {
    const client = makeKernelClientMock();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Workspace kernelClient={client} />);

    const input = screen.getByPlaceholderText(/随心输入|Describe a task/) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '/undo' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(window.confirm).toHaveBeenCalledWith('Restore the latest checkpoint?');
    expect(client.restoreSnapshot).not.toHaveBeenCalled();
    expect(client.startTask).not.toHaveBeenCalled();
  });

  it('renders the chat workbench as a horizontal workspace with a session dock', () => {
    render(<App />);

    const workbench = screen.getByTestId('chat-workbench');
    expect(workbench.className).toContain('flex');
    expect(workbench.className).toContain('h-full');
    expect(screen.getByText('Mission Control')).toBeTruthy();
    expect(screen.queryByTitle('Write')).toBeNull();
    expect(screen.queryByTitle('Code')).toBeNull();
  });

  it('handles background proposal navigation by opening the review dock', async () => {
    render(<App />);

    await act(async () => {
      window.dispatchEvent(new CustomEvent('bobby:navigate', {
        detail: {
          page: 'chat',
          dockTab: 'review',
          proposalId: 'proposal-1'
        }
      }));
    });

    expect(screen.getByTestId('chat-workbench')).toBeTruthy();
    expect(screen.getByTestId('dock-active-tab').textContent).toBe('Review');
  });

  it('renders the activity rail and project-grouped task navigator', () => {
    useChatStore.setState({
      activeSessionId: 'thread-2',
      currentProject: {
        name: 'Bobby',
        path: 'E:\\ai-files\\Bobby',
        lastOpenedAt: '2026-06-11T00:04:00.000Z'
      },
      recentProjects: [
        {
          name: 'Bobby',
          path: 'E:\\ai-files\\Bobby',
          lastOpenedAt: '2026-06-11T00:04:00.000Z'
        }
      ],
      threads: {
        'thread-1': {
          id: 'thread-1',
          title: 'First task',
          blocks: [{ kind: 'user', id: 'u-1', text: 'First task' }],
          createdAt: '2026-06-11T00:00:00.000Z',
          updatedAt: '2026-06-11T00:02:00.000Z',
          projectDir: 'E:\\ai-files\\Bobby',
          taskId: 'task-1',
          status: 'done',
          liveReasoning: '',
          liveAssistant: '',
          liveToolContent: '',
          currentPlan: [],
          error: null,
          costUsd: 0,
          spendUsd: 0,
          model: null
        },
        'thread-2': {
          id: 'thread-2',
          title: 'Second task',
          blocks: [{ kind: 'user', id: 'u-2', text: 'Second task' }],
          createdAt: '2026-06-11T00:03:00.000Z',
          updatedAt: '2026-06-11T00:04:00.000Z',
          projectDir: 'E:\\ai-files\\Bobby',
          taskId: 'task-2',
          status: 'running',
          liveReasoning: '',
          liveAssistant: '',
          liveToolContent: '',
          currentPlan: [],
          error: null,
          costUsd: 0,
          spendUsd: 0,
          model: null
        }
      },
      sessions: [],
      blocks: [{ kind: 'user', id: 'u-2', text: 'Second task' }],
      currentTaskId: 'task-2',
      status: 'running',
      busy: true
    });

    render(<App />);

    expect(screen.getByTestId('activity-rail')).toBeTruthy();
    expect(screen.getByTestId('project-task-navigator')).toBeTruthy();
    expect(screen.getByText('Projects')).toBeTruthy();
    expect(screen.getAllByText('Bobby').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Second task').length).toBeGreaterThan(0);
    expect(screen.getAllByText('running').length).toBeGreaterThan(0);
    expect(screen.getByText('New Chat')).toBeTruthy();
    expect(screen.getByText('Search')).toBeTruthy();
    expect(screen.getByText('Plugins')).toBeTruthy();
  });

  it('collapses and expands project task groups from the navigator', () => {
    useChatStore.setState({
      activeSessionId: 'thread-2',
      currentProject: {
        name: 'Bobby',
        path: 'E:\\ai-files\\Bobby',
        lastOpenedAt: '2026-06-11T00:04:00.000Z'
      },
      recentProjects: [
        {
          name: 'Bobby',
          path: 'E:\\ai-files\\Bobby',
          lastOpenedAt: '2026-06-11T00:04:00.000Z'
        }
      ],
      threads: {
        'thread-1': {
          id: 'thread-1',
          title: 'First task',
          blocks: [{ kind: 'user', id: 'u-1', text: 'First task' }],
          createdAt: '2026-06-11T00:00:00.000Z',
          updatedAt: '2026-06-11T00:02:00.000Z',
          projectDir: 'E:\\ai-files\\Bobby',
          taskId: 'task-1',
          status: 'done',
          liveReasoning: '',
          liveAssistant: '',
          liveToolContent: '',
          currentPlan: [],
          error: null,
          costUsd: 0,
          spendUsd: 0,
          model: null
        },
        'thread-2': {
          id: 'thread-2',
          title: 'Second task',
          blocks: [{ kind: 'user', id: 'u-2', text: 'Second task' }],
          createdAt: '2026-06-11T00:03:00.000Z',
          updatedAt: '2026-06-11T00:04:00.000Z',
          projectDir: 'E:\\ai-files\\Bobby',
          taskId: 'task-2',
          status: 'running',
          liveReasoning: '',
          liveAssistant: '',
          liveToolContent: '',
          currentPlan: [],
          error: null,
          costUsd: 0,
          spendUsd: 0,
          model: null
        }
      },
      sessions: [],
      blocks: [{ kind: 'user', id: 'u-2', text: 'Second task' }],
      currentTaskId: 'task-2',
      status: 'running',
      busy: true
    });

    render(<App />);

    expect(screen.getByTestId('sidebar-task-thread-1')).toBeTruthy();
    expect(screen.getByTestId('sidebar-task-thread-2')).toBeTruthy();

    fireEvent.click(screen.getByTestId('project-group-toggle-E-ai-files-Bobby'));
    expect(screen.queryByTestId('sidebar-task-thread-1')).toBeNull();
    expect(screen.queryByTestId('sidebar-task-thread-2')).toBeNull();

    fireEvent.click(screen.getByTestId('project-group-toggle-E-ai-files-Bobby'));
    expect(screen.getByTestId('sidebar-task-thread-1')).toBeTruthy();
    expect(screen.getByTestId('sidebar-task-thread-2')).toBeTruthy();
  });

  it('opens global search from the rail and switches projects from the results', async () => {
    const selectProject = vi.fn().mockResolvedValue(undefined);
    useChatStore.setState({
      selectProject,
      currentProject: {
        name: 'Bobby',
        path: 'E:\\ai-files\\Bobby',
        lastOpenedAt: '2026-06-12T00:00:00.000Z'
      },
      recentProjects: [
        { name: 'Bobby', path: 'E:\\ai-files\\Bobby', lastOpenedAt: '2026-06-12T00:00:00.000Z' },
        { name: 'AI XIAOSHUO', path: 'E:\\ai-files\\AI-XIAOSHUO', lastOpenedAt: '2026-06-11T00:00:00.000Z' }
      ]
    });

    render(<App />);

    fireEvent.click(screen.getByText('Search'));
    fireEvent.change(screen.getByPlaceholderText('Search everything'), { target: { value: 'ai' } });

    expect(await screen.findByTestId('search-result-project-E-ai-files-AI-XIAOSHUO')).toBeTruthy();
    fireEvent.click(screen.getByTestId('search-result-project-E-ai-files-AI-XIAOSHUO'));

    await vi.waitFor(() => {
      expect(selectProject).toHaveBeenCalledWith('E:\\ai-files\\AI-XIAOSHUO');
    });
  });

  it('switches task sessions, opens files dock, and inserts commands from global search', async () => {
    const resumeSession = vi.fn();
    (window as unknown as {
      bobby: Record<string, unknown>;
    }).bobby = {
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
      listSessions: vi.fn().mockResolvedValue([
        {
          id: 'thread-1',
          title: 'Investigate shell parity',
          blocks: [{ kind: 'user', id: 'u-1', text: 'Investigate shell parity' }],
          createdAt: '2026-06-11T00:00:00.000Z',
          updatedAt: '2026-06-11T00:04:00.000Z',
          projectDir: 'E:\\ai-files\\Bobby',
          taskId: 'task-1',
          status: 'running',
          liveReasoning: '',
          liveAssistant: '',
          liveToolContent: '',
          currentPlan: [],
          error: null,
          costUsd: 0,
          spendUsd: 0,
          model: null
        }
      ]),
      listTasks: vi.fn().mockResolvedValue([
        { taskId: 'task-1', userGoal: 'Investigate shell parity', state: 'running', traceCount: 2, hasContract: true, hasPlan: true, hasReport: false }
      ]),
      searchFiles: vi.fn().mockResolvedValue([
        { path: 'src/screens/Workspace.tsx', preview: 'Workspace search result' }
      ]),
      listCommands: vi.fn().mockResolvedValue([
        {
          sourcePath: 'E:\\ai-files\\Bobby\\.bobby\\commands\\summarize.md',
          name: 'summarize',
          description: 'Summarize the current task',
          promptTemplate: 'Summarize this task:\n{{input}}'
        }
      ]),
      listMcpServers: vi.fn().mockResolvedValue([
        { id: 'filesystem', name: 'Filesystem', command: 'npx', args: ['-y'], env: {}, enabled: true, notes: null }
      ]),
      listSubAgents: vi.fn().mockResolvedValue([
        { sourcePath: 'E:\\ai-files\\Bobby\\.bobby\\agents\\reviewer.md', name: 'Reviewer', description: 'Review code changes', prompt: 'review', enabled: true }
      ])
    };
    useChatStore.setState({
      resumeSession,
      currentProject: {
        name: 'Bobby',
        path: 'E:\\ai-files\\Bobby',
        lastOpenedAt: '2026-06-12T00:00:00.000Z'
      },
      threads: {
        'thread-1': {
          id: 'thread-1',
          title: 'Investigate shell parity',
          blocks: [{ kind: 'user', id: 'u-1', text: 'Investigate shell parity' }],
          createdAt: '2026-06-11T00:00:00.000Z',
          updatedAt: '2026-06-11T00:04:00.000Z',
          projectDir: 'E:\\ai-files\\Bobby',
          taskId: 'task-1',
          status: 'running',
          liveReasoning: '',
          liveAssistant: '',
          liveToolContent: '',
          currentPlan: [],
          error: null,
          costUsd: 0,
          spendUsd: 0,
          model: null
        }
      },
      sessions: [{
        id: 'thread-1',
        title: 'Investigate shell parity',
        blocks: [{ kind: 'user', id: 'u-1', text: 'Investigate shell parity' }],
        createdAt: '2026-06-11T00:00:00.000Z',
        updatedAt: '2026-06-11T00:04:00.000Z',
        projectDir: 'E:\\ai-files\\Bobby',
        taskId: 'task-1',
        status: 'running',
        liveReasoning: '',
        liveAssistant: '',
        liveToolContent: '',
        currentPlan: [],
        error: null,
        costUsd: 0,
        spendUsd: 0,
        model: null
      }]
    });

    render(<App />);

    fireEvent.click(await screen.findByTitle('Search'));
    fireEvent.change(screen.getByPlaceholderText('Search everything'), { target: { value: 'invest' } });

    expect(await screen.findByTestId('search-result-session-thread-1')).toBeTruthy();
    fireEvent.click(screen.getByTestId('search-result-session-thread-1'));
    expect(resumeSession).toHaveBeenCalledWith('thread-1');

    fireEvent.click(await screen.findByTitle('Search'));
    fireEvent.change(screen.getByPlaceholderText('Search everything'), { target: { value: 'workspace' } });
    fireEvent.click(await screen.findByTestId('search-result-file-src-screens-Workspace-tsx'));
    expect((await screen.findByTestId('dock-active-tab')).textContent).toContain('Files');

    fireEvent.click(await screen.findByTitle('Search'));
    fireEvent.change(screen.getByPlaceholderText('Search everything'), { target: { value: 'sum' } });
    fireEvent.click(await screen.findByTestId('search-result-command-summarize'));

    await vi.waitFor(() => {
      const composer = screen.getByPlaceholderText(/随心输入|Describe a task/) as HTMLTextAreaElement;
      expect(composer.value).toContain('/summarize');
    });
  });

  it('starts from brainstorming mission guidance instead of write/code modules', () => {
    render(<Workspace kernelClient={makeKernelClientMock()} />);

    expect(screen.getByText('Shape a mission')).toBeTruthy();
    expect(screen.getByText('Explore approaches')).toBeTruthy();
    expect(screen.getByText('Build the plan')).toBeTruthy();
    expect(screen.getByText('Run with proof')).toBeTruthy();
    expect(screen.getByText('Audit the session')).toBeTruthy();
    expect(screen.queryByText('Write')).toBeNull();
    expect(screen.queryByText('Code')).toBeNull();
  });

  it('renders a codex-style empty state and floating composer console', () => {
    useChatStore.setState({
      currentProject: {
        name: 'Bobby',
        path: 'E:\\ai-files\\Bobby',
        lastOpenedAt: '2026-06-12T00:00:00.000Z'
      },
      recentProjects: [
        {
          name: 'Bobby',
          path: 'E:\\ai-files\\Bobby',
          lastOpenedAt: '2026-06-12T00:00:00.000Z'
        },
        {
          name: 'AI XIAOSHUO',
          path: 'E:\\ai-files\\AI-XIAOSHUO',
          lastOpenedAt: '2026-06-11T00:00:00.000Z'
        }
      ]
    });

    render(<Workspace kernelClient={makeKernelClientMock()} />);

    expect(screen.getAllByText('我们应该在 Bobby 中构建什么?').length).toBeGreaterThan(0);
    expect(screen.getByTestId('composer-console')).toBeTruthy();
    expect(screen.getByTestId('composer-project-picker')).toBeTruthy();
    expect(screen.getByTestId('composer-plan-toggle')).toBeTruthy();
    expect(screen.getByTestId('composer-goal-toggle')).toBeTruthy();
    expect(screen.getByText('完全访问')).toBeTruthy();
    expect(screen.queryByText('新对话')).toBeNull();
    expect(screen.queryByText('等待输入')).toBeNull();
    expect(screen.getByText('目标')).toBeTruthy();
  });

  it('keeps the full shell visible around the empty state workbench', () => {
    useChatStore.setState({
      currentProject: {
        name: 'Bobby',
        path: 'E:\\ai-files\\Bobby',
        lastOpenedAt: '2026-06-12T00:00:00.000Z'
      },
      recentProjects: [
        {
          name: 'Bobby',
          path: 'E:\\ai-files\\Bobby',
          lastOpenedAt: '2026-06-12T00:00:00.000Z'
        }
      ]
    });

    render(<App />);

    expect(screen.getByTestId('activity-rail')).toBeTruthy();
    expect(screen.getByTestId('project-task-navigator')).toBeTruthy();
    expect(screen.getByTestId('chat-workbench')).toBeTruthy();
    expect(screen.getByTestId('dock-active-tab')).toBeTruthy();
    expect(screen.getAllByText('我们应该在 Bobby 中构建什么?').length).toBeGreaterThan(0);
  });

  it('opens the plus menu with create, mode, and plugin sections', async () => {
    render(<Workspace kernelClient={makeKernelClientMock()} />);

    fireEvent.click(await screen.findByTitle('Add photos and files'));

    expect(screen.getByText('添加照片和文件')).toBeTruthy();
    expect(screen.getByText('创建')).toBeTruthy();
    expect(screen.getAllByText('计划模式').length).toBeGreaterThan(0);
    expect(screen.getAllByText('目标').length).toBeGreaterThan(0);
    expect(screen.getByText('插件')).toBeTruthy();
  });

  it('loads installed MCP servers into the composer plugin menu', async () => {
    const client = makeKernelClientMock();
    client.listMcpServers.mockResolvedValueOnce([
      {
        id: 'filesystem',
        name: 'Filesystem',
        enabled: true,
        transport: { kind: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem'], cwd: 'E:\\ai-files\\Bobby' },
        tools: [
          { name: 'read_file', permissionTier: 'L2', description: 'Read a text file', evidenceType: 'command_output' }
        ],
        health: 'healthy',
        lastCheckedAt: '2026-06-12T00:00:00.000Z',
        lastError: null,
        createdAt: '2026-06-12T00:00:00.000Z',
        updatedAt: '2026-06-12T00:00:00.000Z'
      },
      {
        id: 'browser',
        name: 'Browser',
        enabled: false,
        transport: { kind: 'url', url: 'http://localhost:3010/mcp' },
        tools: [
          { name: 'open_page', permissionTier: 'L2', description: 'Open a page', evidenceType: 'command_output' }
        ],
        health: 'disabled',
        lastCheckedAt: '2026-06-12T00:00:00.000Z',
        lastError: null,
        createdAt: '2026-06-12T00:00:00.000Z',
        updatedAt: '2026-06-12T00:00:00.000Z'
      }
    ]);

    render(<Workspace kernelClient={client} />);

    fireEvent.click(await screen.findByTitle('Add photos and files'));

    expect(await screen.findByText('2 个已安装插件')).toBeTruthy();
    expect(screen.getByText('Filesystem')).toBeTruthy();
    expect(screen.getByText('Browser')).toBeTruthy();
  });

  it('opens the Plugins page from the composer plugin menu and shows the same MCP inventory', async () => {
    (window as unknown as {
      bobby: Record<string, unknown>;
    }).bobby = {
      send: vi.fn().mockResolvedValue(undefined),
      onEvent: vi.fn().mockReturnValue(() => undefined),
      onAppCommand: vi.fn().mockReturnValue(() => undefined),
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
      listSessions: vi.fn().mockResolvedValue([]),
      listTasks: vi.fn().mockResolvedValue([]),
      searchFiles: vi.fn().mockResolvedValue([]),
      saveAttachment: vi.fn().mockResolvedValue({ path: '.bobby/uploads/saved.png' }),
      listCommands: vi.fn().mockResolvedValue([]),
      listSubAgents: vi.fn().mockResolvedValue([]),
      listMcpServers: vi.fn().mockResolvedValue([
        {
          id: 'filesystem',
          name: 'Filesystem',
          enabled: true,
          transport: { kind: 'stdio', command: 'npx', args: ['-y'], cwd: 'E:\\ai-files\\Bobby' },
          tools: [{ name: 'read_file', permissionTier: 'L2', description: 'Read file', evidenceType: 'command_output' }],
          health: 'healthy',
          lastCheckedAt: '2026-06-12T00:00:00.000Z',
          lastError: null,
          createdAt: '2026-06-12T00:00:00.000Z',
          updatedAt: '2026-06-12T00:00:00.000Z'
        },
        {
          id: 'browser',
          name: 'Browser',
          enabled: false,
          transport: { kind: 'url', url: 'http://localhost:3010/mcp' },
          tools: [{ name: 'open_page', permissionTier: 'L2', description: 'Open page', evidenceType: 'command_output' }],
          health: 'disabled',
          lastCheckedAt: '2026-06-12T00:00:00.000Z',
          lastError: null,
          createdAt: '2026-06-12T00:00:00.000Z',
          updatedAt: '2026-06-12T00:00:00.000Z'
        }
      ]),
      toggleMcpServer: vi.fn().mockResolvedValue(undefined),
      removeMcpServer: vi.fn().mockResolvedValue(true),
      upsertMcpServer: vi.fn().mockResolvedValue(undefined)
    };

    useChatStore.setState({
      currentProject: {
        name: 'Bobby',
        path: 'E:\\ai-files\\Bobby',
        lastOpenedAt: '2026-06-12T00:00:00.000Z'
      },
      recentProjects: [
        {
          name: 'Bobby',
          path: 'E:\\ai-files\\Bobby',
          lastOpenedAt: '2026-06-12T00:00:00.000Z'
        }
      ]
    });

    render(<App />);

    fireEvent.click(await screen.findByTitle('Add photos and files'));
    expect(await screen.findByText('2 个已安装插件')).toBeTruthy();
    fireEvent.click(screen.getByText('管理插件'));

    expect(await screen.findByText('MCP Servers')).toBeTruthy();
    expect(screen.getAllByText('Filesystem').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Browser').length).toBeGreaterThan(0);
  });

  it('shows an environment popover with git, progress, browser, and sources', async () => {
    const client = makeKernelClientMock();
    useChatStore.setState({
      blocks: [
        { kind: 'user', id: 'u-1', text: 'Review @src/index.ts and inspect proposal.patch' },
        {
          kind: 'evidence',
          id: 'e-1',
          evidence: {
            claimId: 'c-1',
            acId: 'AC1',
            evidenceType: 'file_diff',
            payload: { path: 'src/index.ts', patch: '@@ -0,0 +1 @@\n+hello' },
            producedBy: 'tool'
          }
        }
      ],
      currentPlan: [{ id: 'step-1', desc: 'Inspect shell parity', satisfiesAcIds: ['AC1'], dependsOn: [] }],
      currentProject: {
        name: 'Bobby',
        path: 'E:\\ai-files\\Bobby',
        lastOpenedAt: '2026-06-12T00:00:00.000Z'
      },
      previewTarget: 'http://localhost:5174'
    });

    render(<Workspace kernelClient={client} />);

    expect(await screen.findByText('环境信息')).toBeTruthy();
    expect(screen.getByText('feature/env-card')).toBeTruthy();
    expect(screen.getByText('+7')).toBeTruthy();
    expect(screen.getByText('-3')).toBeTruthy();
    expect(screen.getByText('Inspect shell parity')).toBeTruthy();
    expect(screen.getByText('http://localhost:5174')).toBeTruthy();
    expect(screen.getAllByText('src/index.ts').length).toBeGreaterThan(0);
  });

  it('filters and switches branches from the environment popover', async () => {
    const client = makeKernelClientMock();
    useChatStore.setState({
      currentProject: {
        name: 'Bobby',
        path: 'E:\\ai-files\\Bobby',
        lastOpenedAt: '2026-06-12T00:00:00.000Z'
      }
    });

    render(<Workspace kernelClient={client} />);

    expect(await screen.findByText('feature/env-card')).toBeTruthy();
    fireEvent.click(screen.getByTestId('environment-branch-toggle'));
    fireEvent.change(screen.getByPlaceholderText('搜索分支'), { target: { value: 'main' } });
    fireEvent.click(screen.getByText('main'));

    await vi.waitFor(() => {
      expect(client.switchGitBranch).toHaveBeenCalledWith({ name: 'main', confirmed: true });
    });
  });

  it('opens the composer project picker and shows recent projects', () => {
    useChatStore.setState({
      currentProject: {
        name: 'Bobby',
        path: 'E:\\ai-files\\Bobby',
        lastOpenedAt: '2026-06-12T00:00:00.000Z'
      },
      recentProjects: [
        {
          name: 'Bobby',
          path: 'E:\\ai-files\\Bobby',
          lastOpenedAt: '2026-06-12T00:00:00.000Z'
        },
        {
          name: 'AI XIAOSHUO',
          path: 'E:\\ai-files\\AI-XIAOSHUO',
          lastOpenedAt: '2026-06-11T00:00:00.000Z'
        }
      ]
    });

    render(<Workspace kernelClient={makeKernelClientMock()} />);

    fireEvent.click(screen.getByTestId('composer-project-picker'));

    expect(screen.getByPlaceholderText('搜索项目')).toBeTruthy();
    expect(screen.getAllByText('Bobby').length).toBeGreaterThan(0);
    expect(screen.getByText('AI XIAOSHUO')).toBeTruthy();
    expect(screen.getByText('添加新项目')).toBeTruthy();
    expect(screen.getByText('不使用项目')).toBeTruthy();
  });

  it('toggles plan mode from the composer control bar and forwards plan-only to startTask', async () => {
    const client = makeKernelClientMock();
    render(<Workspace kernelClient={client} />);

    fireEvent.click(screen.getByTestId('composer-plan-toggle'));

    const input = screen.getByPlaceholderText(/随心输入|Describe a task/) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'plan this task' } });
    fireEvent.click(screen.getByText('Send'));

    await vi.waitFor(() => {
      expect(client.startTask).toHaveBeenCalledWith('plan this task', 'plan-only', expect.stringMatching(/^task-/));
    });
  });

  it('separates real side-tool entry points from mission status boards', () => {
    render(<App />);

    fireEvent.click(screen.getByTitle(/Terminal/));
    expect(screen.getByPlaceholderText(/pnpm test/)).toBeTruthy();
    expect(screen.getByText('Run')).toBeTruthy();

    fireEvent.click(screen.getByTitle(/Files/));
    expect(screen.getByPlaceholderText(/src\/file.ts/)).toBeTruthy();

    fireEvent.click(screen.getByTitle(/Browser/));
    expect(screen.getByPlaceholderText(/localhost:5174/)).toBeTruthy();

    fireEvent.click(screen.getByTitle(/Side Chat/));
    expect(screen.getByPlaceholderText(/side question/)).toBeTruthy();
  });

  it('loads custom slash commands into the composer menu and executes template injection', async () => {
    const client = makeKernelClientMock();
    client.listCommands.mockResolvedValueOnce([
      {
        sourcePath: 'E:\\ai-files\\Bobby\\.bobby\\commands\\summarize.md',
        name: 'summarize',
        description: 'Summarize the current task',
        promptTemplate: 'Summarize this task:\n{{input}}'
      }
    ]);
    render(<Workspace kernelClient={client} />);

    const input = screen.getByPlaceholderText(/随心输入|Describe a task/) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '/sum' } });
    expect(await screen.findByText('summarize')).toBeTruthy();

    fireEvent.change(input, { target: { value: '/summarize notes from the build' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await vi.waitFor(() => {
      expect(client.startTask).toHaveBeenCalledWith('Summarize this task:\nnotes from the build', 'standard', expect.stringMatching(/^task-/));
    });
  });

  it('saves a pasted image into the workspace before inserting a path reference', async () => {
    const client = makeKernelClientMock();
    client.saveAttachment.mockResolvedValueOnce({ path: '.bobby/uploads/clip.png' });
    render(<Workspace kernelClient={client} />);

    const input = screen.getByPlaceholderText(/随心输入|Describe a task/) as HTMLTextAreaElement;
    const image = new File(['image-bytes'], 'clip.png', { type: 'image/png' }) as File & { path?: string };
    Object.defineProperty(image, 'path', { value: 'C:\\temp\\clip.png' });

    fireEvent.paste(input, { clipboardData: { files: [image] } });

    await vi.waitFor(() => {
      expect(client.saveAttachment).toHaveBeenCalledWith({ sourcePath: 'C:\\temp\\clip.png', fileName: 'clip.png' });
      expect(input.value).toContain('![clip.png](.bobby/uploads/clip.png)');
    });
    expect(screen.getByText(/saved the image to the workspace and inserted a path reference/)).toBeTruthy();
  });

  it('saves a dropped image into the workspace before inserting a path reference', async () => {
    const client = makeKernelClientMock();
    client.saveAttachment.mockResolvedValueOnce({ path: '.bobby/uploads/drop.png' });
    render(<Workspace kernelClient={client} />);

    const input = screen.getByPlaceholderText(/随心输入|Describe a task/) as HTMLTextAreaElement;
    const image = new File(['image-bytes'], 'drop.png', { type: 'image/png' }) as File & { path?: string };
    Object.defineProperty(image, 'path', { value: 'C:\\temp\\drop.png' });

    fireEvent.drop(input, { dataTransfer: { files: [image] } });

    await vi.waitFor(() => {
      expect(client.saveAttachment).toHaveBeenCalledWith({ sourcePath: 'C:\\temp\\drop.png', fileName: 'drop.png' });
      expect(input.value).toContain('![drop.png](.bobby/uploads/drop.png)');
    });
    expect(screen.getByText(/saved the image to the workspace and inserted a path reference/)).toBeTruthy();
  });

  it('shows the vision-capable notice when the capability report says vision is available', async () => {
    const client = makeKernelClientMock();
    client.saveAttachment.mockResolvedValueOnce({ path: '.bobby/uploads/vision.png' });
    let resolveCapabilityReport!: (value: CapabilityReport) => void;
    client.getCapabilityReport = vi.fn().mockImplementation(() => new Promise((resolve) => {
      resolveCapabilityReport = resolve;
    }));

    render(<Workspace kernelClient={client} />);

    await act(async () => {
      resolveCapabilityReport({
        runnerModel: 'deepseek-v4-flash',
        graderModel: 'deepseek-v4-pro',
        useToolCalling: true,
        useJsonMode: true,
        useFim: true,
        useCaching: true,
        useReasoning: true,
        useVision: true,
        useStreaming: true,
        contextWindow: 1_000_000
      });
      await Promise.resolve();
    });

    const input = screen.getByPlaceholderText(/随心输入|Describe a task/) as HTMLTextAreaElement;
    const image = new File(['image-bytes'], 'vision.png', { type: 'image/png' }) as File & { path?: string };
    Object.defineProperty(image, 'path', { value: 'C:\\temp\\vision.png' });

    fireEvent.paste(input, { clipboardData: { files: [image] } });

    await vi.waitFor(() => {
      expect(input.value).toContain('![vision.png](.bobby/uploads/vision.png)');
    });
    expect(await screen.findByText(/Vision is enabled; Bobby saved the image to the workspace and will send it as multimodal input/)).toBeTruthy();
  });

  it('refreshes custom slash commands after the command registry changes', async () => {
    const client = makeKernelClientMock();
    client.listCommands
      .mockResolvedValueOnce([
        {
          sourcePath: 'E:\\ai-files\\Bobby\\.bobby\\commands\\summarize.md',
          name: 'summarize',
          description: 'Summarize the current task',
          promptTemplate: 'Summarize this task:\n{{input}}'
        }
      ])
      .mockResolvedValueOnce([
        {
          sourcePath: 'E:\\ai-files\\Bobby\\.bobby\\commands\\rewrite.md',
          name: 'rewrite',
          description: 'Rewrite the current draft',
          promptTemplate: 'Rewrite this task:\n{{input}}'
        }
      ]);

    render(<Workspace kernelClient={client} />);

    const input = screen.getByPlaceholderText(/随心输入|Describe a task/) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '/rew' } });
    expect(screen.queryByText('rewrite')).toBeNull();

    fireEvent(window, new Event('bobby:commands-changed'));

    expect(await screen.findByText('rewrite')).toBeTruthy();
  });

  it('does not create a duplicate session when clicking the current session row', () => {
    const current: SessionRecordDto = {
      id: 'current',
      title: 'Run this through Mission Control',
      blocks: [{ kind: 'user', id: 'u-current', text: 'Run this through Mission Control' }],
      createdAt: '2026-06-11T00:00:00.000Z',
      updatedAt: '2026-06-11T00:00:00.000Z',
      projectDir: null,
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
    useChatStore.setState({
      blocks: [{ kind: 'user', id: 'u-current', text: 'Run this through Mission Control' }],
      sessions: [],
      threads: { current },
      activeSessionId: 'current'
    });
    render(<App />);

    fireEvent.click(screen.getByTitle('Run this through Mission Control'));

    expect(useChatStore.getState().sessions).toHaveLength(0);
    expect(useChatStore.getState().blocks).toEqual([
      expect.objectContaining({ kind: 'user', text: 'Run this through Mission Control' })
    ]);
  });

  it('renders the active session only once when history contains the same title', () => {
    const current: SessionRecordDto = {
      id: 'current',
      title: 'Run this through Mission Control',
      blocks: [{ kind: 'user', id: 'u-current', text: 'Run this through Mission Control' }],
      createdAt: '2026-06-11T00:00:00.000Z',
      updatedAt: '2026-06-11T00:00:00.000Z',
      projectDir: null,
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
    useChatStore.setState({
      blocks: [{ kind: 'user', id: 'u-current', text: 'Run this through Mission Control' }],
      activeSessionId: 'current',
      threads: { current },
      sessions: [{
        id: 'persisted',
        title: 'Run this through Mission Control',
        blocks: [{ kind: 'user', id: 'u-persisted', text: 'Run this through Mission Control' }],
        createdAt: '2026-06-11T00:00:00.000Z',
        updatedAt: '2026-06-11T00:00:00.000Z',
        projectDir: null,
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
      }]
    });

    render(<App />);

    expect(screen.getAllByTitle('Run this through Mission Control')).toHaveLength(1);
  });
});
