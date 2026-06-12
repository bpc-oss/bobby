import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { SessionToolDock } from '../src/components/SessionToolDock';
import { useChatStore } from '../src/store/chat-store';

function installBobby() {
    (window as { bobby?: unknown }).bobby = {
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
    applyProposal: vi.fn().mockResolvedValue(null),
    discardProposal: vi.fn().mockResolvedValue(undefined),
    gitIsRepo: vi.fn().mockResolvedValue(true),
    gitCommit: vi.fn().mockResolvedValue({ committed: true, hash: 'abc1234', output: 'Committed changes' }),
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
    }),
    startPreviewServer: vi.fn().mockResolvedValue({
      started: true,
      command: 'pnpm dev',
      url: 'http://localhost:5173',
      pid: 12345
    })
  };
  vi.spyOn(window, 'confirm').mockReturnValue(true);
}

beforeEach(() => {
  installBobby();
  vi.spyOn(window, 'open').mockImplementation(() => null);
  window.localStorage.clear();
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
    previewTarget: null,
    composerInsertion: null,
    threads: {},
    taskThreadIds: {},
    pendingThreadIds: []
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  (window as { bobby?: unknown }).bobby = undefined;
});

describe('SessionToolDock', () => {
  it('shows only the codex-style visible dock entries', () => {
    render(<SessionToolDock />);

    expect(screen.getByTitle(/Review/)).toBeTruthy();
    expect(screen.getByTitle(/Terminal/)).toBeTruthy();
    expect(screen.getByTitle(/Browser/)).toBeTruthy();
    expect(screen.getByTitle(/Files/)).toBeTruthy();

    expect(screen.queryByTitle(/Mission Control/)).toBeNull();
    expect(screen.queryByTitle(/Plan/)).toBeNull();
    expect(screen.queryByTitle(/^Diff/)).toBeNull();
    expect(screen.queryByTitle(/Side Chat/)).toBeNull();
    expect(screen.queryByTitle(/Preview/)).toBeNull();
    expect(screen.queryByTitle(/Background Tasks/)).toBeNull();
  });

  it('shows dock labels and shortcuts as visible navigation text', () => {
    render(<SessionToolDock />);

    expect(screen.getAllByText('Review').length).toBeGreaterThan(0);
    expect(screen.getByText('Terminal')).toBeTruthy();
    expect(screen.getByText('Browser')).toBeTruthy();
    expect(screen.getByText('Files')).toBeTruthy();
    expect(screen.getAllByText('Ctrl+Shift+G').length).toBeGreaterThan(0);
    expect(screen.getByText('Ctrl+`')).toBeTruthy();
    expect(screen.getByText('Ctrl+T')).toBeTruthy();
    expect(screen.getByText('Ctrl+P')).toBeTruthy();
  });

  it('opens the review panel when a background proposal requests review', async () => {
    render(<SessionToolDock requestedTab={{ id: 'review', nonce: 1 }} />);

    expect((await screen.findByTestId('dock-active-tab')).textContent).toBe('Review');
    expect(window.bobby.listProposals).toHaveBeenCalled();
  });

  it('normalizes unsupported stored dock tabs to a supported tab on mount', async () => {
    window.localStorage.setItem('bobby:dock:tab', 'mission');

    render(<SessionToolDock />);

    expect((await screen.findByTestId('dock-active-tab')).textContent).toBe('Review');
    expect(screen.queryByTitle(/Mission Control/)).toBeNull();
  });

  it('maps legacy preview restores to the browser tab', async () => {
    window.localStorage.setItem('bobby:dock:tab', 'preview');

    render(<SessionToolDock />);

    expect((await screen.findByTestId('dock-active-tab')).textContent).toBe('Browser');
  });

  it('loads workspace files from disk and keeps the preview empty until a file is selected', async () => {
    render(<SessionToolDock />);

    fireEvent.click(screen.getByTitle(/Files/));
    expect(await screen.findByTestId('files-layout')).toBeTruthy();
    expect(screen.getByTestId('files-preview-pane')).toBeTruthy();
    expect(screen.getByText('Select a file from the workspace tree to preview it.')).toBeTruthy();
    expect(screen.queryByText('Open file')).toBeNull();
    expect(screen.queryByPlaceholderText('src/file.ts')).toBeNull();
    expect(window.bobby.readWorkspaceFile).not.toHaveBeenCalledWith('src/utils.ts');

    fireEvent.click(screen.getByText('utils.ts'));
    expect(await screen.findByText('export const answer = 42;')).toBeTruthy();

    const readWorkspaceFile = window.bobby.readWorkspaceFile;
    expect(readWorkspaceFile).toHaveBeenCalledWith('src/utils.ts');
  });

  it('shows workspace tree failures as an error card', async () => {
    window.bobby.listWorkspaceTree = vi.fn().mockRejectedValueOnce(new Error('disk offline'));

    render(<SessionToolDock />);

    fireEvent.click(screen.getByTitle(/Files/));

    expect(await screen.findByText(/Failed to load workspace files: disk offline/)).toBeTruthy();
  });

  it('shows workspace file read failures as an error card', async () => {
    window.bobby.readWorkspaceFile = vi.fn()
      .mockRejectedValueOnce(new Error('permission denied'));

    render(<SessionToolDock />);

    fireEvent.click(screen.getByTitle(/Files/));
    expect(await screen.findByTestId('files-layout')).toBeTruthy();

    fireEvent.click(screen.getByText('utils.ts'));

    expect(await screen.findByText(/Failed to read workspace file: permission denied/)).toBeTruthy();
  });

  it('filters the workspace tree by file name', async () => {
    render(<SessionToolDock />);

    fireEvent.click(screen.getByTitle(/Files/));
    expect(await screen.findByText('index.ts')).toBeTruthy();
    expect(screen.getByText('utils.ts')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/Filter files/i), { target: { value: 'utils' } });

    expect(screen.queryByText('index.ts')).toBeNull();
    expect(screen.getByText('utils.ts')).toBeTruthy();
  });

  it('inserts a file reference from the files panel into the shared composer state', async () => {
    render(<SessionToolDock />);

    fireEvent.click(screen.getByTitle(/Files/));
    expect(await screen.findByTestId('files-layout')).toBeTruthy();
    fireEvent.click(screen.getByText('utils.ts'));
    expect(await screen.findByText('export const answer = 42;')).toBeTruthy();
    fireEvent.click(screen.getByText('Insert reference'));

    expect(useChatStore.getState().composerInsertion).toBe('@src/utils.ts');
  });

  it('runs real terminal commands through IPC and shows the output', async () => {
    render(<SessionToolDock />);

    fireEvent.click(screen.getByTitle(/Terminal/));
    expect(screen.getByText('E:\\ai-files\\Bobby')).toBeTruthy();
    const input = screen.getByPlaceholderText(/pnpm test/i);
    fireEvent.change(input, { target: { value: 'pnpm test' } });
    fireEvent.click(screen.getByText('Run'));

    const runTerminalCommand = window.bobby.runTerminalCommand;
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('pnpm test'));
    expect(runTerminalCommand).toHaveBeenCalledWith({ command: 'pnpm test', confirmed: true });
    expect(await screen.findByText('exit 0')).toBeTruthy();
    expect(screen.getByText('ok')).toBeTruthy();
  });

  it('reruns and clears terminal command history without removing evidence stream', async () => {
    render(<SessionToolDock />);

    fireEvent.click(screen.getByTitle(/Terminal/));
    fireEvent.change(screen.getByPlaceholderText(/pnpm test/i), { target: { value: 'pnpm test' } });
    fireEvent.click(screen.getByText('Run'));
    expect(await screen.findByText('exit 0')).toBeTruthy();

    fireEvent.click(screen.getByText('Rerun'));
    expect(window.bobby.runTerminalCommand).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByText('Clear history'));
    expect(screen.getByText('No terminal commands yet.')).toBeTruthy();
    expect(screen.getByText(/Task stream/)).toBeTruthy();
  });

  it('shows task command_output evidence in chronological order', async () => {
    useChatStore.setState({
      blocks: [
        {
          kind: 'evidence',
          id: 'e-1',
          evidence: {
            claimId: 'c-1',
            acId: 'AC1',
            evidenceType: 'command_output',
            payload: {
              cmd: 'pnpm test',
              args: [],
              exitCode: 0,
              stdout: 'first\n',
              stderr: '',
              signal: null,
              timedOut: false
            },
            producedBy: 'tool'
          }
        },
        {
          kind: 'evidence',
          id: 'e-2',
          evidence: {
            claimId: 'c-2',
            acId: 'AC2',
            evidenceType: 'command_output',
            payload: {
              cmd: 'git status',
              args: [],
              exitCode: 1,
              stdout: '',
              stderr: 'boom\n',
              signal: null,
              timedOut: false
            },
            producedBy: 'tool'
          }
        }
      ],
      currentPlan: [],
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

    fireEvent.click(screen.getByTitle(/Terminal/));
    expect(await screen.findByText(/Task stream/)).toBeTruthy();
    expect(screen.getByText('pnpm test')).toBeTruthy();
    expect(screen.getByText('exit 0')).toBeTruthy();
    expect(screen.getByText('git status')).toBeTruthy();
    expect(screen.getByText('boom')).toBeTruthy();
  });

  it('keeps proposal apply disabled while the current session still has a gate', async () => {
    window.bobby.listProposals = vi.fn().mockResolvedValue([
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

  it('shows review readiness, changed files, and applies a ready proposal with all gates', async () => {
    window.bobby.listProposals = vi.fn().mockResolvedValue([
      {
        proposalId: 'proposal-1',
        proposalPath: 'E:\\ai-files\\Bobby\\.bobby\\proposals\\proposal-1.patch',
        createdAt: '2026-06-11T00:00:00.000Z',
        bytes: 84,
        lineCount: 6,
        patch: [
          'diff --git a/src/index.ts b/src/index.ts',
          '--- a/src/index.ts',
          '+++ b/src/index.ts',
          '@@ -0,0 +1 @@',
          '+export const ready = true;',
          'diff --git a/src/utils.ts b/src/utils.ts',
          '--- a/src/utils.ts',
          '+++ b/src/utils.ts',
          '@@ -0,0 +1 @@',
          '+export const value = 42;'
        ].join('\n')
      }
    ]);
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
            payload: { path: 'src/index.ts', patch: '@@ -0,0 +1 @@\n+export const ready = true;' },
            producedBy: 'tool'
          }
        },
        {
          kind: 'evidence',
          id: 'e-2',
          evidence: {
            claimId: 'c2',
            acId: 'AC2',
            evidenceType: 'file_diff',
            payload: { path: 'src/utils.ts', patch: '@@ -0,0 +1 @@\n+export const value = 42;' },
            producedBy: 'tool'
          }
        }
      ],
      status: 'done'
    });

    render(<SessionToolDock />);

    fireEvent.click(screen.getByTitle(/Review/));
    expect(await screen.findByText('Completion gate passed')).toBeTruthy();
    expect(screen.getByText('Pro review passed')).toBeTruthy();
    expect(screen.getByText('Human confirmation required')).toBeTruthy();
    expect(screen.getByText('Changed files')).toBeTruthy();
    expect(screen.getByText('src/index.ts')).toBeTruthy();
    expect(screen.getByText('src/utils.ts')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(window.bobby.applyProposal).toHaveBeenCalledWith({
      proposalId: 'proposal-1',
      gatePassed: true,
      proReviewPassed: true,
      humanConfirmed: true
    });
  });

  it('commits workspace changes from the review panel only for git projects', async () => {
    render(<SessionToolDock />);

    fireEvent.click(screen.getByTitle(/Review/));
    expect(await screen.findByText('git repo')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Apply Bobby proposal'), { target: { value: 'Ship review slice' } });
    fireEvent.click(screen.getByText('Commit changes'));

    expect(window.confirm).toHaveBeenCalledWith('Commit current workspace changes?\n\nShip review slice');
    expect(window.bobby.gitCommit).toHaveBeenCalledWith({ message: 'Ship review slice' });
    expect(await screen.findByText(/Committed abc1234/)).toBeTruthy();
  });

  it('opens browser targets inside the dock and updates the shared preview target', async () => {
    render(<SessionToolDock />);

    fireEvent.click(screen.getByTitle(/Browser/));
    fireEvent.change(screen.getByPlaceholderText(/https:\/\/example.com or http:\/\/localhost:5174/i), {
      target: { value: 'http://localhost:4173' }
    });
    fireEvent.click(screen.getByText('Open'));

    expect(window.open).not.toHaveBeenCalled();
    expect(window.bobby.send).toHaveBeenCalledWith({
      type: 'startTask',
      input: 'Open and inspect this web page, then report visible evidence: http://localhost:4173'
    });
    expect(await screen.findByText(/Active browser target: http:\/\/localhost:4173/)).toBeTruthy();
    expect(useChatStore.getState().previewTarget).toBe('http://localhost:4173');
  });

  it('refreshes the active local browser target inside the dock', async () => {
    render(<SessionToolDock />);

    fireEvent.click(screen.getByTitle(/Browser/));
    fireEvent.change(screen.getByPlaceholderText(/https:\/\/example.com or http:\/\/localhost:5174/i), {
      target: { value: 'http://localhost:4173' }
    });
    fireEvent.click(screen.getByText('Open'));
    expect(await screen.findByText(/Active browser target: http:\/\/localhost:4173/)).toBeTruthy();

    fireEvent.click(screen.getByText('Refresh'));
    expect(await screen.findByText(/Refreshing http:\/\/localhost:4173/)).toBeTruthy();
  });

  it('blocks unsupported external browser targets with an error card', async () => {
    render(<SessionToolDock />);

    fireEvent.click(screen.getByTitle(/Browser/));
    fireEvent.change(screen.getByPlaceholderText(/https:\/\/example.com or http:\/\/localhost:5174/i), {
      target: { value: 'https://example.com' }
    });
    fireEvent.click(screen.getByText('Open'));

    expect(await screen.findByText(/Only local preview targets are supported in the docked browser/)).toBeTruthy();
    expect(window.bobby.send).not.toHaveBeenCalledWith({
      type: 'startTask',
      input: 'Open and inspect this web page, then report visible evidence: https://example.com'
    });
    expect(useChatStore.getState().previewTarget).toBeNull();
  });

  it('restores the last open dock tab after remount', async () => {
    const firstRender = render(<SessionToolDock />);

    fireEvent.click(screen.getByTitle(/Terminal/));
    expect((await screen.findByTestId('dock-active-tab')).textContent).toBe('Terminal');

    firstRender.unmount();

    render(<SessionToolDock />);
    expect((await screen.findByTestId('dock-active-tab')).textContent).toBe('Terminal');
  });

  it('opens the review tab when requested with an unsupported legacy dock id', async () => {
    render(<SessionToolDock requestedTab={{ id: 'diff', nonce: 1 }} />);

    expect((await screen.findByTestId('dock-active-tab')).textContent).toBe('Review');
  });
});
