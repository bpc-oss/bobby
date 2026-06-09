import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TraceStore } from '../src/trace/trace-store';

function makeTempWorkspace(): string {
  return mkdtempSync(join(tmpdir(), 'bobby-trace-store-'));
}

describe('TraceStore', () => {
  it('appends by task and returns a frozen copy', () => {
    const traceStore = new TraceStore();
    traceStore.append('t1', { type: 'step_started', taskId: 't1', stepId: 'S1' });
    traceStore.append('t1', { type: 'final_result', taskId: 't1', status: 'failed' });

    const trace = traceStore.get('t1');

    expect(trace.map((event) => event.type)).toEqual(['step_started', 'final_result']);
    expect(Object.isFrozen(trace)).toBe(true);
  });
});

describe('TraceStore persistence', () => {
  it('writes trace events to disk when persistence is enabled', () => {
    const workspaceRoot = makeTempWorkspace();
    try {
      const traceStore = new TraceStore({ workspaceRoot, persistence: true });
      traceStore.append('task-1', { type: 'step_started', taskId: 'task-1', stepId: 'S1' });
      traceStore.append('task-1', { type: 'final_result', taskId: 'task-1', status: 'done' });

      const summary = traceStore.getLatestSummary();
      expect(summary).toEqual({
        taskId: 'task-1',
        events: 2,
        status: 'done'
      });
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('does not let system events replace the latest persisted task summary', () => {
    const workspaceRoot = makeTempWorkspace();
    try {
      const traceStore = new TraceStore({ workspaceRoot, persistence: true });
      traceStore.append('task-1', { type: 'step_started', taskId: 'task-1', stepId: 'S1' });
      traceStore.append('task-1', { type: 'final_result', taskId: 'task-1', status: 'done' });
      traceStore.append('system', { type: 'direct_answer', taskId: 'system', text: 'resume: task=task-1' });

      expect(traceStore.getLatestSummary()).toEqual({
        taskId: 'task-1',
        events: 2,
        status: 'done'
      });
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });
});

describe('TraceStore persisted summaries', () => {
  it('ignores legacy system trace files when reading persisted summaries', () => {
    const workspaceRoot = makeTempWorkspace();
    try {
      const tracesDir = join(workspaceRoot, '.bobby', 'traces');
      mkdirSync(tracesDir, { recursive: true });
      writeFileSync(
        join(tracesDir, 'system.jsonl'),
        `${JSON.stringify({ taskId: 'system', type: 'direct_answer', status: 'running' })}\n`,
        'utf8'
      );

      const traceStore = new TraceStore({ workspaceRoot, persistence: true });
      expect(traceStore.getLatestSummary()).toBeNull();
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('returns null when no persisted summary exists', () => {
    const workspaceRoot = makeTempWorkspace();
    try {
      const traceStore = new TraceStore({ workspaceRoot, persistence: true });
      expect(traceStore.getLatestSummary()).toBeNull();
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });
});
