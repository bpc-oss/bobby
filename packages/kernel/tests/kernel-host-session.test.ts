import { expect, it } from 'vitest';
import type { KernelEvent } from '@bobby/shared';

import { KernelHost } from '../src/host/kernel-host';
import { MockModelClient } from '../src/model/mock-model-client';

const contractJson = JSON.stringify({
  goal: 'test goal',
  acceptanceCriteria: [{ id: 'AC1', desc: 'must run', oracleHint: 'test' }],
  constraints: [],
  inputs: ['workspace'],
  outOfScope: []
});

const stepsJson = JSON.stringify([
  {
    id: 'S1',
    desc: 'Do one thing',
    satisfiesAcIds: ['AC1'],
    dependsOn: []
  }
]);

const makeHost = (): KernelHost =>
  new KernelHost(
    () =>
      new MockModelClient({
        grader: [contractJson, stepsJson],
        runner: [JSON.stringify({ calls: [{ tool: 'write_file', input: { path: 'a.txt', content: 'x' } }] })]
      })
  );

it('KernelHost: tracks task trace for startTask and returns immutable views', async () => {
  const host = makeHost();
  let taskId = '';

  host.subscribe((event) => {
    if (event.type === 'plan_ready') {
      void host.send({
        type: 'planDecision',
        taskId: event.taskId,
        decision: 'approve'
      });
    }

    if (event.type === 'final_result') {
      taskId = event.taskId;
    }
  });

  await host.send({ type: 'startTask', input: 'run this task' });

  const trace = host.getTrace(taskId);
  expect(trace.map((event) => event.type)).toContain('intent_proposed');
  expect(trace.map((event) => event.type)).toContain('final_result');
  expect(trace.at(-1)).toMatchObject({ type: 'final_result', taskId });
  expect(Object.isFrozen(trace)).toBe(true);

  const mutated = trace as KernelEvent[];
  expect(() => {
    mutated.push({ type: 'step_started', taskId, stepId: 'S1' });
  }).toThrow();
  expect(host.getTrace(taskId)).toHaveLength(trace.length);
});

it('KernelHost: getTrace command passes zod and hits handler', async () => {
  const host = makeHost();
  await expect(host.send({ type: 'getTrace', taskId: 'task-1' })).resolves.toBeUndefined();
});

it('KernelHost: stores answer per task for later inspection', async () => {
  const host = makeHost();
  await host.send({ type: 'answer', taskId: 'task-1', reply: 'ok' });
  expect(host.getAnswers('task-1')).toEqual(['ok']);
});

it('KernelHost: marks task as aborted after abort command', async () => {
  const host = makeHost();
  await host.send({ type: 'abort', taskId: 'task-1' });
  expect(host.isAborted('task-1')).toBe(true);
});
