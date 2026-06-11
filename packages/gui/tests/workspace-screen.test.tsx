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
      expect(client.startTask).toHaveBeenCalledWith('hello world');
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
      expect(client.startTask).toHaveBeenCalledWith('run another task');
    });
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
    useChatStore.setState({
      blocks: [{ kind: 'user', id: 'u-current', text: 'Run this through Mission Control' }],
      sessions: [],
      activeSessionId: 'current'
    });
    render(<App />);

    fireEvent.click(screen.getByTitle('Current session'));

    expect(useChatStore.getState().sessions).toHaveLength(0);
    expect(useChatStore.getState().blocks).toEqual([
      expect.objectContaining({ kind: 'user', text: 'Run this through Mission Control' })
    ]);
  });

  it('renders the active session only once when history contains the same title', () => {
    useChatStore.setState({
      blocks: [{ kind: 'user', id: 'u-current', text: 'Run this through Mission Control' }],
      activeSessionId: 'current',
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

    expect(screen.getAllByTitle('Current session')).toHaveLength(1);
    expect(screen.queryByTitle('Run this through Mission Control')).toBeNull();
  });
});
