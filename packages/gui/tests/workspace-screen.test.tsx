import React from 'react';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import type { Evidence, KernelEvent } from '@bobby/shared';
import { useChatStore } from '../src/store/chat-store';

import { EvidencePanel } from '../src/components/EvidencePanel';
import { Workspace } from '../src/screens/Workspace';

type KernelClientMock = {
  startTask: ReturnType<typeof vi.fn>;
  approveGate: ReturnType<typeof vi.fn>;
  onEvent: (callback: (event: KernelEvent) => void) => () => void;
};

function noopOnEvent(_callback: (event: KernelEvent) => void): () => void {
  return () => {};
}

function makeKernelClientMock(): KernelClientMock {
  return {
    startTask: vi.fn().mockResolvedValue(undefined),
    approveGate: vi.fn().mockResolvedValue(undefined),
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
    status: 'idle',
    error: null,
    costUsd: 0,
    model: null
  });
});

describe('workspace UI smoke', () => {
  afterEach(() => {
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

    expect(screen.getByPlaceholderText(/Describe your task/)).toBeTruthy();
    expect(screen.getByText('Send')).toBeTruthy();
    expect(screen.getByText('Bobby')).toBeTruthy();
  });

  it('sendMessage calls client.startTask via store', async () => {
    const client = makeKernelClientMock();
    useChatStore.getState().setClient(client);
    useChatStore.getState().sendMessage('hello world');
    await vi.waitFor(() => {
      expect(client.startTask).toHaveBeenCalledWith('hello world');
    });
  });
});
