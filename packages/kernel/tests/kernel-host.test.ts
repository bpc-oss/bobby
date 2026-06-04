import { expect, it } from 'vitest';

import { KernelHost } from '../src/host/kernel-host';
import { MockModelClient } from '../src/model/mock-model-client';

const contractJson = JSON.stringify({
  goal: 'test goal',
  acceptanceCriteria: [{ id: 'AC1', desc: 'must run', oracleHint: 'test' }],
  constraints: [],
  inputs: [],
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

const makeHost = (): KernelHost => {
  return new KernelHost(
    () =>
      new MockModelClient({
        grader: [contractJson, stepsJson],
        runner: ['runner output']
      })
  );
};

it('KernelHost: subscribes to startTask event flow', async () => {
  const host = makeHost();
  const eventTypes: string[] = [];

  host.subscribe((event) => {
    eventTypes.push(event.type);
  });

  await host.send({ type: 'startTask', input: 'run this task' });

  expect(eventTypes).toContain('intent_proposed');
  expect(eventTypes).toContain('final_result');
  expect(eventTypes[eventTypes.length - 1]).toBe('final_result');
});

it('KernelHost: rejects invalid command payload through zod gate', async () => {
  const host = makeHost();
  const invalidCmd = { type: 'nuke' } as unknown as Parameters<KernelHost['send']>[0];

  await expect(host.send(invalidCmd)).rejects.toThrow();
});

it('KernelHost: emits gate_request and resolves requestGate by approveGate', async () => {
  const host = makeHost();
  const events: Array<{ gateId: string; reason: string }> = [];

  host.subscribe((event) => {
    if (event.type === 'gate_request') {
      events.push(event);
    }
  });

  const gateDecision = host.requestGate('task-1', 'gate-1', 'Need approval');

  await host.send({
    type: 'approveGate',
    gateId: 'gate-1',
    decision: 'allow'
  });

  await expect(gateDecision).resolves.toBe('allow');
  expect(events).toMatchObject([
    {
      gateId: 'gate-1',
      reason: 'Need approval'
    }
  ]);
});

it('KernelHost: unsubscribe should stop receiving events', async () => {
  const host = makeHost();
  const eventTypes: string[] = [];

  const unsubscribe = host.subscribe((event) => {
    eventTypes.push(event.type);
  });

  await host.send({ type: 'startTask', input: 'run this task' });
  const count = eventTypes.length;

  unsubscribe();
  await host.send({ type: 'startTask', input: 'run this task' });

  expect(eventTypes).toHaveLength(count);
});
