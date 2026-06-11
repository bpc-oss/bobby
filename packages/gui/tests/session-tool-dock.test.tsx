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
    listSnapshots: vi.fn().mockResolvedValue([{
      id: 'snap-1',
      createdAt: '2026-06-11T00:00:00.000Z',
      copied: [{ path: 'src/index.ts', bytes: 42 }],
      skipped: [],
      snapshotDir: 'E:\\ai-files\\Bobby\\.bobby\\snapshots\\snap-1'
    }])
  };
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
    expect(send).toHaveBeenCalledWith({ type: 'restoreSnapshot' });
  });

  it('shows checkpoint snapshots and restores a specific checkpoint', async () => {
    render(<SessionToolDock />);

    fireEvent.click(screen.getByTitle(/Diff/));
    expect(await screen.findByText('#1 snap-1')).toBeTruthy();
    fireEvent.click(screen.getByText('Restore'));

    const send = (window as any).bobby.send as ReturnType<typeof vi.fn>;
    expect(send).toHaveBeenCalledWith({ type: 'restoreSnapshot', snapshotId: 'snap-1' });
  });
});
