import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Agents } from '../src/screens/Agents';

beforeEach(() => {
  (window as { bobby?: unknown }).bobby = {
    send: vi.fn(),
    onEvent: vi.fn(),
    listSubAgents: vi.fn().mockResolvedValue([
      {
        sourcePath: 'E:\\ai-files\\Bobby\\.bobby\\agents\\writer.md',
        name: 'Writer',
        description: 'Writes patch proposals',
        tools: ['write_file'],
        triggers: ['fix'],
        systemPrompt: 'You are a writer agent.'
      }
    ]),
    upsertSubAgent: vi.fn().mockResolvedValue({
      sourcePath: 'E:\\ai-files\\Bobby\\.bobby\\agents\\writer.md',
      name: 'Writer',
      description: 'Writes patch proposals',
      tools: ['write_file'],
      triggers: ['fix'],
      systemPrompt: 'You are a writer agent.'
    }),
    removeSubAgent: vi.fn().mockResolvedValue(true),
    dispatchSubAgent: vi.fn().mockResolvedValue({
      id: 'dispatch-1',
      agentSourcePath: 'E:\\ai-files\\Bobby\\.bobby\\agents\\writer.md',
      agentName: 'Writer',
      task: 'Update the notes file',
      status: 'completed',
      mergeState: 'ready',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      worktreePath: 'C:\\temp\\worktree',
      proposalId: 'proposal-1',
      proposalPath: 'E:\\ai-files\\Bobby\\.bobby\\proposals\\proposal-1.patch',
      error: null
    }),
    listSubAgentDispatches: vi.fn().mockResolvedValue([
      {
        id: 'dispatch-1',
        agentSourcePath: 'E:\\ai-files\\Bobby\\.bobby\\agents\\writer.md',
        agentName: 'Writer',
        task: 'Update the notes file',
        status: 'completed',
        mergeState: 'ready',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        worktreePath: 'C:\\temp\\worktree',
        proposalId: 'proposal-1',
        proposalPath: 'E:\\ai-files\\Bobby\\.bobby\\proposals\\proposal-1.patch',
        error: null
      }
    ])
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Agents screen', () => {
  it('renders the agent editor and dispatch list', async () => {
    render(<Agents />);

    expect(await screen.findByText('Writes patch proposals')).toBeTruthy();
    expect(screen.getByText('Dispatch task')).toBeTruthy();
    expect(screen.getByText('Recent dispatches')).toBeTruthy();
    expect(screen.getByText('worktree: C:\\temp\\worktree')).toBeTruthy();
    expect(screen.getByText('proposal: E:\\ai-files\\Bobby\\.bobby\\proposals\\proposal-1.patch')).toBeTruthy();
    expect(screen.getByText('Ready to apply')).toBeTruthy();
    expect(screen.getByTestId('review-proposal-proposal-1')).toBeTruthy();
  });

  it('routes ready background proposals to the review/apply dock', async () => {
    const navigate = vi.fn();
    window.addEventListener('bobby:navigate', navigate);
    try {
      render(<Agents />);

      fireEvent.click(await screen.findByTestId('review-proposal-proposal-1'));

      expect(navigate).toHaveBeenCalledTimes(1);
      const event = navigate.mock.calls[0]?.[0] as CustomEvent<{ page: string; dockTab: string; proposalId: string }>;
      expect(event.detail).toEqual({
        page: 'chat',
        dockTab: 'review',
        proposalId: 'proposal-1'
      });
    } finally {
      window.removeEventListener('bobby:navigate', navigate);
    }
  });

  it('saves a new agent and dispatches it as a worktree-backed task', async () => {
    render(<Agents />);

    fireEvent.click(screen.getAllByRole('button', { name: 'New agent' })[0]);
    fireEvent.change(screen.getByTestId('agent-name-input'), { target: { value: 'Inspector' } });
    fireEvent.change(screen.getByTestId('agent-description-input'), { target: { value: 'Inspects files' } });
    fireEvent.change(screen.getByTestId('agent-system-prompt-input'), { target: { value: 'Inspect:\n{{input}}' } });
    fireEvent.change(screen.getByTestId('agent-task-input'), { target: { value: 'Review hello.txt' } });
    fireEvent.click(screen.getByText('Dispatch'));

    await vi.waitFor(() => {
      expect(window.bobby.upsertSubAgent).toHaveBeenCalledWith({
        sourcePath: undefined,
        name: 'Inspector',
        description: 'Inspects files',
        model: undefined,
        tools: [],
        triggers: [],
        systemPrompt: 'Inspect:\n{{input}}'
      });
      expect(window.bobby.dispatchSubAgent).toHaveBeenCalledWith({
        sourcePath: 'E:\\ai-files\\Bobby\\.bobby\\agents\\writer.md',
        task: 'Review hello.txt'
      });
    });
  });
});
