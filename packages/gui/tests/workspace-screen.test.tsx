import React from 'react';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import type { Evidence, KernelEvent } from '@bobby/shared';
import { useChatStore } from '../src/store/chat-store';

import { EvidencePanel } from '../src/components/EvidencePanel';
import { App } from '../src/main';
import { Workspace } from '../src/screens/Workspace';

type KernelClientMock = {
  startTask: ReturnType<typeof vi.fn>;
  approveGate: ReturnType<typeof vi.fn>;
  restoreSnapshot: ReturnType<typeof vi.fn>;
  searchFiles: ReturnType<typeof vi.fn>;
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
    searchFiles: vi.fn().mockResolvedValue([]),
    onEvent: noopOnEvent
  };
}

beforeEach(() => {
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
    threads: {},
    taskThreadIds: {},
    pendingThreadIds: [],
    sessions: [],
    activeSessionId: null,
    currentProject: null,
    recentProjects: [],
    _client: null
  });
});

describe('workspace UI smoke', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
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
    const { container } = render(<Workspace kernelClient={client} />);

    expect(screen.getByPlaceholderText(/Describe a task/)).toBeTruthy();
    expect(screen.getByText('Send')).toBeTruthy();
    expect(screen.getByText('Bobby')).toBeTruthy();
  });

  it('sendMessage calls client.startTask via store', async () => {
    const client = makeKernelClientMock();
    useChatStore.getState().setClient(client);
    useChatStore.getState().sendMessage('hello world');
    await vi.waitFor(() => {
      expect(client.startTask).toHaveBeenCalledWith('hello world', 'standard');
    });
  });

  it('keeps the composer usable while a task is already running', async () => {
    const client = makeKernelClientMock();
    useChatStore.setState({ busy: true, status: 'running' });
    render(<Workspace kernelClient={client} />);

    const input = screen.getByPlaceholderText(/Describe a task/) as HTMLTextAreaElement;
    expect(input.disabled).toBe(false);

    fireEvent.change(input, { target: { value: 'run another task' } });
    fireEvent.click(screen.getByText('Send'));

    await vi.waitFor(() => {
      expect(client.startTask).toHaveBeenCalledWith('run another task', 'standard');
    });
  });

  it('switches the composer into plan-only mode and forwards that mode to startTask', async () => {
    const client = makeKernelClientMock();
    render(<Workspace kernelClient={client} />);

    fireEvent.click(screen.getByRole('button', { name: /观察/i }));
    const input = screen.getByPlaceholderText(/Describe a task/) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'plan this task' } });
    fireEvent.click(screen.getByText('Send'));

    await vi.waitFor(() => {
      expect(client.startTask).toHaveBeenCalledWith('plan this task', 'plan-only');
    });
  });

  it('inserts a fuzzy file reference from the @ menu into the composer', async () => {
    const client = makeKernelClientMock();
    client.searchFiles.mockResolvedValueOnce([
      { path: 'src/screens/Workspace.tsx', preview: 'Composer' }
    ]);
    render(<Workspace kernelClient={client} />);

    const input = screen.getByPlaceholderText(/Describe a task/) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '@wor' } });
    expect(await screen.findByText('Workspace.tsx')).toBeTruthy();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input.value).toContain('@src/screens/Workspace.tsx');
  });

  it('executes the slash menu undo action without sending a task', async () => {
    const client = makeKernelClientMock();
    render(<Workspace kernelClient={client} />);

    const input = screen.getByPlaceholderText(/Describe a task/) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '/undo' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(client.restoreSnapshot).toHaveBeenCalledWith(undefined);
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

  it('renders the sidebar task list with task status and project name', () => {
    useChatStore.setState({
      activeSessionId: 'thread-2',
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

    expect(screen.getByText('Tasks')).toBeTruthy();
    expect(screen.getAllByText('Second task').length).toBeGreaterThan(0);
    expect(screen.getAllByText('running').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bobby').length).toBeGreaterThan(0);
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

  it('does not create a duplicate session when clicking the current session row', () => {
    const current = {
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
    const current = {
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
