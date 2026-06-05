import { expect, it } from 'vitest';

import { initialVM, reduceEvent } from '../src/ui/view-model';

function feedLifecycleEvents(vmInput = initialVM()) {
  const vm1 = reduceEvent(vmInput, {
    type: 'intent_proposed',
    taskId: 'task-1',
    contract: {
      goal: 'build cli',
      acceptanceCriteria: [{ id: 'ac-1', desc: 'create file', oracleHint: 'run' }],
      constraints: [],
      inputs: [],
      outOfScope: []
    }
  });

  const vm2 = reduceEvent(vm1, {
    type: 'plan_ready',
    taskId: 'task-1',
    steps: [{ id: 'S1', desc: 'do work', satisfiesAcIds: ['ac-1'], dependsOn: [] }]
  });

  const vm3 = reduceEvent(vm2, { type: 'step_started', taskId: 'task-1', stepId: 'S1' });
  return reduceEvent(vm3, { type: 'final_result', taskId: 'task-1', status: 'done' });
}

it('reduces intent/plan/step/final_result into rendered output lines', () => {
  const vm = feedLifecycleEvents();

  expect(vm.status).toBe('done');
  expect(vm.streamingMode).toBe('event');
  expect(vm.lines.some((line) => line.includes('goal: build cli'))).toBe(true);
  expect(vm.lines.some((line) => line.includes('plan:'))).toBe(true);
  expect(vm.lines.some((line) => line.includes('step: S1'))).toBe(true);
  expect(vm.lines.some((line) => line.includes('status: done'))).toBe(true);
});

it('adds direct answer lines for direct_answer events', () => {
  const vm = reduceEvent(initialVM(), {
    type: 'direct_answer',
    taskId: 'task-1',
    text: '你好，我在的'
  });

  expect(vm.lines.some((line) => line.includes('answer: 你好，我在的'))).toBe(true);
});

it('keeps failed final_result status', () => {
  const vm = reduceEvent(initialVM(), {
    type: 'final_result',
    taskId: 'task-1',
    status: 'failed'
  });
  expect(vm.status).toBe('failed');
  expect(vm.lines.some((line) => line.includes('status: failed'))).toBe(true);
});

it('renders tool_called and error lines with ASCII labels', () => {
  const withTool = reduceEvent(initialVM(), {
    type: 'tool_called',
    taskId: 'task-1',
    stepId: 'S1',
    tool: 'cmd /c echo ok'
  });
  const withError = reduceEvent(withTool, {
    type: 'error',
    taskId: 'task-1',
    message: 'boom'
  });

  expect(withTool.lines.some((line) => line.includes('tool: cmd /c echo ok'))).toBe(true);
  expect(withError.lines.some((line) => line.includes('error: boom'))).toBe(true);
});

it('tracks evidence and verdict lines', () => {
  const withEvidence = reduceEvent(initialVM(), {
    type: 'evidence_produced',
    taskId: 'task-1',
    evidence: {
      claimId: 'C1',
      acId: 'AC-1',
      evidenceType: 'file_diff',
      payload: { ok: true },
      producedBy: 'tool'
    }
  });

  const withVerdict = reduceEvent(withEvidence, {
    type: 'verdict',
    taskId: 'task-1',
    verdict: {
      claimId: 'C1',
      acId: 'AC-1',
      oracleTier: 'T1',
      result: 'pass',
      detail: 'ok'
    }
  });

  expect(withEvidence.lines.some((line) => line.includes('evidence: AC-1/file_diff'))).toBe(true);
  expect(withVerdict.lines.some((line) => line.includes('verdict: AC-1/pass'))).toBe(true);
});
