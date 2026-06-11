import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { SessionToolDock } from '../src/components/SessionToolDock';
import { useChatStore } from '../src/store/chat-store';

function installBobby() {
    (window as any).bobby = {
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
    openQuickstart: vi.fn().mockResolvedValue(undefined),
    listProposals: vi.fn().mockResolvedValue([]),
    listSubAgentDispatches: vi.fn().mockResolvedValue([
      {
        id: 'dispatch-1',
        agentSourcePath: 'E:\\ai-files\\Bobby\\.bobby\\agents\\writer.md',
        agentName: 'Writer',
        task: 'Update the notes file',
        status: 'completed',
        mergeState: 'ready',
        createdAt: '2026-06-11T00:02:00.000Z',
        updatedAt: '2026-06-11T00:03:00.000Z',
        worktreePath: 'C:\\temp\\worktree',
        proposalId: 'proposal-1',
        proposalPath: 'E:\\ai-files\\Bobby\\.bobby\\proposals\\proposal-1.patch',
        error: null
      }
    ]),
    listSnapshots: vi.fn().mockResolvedValue([
      {
        id: 'snap-1',
        createdAt: '2026-06-11T00:00:00.000Z',
        copied: [{ path: 'src/index.ts', bytes: 42 }],
        skipped: [],
        snapshotDir: 'E:\\ai-files\\Bobby\\.bobby\\snapshots\\snap-1',
        taskId: 'task-1',
        stepId: 'step-1'
      },
      {
        id: 'snap-2',
        createdAt: '2026-06-11T00:01:00.000Z',
        copied: [{ path: 'src/utils.ts', bytes: 24 }],
        skipped: [],
        snapshotDir: 'E:\\ai-files\\Bobby\\.bobby\\snapshots\\snap-2',
        taskId: 'task-2',
        stepId: 'step-9'
      }
    ]),
    listWorkspaceTree: vi.fn().mockResolvedValue([{
      name: 'src',
      path: 'src',
      kind: 'directory',
      children: [
        { name: 'index.ts', path: 'src/index.ts', kind: 'file', size: 12 },
        { name: 'utils.ts', path: 'src/utils.ts', kind: 'file', size: 24 }
      ]
    }]),
    readWorkspaceFile: vi.fn().mockImplementation(async (path: string) => ({
      path,
      content: path === 'package.json'
        ? JSON.stringify({
            packageManager: 'pnpm@9.0.0',
            scripts: { dev: 'vite' }
          })
        : path === 'src/utils.ts'
          ? 'export const answer = 42;\n'
          : 'export const entry = true;\n'
    })),
    runTerminalCommand: vi.fn().mockResolvedValue({
      evidence: [
        {
          claimId: 'c-terminal',
          acId: 'terminal',
          evidenceType: 'command_output',
          payload: {
            cmd: 'pnpm test',
            args: [],
            exitCode: 0,
            stdout: 'ok\n',
            stderr: '',
            signal: null,
            timedOut: false
          },
          producedBy: 'tool'
        }
      ],
      result: { exitCode: 0 }
    })
  };
  vi.spyOn(window, 'confirm').mockReturnValue(true);
}

beforeEach(() => {
  installBobby();
  useChatStore.setState({
    blocks: [
      { kind: 'user', id: 'u-1', text: 'Run this through Mission Control' },
      {
        kind: 'evidence',
        id: 'e-1',
        evidence: {
          claimId: 'c1',
          acId: 'AC1',
          evidenceType: 'file_diff',
          payload: { path: 'hello.txt', patch: '@@ -0,0 +1 @@\n+hello' },
          producedBy: 'tool'
        }
      }
    ],
    currentPlan: [{ id: 'step-1', desc: 'Inspect', satisfiesAcIds: ['AC1'], dependsOn: [] }],
    currentTaskId: 'task-1',
    currentProject: {
      name: 'Bobby',
      path: 'E:\\ai-files\\Bobby',
      lastOpenedAt: '2026-06-11T00:00:00.000Z'
    },
    status: 'running',
    busy: true,
    liveReasoning: '',
    liveAssistant: '',
    liveToolContent: '',
    threads: {},
    taskThreadIds: {},
    pendingThreadIds: []
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  (window as any).bobby = undefined;
});

describe('SessionToolDock', () => {
  it('dispatches restoreSnapshot when undo is clicked from the diff tab', () => {
    render(<SessionToolDock />);

    fireEvent.click(screen.getByTitle(/Diff/));
    fireEvent.click(screen.getByText('Undo'));

    const send = (window as any).bobby.send as ReturnType<typeof vi.fn>;
    expect(window.confirm).toHaveBeenCalledWith('Restore the latest checkpoint?');
    expect(send).toHaveBeenCalledWith({ type: 'restoreSnapshot' });
  });

  it('shows checkpoint snapshots and restores a specific checkpoint', async () => {
    render(<SessionToolDock />);

    fireEvent.click(screen.getByTitle(/Diff/));
    expect(await screen.findByText('#1 snap-1')).toBeTruthy();
    expect(screen.getByText('task task-1 / step step-1')).toBeTruthy();
    fireEvent.click(screen.getByText('Restore'));

    const send = (window as any).bobby.send as ReturnType<typeof vi.fn>;
    expect(window.confirm).toHaveBeenCalledWith('Restore checkpoint snap-1?');
    expect(send).toHaveBeenCalledWith({ type: 'restoreSnapshot', snapshotId: 'snap-1' });
  });

  it('filters checkpoint timeline to the current task', async () => {
    render(<SessionToolDock />);

    fireEvent.click(screen.getByTitle(/Diff/));
    expect(await screen.findByText('#1 snap-1')).toBeTruthy();
    expect(screen.queryByText('snap-2')).toBeNull();
  });

  it('orders checkpoint timeline from oldest to newest', async () => {
    (window as any).bobby.listSnapshots = vi.fn().mockResolvedValue([
      {
        id: 'snap-2',
        createdAt: '2026-06-11T00:01:00.000Z',
        copied: [{ path: 'src/utils.ts', bytes: 24 }],
        skipped: [],
        snapshotDir: 'E:\\ai-files\\Bobby\\.bobby\\snapshots\\snap-2',
        taskId: 'task-1',
        stepId: 'step-9'
      },
      {
        id: 'snap-1',
        createdAt: '2026-06-11T00:00:00.000Z',
        copied: [{ path: 'src/index.ts', bytes: 42 }],
        skipped: [],
        snapshotDir: 'E:\\ai-files\\Bobby\\.bobby\\snapshots\\snap-1',
        taskId: 'task-1',
        stepId: 'step-1'
      }
    ]);
    useChatStore.setState((state) => ({ ...state, currentTaskId: null }));

    render(<SessionToolDock />);

    fireEvent.click(screen.getByTitle(/Diff/));
    expect(await screen.findByText('#1 snap-1')).toBeTruthy();
    expect(screen.getByText('#2 snap-2')).toBeTruthy();
  });

  it('shows recent background dispatches in the tasks panel', async () => {
    render(<SessionToolDock />);

    fireEvent.click(screen.getByTitle(/Background Tasks/));
    expect(await screen.findByText('Writer')).toBeTruthy();
    expect(screen.getByText('worktree: C:\\temp\\worktree')).toBeTruthy();
    expect(screen.getByText('proposal: E:\\ai-files\\Bobby\\.bobby\\proposals\\proposal-1.patch')).toBeTruthy();
    expect(screen.getByText('Ready')).toBeTruthy();
  });

  it('loads workspace files from disk and previews the selected file', async () => {
    render(<SessionToolDock />);

    fireEvent.click(screen.getByTitle(/Files/));
    expect(await screen.findByText('export const entry = true;')).toBeTruthy();

    fireEvent.click(screen.getByText('utils.ts'));
    expect(await screen.findByText('export const answer = 42;')).toBeTruthy();

    const readWorkspaceFile = (window as any).bobby.readWorkspaceFile as ReturnType<typeof vi.fn>;
    expect(readWorkspaceFile).toHaveBeenCalledWith('src/utils.ts');
  });

  it('runs real terminal commands through IPC and shows the output', async () => {
    render(<SessionToolDock />);

    fireEvent.click(screen.getByTitle(/Terminal/));
    const input = screen.getByPlaceholderText(/pnpm test/i);
    fireEvent.change(input, { target: { value: 'pnpm test' } });
    fireEvent.click(screen.getByText('Run'));

    const runTerminalCommand = (window as any).bobby.runTerminalCommand as ReturnType<typeof vi.fn>;
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('pnpm test'));
    expect(runTerminalCommand).toHaveBeenCalledWith({ command: 'pnpm test' });
    expect(await screen.findByText('exit 0')).toBeTruthy();
    expect(screen.getByText('ok')).toBeTruthy();
  });

  it('keeps proposal apply disabled while the current session still has a gate', async () => {
    (window as any).bobby.listProposals = vi.fn().mockResolvedValue([
      {
        proposalId: 'proposal-1',
        proposalPath: 'E:\\ai-files\\Bobby\\.bobby\\proposals\\proposal-1.patch',
        createdAt: '2026-06-11T00:00:00.000Z',
        bytes: 42,
        lineCount: 3,
        patch: '@@ -0,0 +1 @@\n+hello'
      }
    ]);
    useChatStore.setState({
      blocks: [
        { kind: 'user', id: 'u-1', text: 'Run this through Mission Control' },
        {
          kind: 'gate',
          id: 'g-1',
          gateId: 'gate-1',
          reason: 'Need human approval'
        }
      ],
      currentPlan: [{ id: 'step-1', desc: 'Inspect', satisfiesAcIds: ['AC1'], dependsOn: [] }],
      currentTaskId: 'task-1',
      currentProject: {
        name: 'Bobby',
        path: 'E:\\ai-files\\Bobby',
        lastOpenedAt: '2026-06-11T00:00:00.000Z'
      },
      status: 'running',
      busy: true,
      liveReasoning: '',
      liveAssistant: '',
      liveToolContent: '',
      threads: {},
      taskThreadIds: {},
      pendingThreadIds: []
    });

    render(<SessionToolDock />);

    fireEvent.click(screen.getByTitle(/Review/));
    expect(await screen.findByText('proposal-1')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Apply' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('detects a web project and can start a preview server from package.json', async () => {
    render(<SessionToolDock />);

    fireEvent.click(screen.getByTitle(/Preview/));
    expect(await screen.findByText(/Detected dev script from package\.json\./)).toBeTruthy();

    fireEvent.click(screen.getByText('Start dev server'));

    const runTerminalCommand = (window as any).bobby.runTerminalCommand as ReturnType<typeof vi.fn>;
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('pnpm dev'));
    expect(runTerminalCommand).toHaveBeenCalledWith({ command: 'cmd /c start "" pnpm dev' });
    expect(await screen.findByText(/Active preview: http:\/\/localhost:5173/)).toBeTruthy();
  });
});
