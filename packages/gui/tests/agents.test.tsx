import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Agents } from '../src/screens/Agents';

beforeEach(() => {
  (window as any).bobby = {
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
  });
});
