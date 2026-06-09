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

it('reduces intent/plan/step/final_result into clean output lines', () => {
  const vm = feedLifecycleEvents();

  expect(vm.status).toBe('done');
  expect(vm.goal).toBe('build cli');
  expect(vm.currentPlan).toHaveLength(1);
  expect(vm.activeSteps).toContain('S1');
  expect(vm.lines.some((line) => line.includes('Done.'))).toBe(true);
});

it('adds direct answer lines without debug prefix', () => {
  const vm = reduceEvent(initialVM(), {
    type: 'direct_answer',
    taskId: 'task-1',
    text: '你好，我在的'
  });

  expect(vm.lines.some((line) => line.includes('你好，我在的'))).toBe(true);
  expect(vm.lines.some((line) => line.startsWith('answer:'))).toBe(false);
});

it('keeps failed final_result status', () => {
  const vm = reduceEvent(initialVM(), {
    type: 'final_result',
    taskId: 'task-1',
    status: 'failed'
  });
  expect(vm.status).toBe('failed');
  expect(vm.lines.some((line) => line.includes('Failed.'))).toBe(true);
});

it('renders tool_called as structured items and errors without prefix', () => {
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

  expect(withTool.items.some((item) => item.kind === 'tool')).toBe(true);
  expect(withError.lines.some((line) => line.includes('boom'))).toBe(true);
});

it('clears pendingGate after step_started', () => {
  const withGate = reduceEvent(
    {
      ...initialVM(),
      pendingGate: {
        gateId: 'g1',
        reason: 'requires external permission'
      }
    },
    {
      type: 'gate_request',
      taskId: 'task-1',
      gateId: 'g1',
      reason: 'requires external permission'
    }
  );

  const vm = reduceEvent(withGate, {
    type: 'step_started',
    taskId: 'task-1',
    stepId: 'S1'
  });

  expect(vm.pendingGate).toBeUndefined();
});

it('clears pendingGate after final_result', () => {
  const vm = reduceEvent(
    {
      ...initialVM(),
      pendingGate: {
        gateId: 'g2',
        reason: 'requires external permission'
      }
    },
    {
      type: 'final_result',
      taskId: 'task-1',
      status: 'done'
    }
  );

  expect(vm.pendingGate).toBeUndefined();
  expect(vm.lines.some((line) => line.includes('Done.'))).toBe(true);
});

it('clears pendingGate after error', () => {
  const vm = reduceEvent(
    {
      ...initialVM(),
      pendingGate: {
        gateId: 'g3',
        reason: 'requires external permission'
      }
    },
    {
      type: 'error',
      taskId: 'task-1',
      message: 'boom'
    }
  );

  expect(vm.pendingGate).toBeUndefined();
  expect(vm.lines.some((line) => line.includes('boom'))).toBe(true);
});

it('tracks evidence as structured items, shows only non-pass verdicts', () => {
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

  const withPassVerdict = reduceEvent(withEvidence, {
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

  const withFailVerdict = reduceEvent(withEvidence, {
    type: 'verdict',
    taskId: 'task-1',
    verdict: {
      claimId: 'C2',
      acId: 'AC-2',
      oracleTier: 'T1',
      result: 'fail',
      detail: 'mismatch'
    }
  });

  expect(withEvidence.items.some((item) => item.kind === 'evidence')).toBe(true);
  expect(withPassVerdict.lines.some((line) => line.includes('verdict'))).toBe(false);
  expect(withFailVerdict.lines.some((line) => line.includes('AC-2: fail'))).toBe(true);
});

it('accumulates assistant deltas by sequence order within a task', () => {
  const vm = reduceEvent(
    reduceEvent(initialVM(), {
      type: 'assistant_delta',
      taskId: 'task-1',
      content: 'world',
      sequence: 2
    }),
    {
      type: 'assistant_delta',
      taskId: 'task-1',
      content: 'hello ',
      sequence: 1
    }
  );

  expect(vm.lines.at(-1)).toBe('hello world');
  expect(vm.lines.some((line) => line.includes('hello world'))).toBe(true);
  expect(vm.streamingMode).toBe('sse');
});

it('switches streamingMode to sse when usage_delta arrives', () => {
  const vm = reduceEvent(initialVM(), {
    type: 'usage_delta',
    taskId: 'task-1',
    model: 'deepseek-v3',
    promptTokens: 12,
    completionTokens: 4,
    cachedTokens: 2,
    costUsd: 0.0034
  });

  expect(vm.streamingMode).toBe('sse');
});

it('switches streamingMode to sse for all delta event kinds', () => {
  const bySequence = [
    reduceEvent(initialVM(), {
      type: 'assistant_delta',
      taskId: 'task-1',
      content: 'hello',
      sequence: 0
    }),
    reduceEvent(initialVM(), {
      type: 'reasoning_delta',
      taskId: 'task-1',
      content: 'thinking',
      sequence: 0
    }),
    reduceEvent(initialVM(), {
      type: 'tool_delta',
      taskId: 'task-1',
      status: 'start',
      sequence: 0
    }),
    reduceEvent(initialVM(), {
      type: 'usage_delta',
      taskId: 'task-1',
      promptTokens: 1
    })
  ];

  bySequence.forEach((vm) => {
    expect(vm.streamingMode).toBe('sse');
  });
});

it('accumulates tool deltas without debug prefix', () => {
  const vm = reduceEvent(
    initialVM(),
    {
      type: 'tool_delta',
      taskId: 'task-1',
      status: 'start',
      tool: 'bash',
      sequence: 1,
      content: 'init'
    }
  );
  const withChunk = reduceEvent(vm, {
    type: 'tool_delta',
    taskId: 'task-1',
    status: 'chunk',
    sequence: 0,
    content: 'stderr'
  });

  expect(withChunk.lines.some((line) => line.includes('start bash init'))).toBe(true);
  expect(withChunk.lines.some((line) => line.includes('chunk stderr'))).toBe(true);
  expect(withChunk.lines.some((line) => line.startsWith('[tool]'))).toBe(false);
});

it('updates usage fields from usage_delta', () => {
  const vm = reduceEvent(initialVM(), {
    type: 'usage_delta',
    taskId: 'task-1',
    model: 'deepseek-v3',
    promptTokens: 12,
    completionTokens: 4,
    cachedTokens: 2,
    costUsd: 0.0034
  });

  expect(vm.usageModel).toBe('deepseek-v3');
  expect(vm.promptTokens).toBe(12);
  expect(vm.completionTokens).toBe(4);
  expect(vm.cachedTokens).toBe(2);
  expect(vm.costUsd).toBe(0.0034);
});
