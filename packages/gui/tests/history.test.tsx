import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { History } from '../src/screens/History';
import type { TaskDetail, TaskSummary } from '../src/ipc/contract';

const summary: TaskSummary = {
  taskId: 'task-1',
  userGoal: 'Create hello.txt',
  state: 'done',
  taskType: 'task',
  createdAt: '2026-06-11T00:00:00.000Z',
  updatedAt: '2026-06-11T00:01:00.000Z',
  traceCount: 3,
  hasContract: true,
  hasPlan: true,
  hasReport: true
};

const detail: TaskDetail = {
  summary,
  contract: null,
  plan: [{ id: 'S1', desc: 'Write the file', satisfiesAcIds: ['AC1'], dependsOn: [] }],
  report: 'Task completed after verification.',
  sessionIds: ['session-1'],
  trace: [
    { type: 'tool_called', taskId: 'task-1', stepId: 'S1', tool: 'write_file hello.txt' },
    {
      type: 'evidence_produced',
      taskId: 'task-1',
      evidence: {
        claimId: 'C1',
        acId: 'AC1',
        evidenceType: 'file_exists',
        payload: { path: 'hello.txt', exists: true },
        producedBy: 'tool'
      }
    },
    { type: 'final_result', taskId: 'task-1', status: 'done' }
  ]
};

beforeEach(() => {
  (window as any).bobby = {
    listTasks: vi.fn().mockResolvedValue([summary]),
    readTask: vi.fn().mockResolvedValue(detail)
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (window as any).bobby;
});

describe('History replay', () => {
  it('renders tool calls, evidence, and final status as inspectable replay rows', async () => {
    render(<History />);

    expect(await screen.findAllByText('Create hello.txt')).toHaveLength(2);
    await waitFor(() => expect(screen.getByText('write_file hello.txt')).toBeTruthy());
    expect(screen.getByText('AC1 / file_exists')).toBeTruthy();
    expect(screen.getByText(/path: hello.txt/)).toBeTruthy();
    expect(screen.getByText('Final status: done')).toBeTruthy();
  });

  it('offers a continue action for the selected task session', async () => {
    const onResumeTask = vi.fn();
    render(<History onResumeTask={onResumeTask} />);

    await screen.findAllByText('Create hello.txt');
    await waitFor(() => expect(screen.getByTestId('history-continue')).toBeTruthy());
    screen.getByTestId('history-continue').click();

    expect(onResumeTask).toHaveBeenCalledWith('session-1');
  });
});
