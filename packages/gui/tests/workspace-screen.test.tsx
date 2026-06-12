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
  searchFiles: ReturnType<typeof vi.fn>;
  saveAttachment: ReturnType<typeof vi.fn>;
  listCommands: ReturnType<typeof vi.fn>;
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
    searchFiles: vi.fn().mockResolvedValue([]),
    saveAttachment: vi.fn().mockResolvedValue({ path: '.bobby/uploads/saved.png' }),
    listCommands: vi.fn().mockResolvedValue([]),
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
    sessionMode: 'standard',
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

    const input = screen.getByPlaceholderText(/Describe a task/) as HTMLTextAreaElement;
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

    fireEvent.click(screen.getByRole('button', { name: /观察/i }));
    const input = screen.getByPlaceholderText(/Describe a task/) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'plan this task' } });
    fireEvent.click(screen.getByText('Send'));

    await vi.waitFor(() => {
      expect(client.startTask).toHaveBeenCalledWith('plan this task', 'plan-only', expect.stringMatching(/^task-/));
    });
  });

  it('wraps file mutation prompts with an isolated worktree instruction', async () => {
    const client = makeKernelClientMock();
    render(<Workspace kernelClient={client} />);

    const input = screen.getByPlaceholderText(/Describe a task/) as HTMLTextAreaElement;
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

    const input = screen.getByPlaceholderText(/Describe a task/) as HTMLTextAreaElement;
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

    const input = screen.getByPlaceholderText(/Describe a task/) as HTMLTextAreaElement;
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

    const input = screen.getByPlaceholderText(/Describe a task/) as HTMLTextAreaElement;
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
    expect(screen.getByText('Plugins')).toBeTruthy();
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

    const input = screen.getByPlaceholderText(/Describe a task/) as HTMLTextAreaElement;
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

    const input = screen.getByPlaceholderText(/Describe a task/) as HTMLTextAreaElement;
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

    const input = screen.getByPlaceholderText(/Describe a task/) as HTMLTextAreaElement;
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

    const input = screen.getByPlaceholderText(/Describe a task/) as HTMLTextAreaElement;
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

    const input = screen.getByPlaceholderText(/Describe a task/) as HTMLTextAreaElement;
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
