import { expect, it, vi } from 'vitest';
import type { KernelEvent } from '@bobby/shared';

import { KernelHost } from '../src/host/kernel-host';
import { MockModelClient } from '../src/model/mock-model-client';
import type { ModelClient } from '../src/model/model-client';

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

const createHost = (): { host: KernelHost; makeModel: ReturnType<typeof vi.fn> } => {
  const makeModel = vi.fn(() =>
    new MockModelClient({
      grader: [contractJson, stepsJson],
      runner: [JSON.stringify({ calls: [{ tool: 'write_file', input: { path: 'a.txt', content: 'x' } }] })]
    })
  );

  return {
    host: new KernelHost(makeModel),
    makeModel
  };
};

const expectMakeModelCalled = async (input: string, expected: number): Promise<{ makeModel: ReturnType<typeof vi.fn>; events: string[] }> => {
  const { host, makeModel } = createHost();
  const events: string[] = [];

  host.subscribe((event) => {
    events.push(event.type);
  });

  await host.send({ type: 'startTask', input });

  expect(makeModel).toHaveBeenCalledTimes(expected);
  return { makeModel, events };
};

it('KernelHost: subscribes to startTask event flow', async () => {
  const { host } = createHost();
  const eventTypes: string[] = [];

  host.subscribe((event) => {
    eventTypes.push(event.type);
  });

  await host.send({ type: 'startTask', input: 'run this task' });

  expect(eventTypes).toContain('intent_proposed');
  expect(eventTypes).toContain('final_result');
  expect(eventTypes[eventTypes.length - 1]).toBe('final_result');
});

it('KernelHost: answers greeting directly without plan/verify events', async () => {
  const { events } = await expectMakeModelCalled('你好', 0);

  expect(events).toContain('direct_answer');
  expect(events).not.toContain('plan_ready');
  expect(events).not.toContain('step_started');
  expect(events).not.toContain('verdict');
  expect(events).not.toContain('final_result');
});

it('KernelHost: answers QUESTION directly without plan/verify events', async () => {
  const { events } = await expectMakeModelCalled('?', 0);

  expect(events).toContain('direct_answer');
  expect(events).not.toContain('plan_ready');
  expect(events).not.toContain('step_started');
  expect(events).not.toContain('verdict');
  expect(events).not.toContain('final_result');
});

it('KernelHost: routes clear task intent to orchestrator flow', async () => {
  const { events } = await expectMakeModelCalled('帮我建 hello.txt', 1);

  expect(events).toContain('plan_ready');
  expect(events).toContain('final_result');
  expect(events[events.length - 1]).toBe('final_result');
  expect(events).not.toContain('direct_answer');
});

it('KernelHost: routes Chinese file create question intent to orchestrator flow', async () => {
  const { events } = await expectMakeModelCalled('你能帮我建 hello.txt 吗', 1);

  expect(events).toContain('plan_ready');
  expect(events).toContain('final_result');
  expect(events[events.length - 1]).toBe('final_result');
  expect(events).not.toContain('direct_answer');
});

it('KernelHost: routes file write question intent to orchestrator flow', async () => {
  const { events } = await expectMakeModelCalled('帮我写一个 README.md 可以吗', 1);

  expect(events).toContain('plan_ready');
  expect(events).toContain('final_result');
  expect(events[events.length - 1]).toBe('final_result');
  expect(events).not.toContain('direct_answer');
});

it('KernelHost: routes file update question intent to orchestrator flow', async () => {
  const { events } = await expectMakeModelCalled('把 README.md 改成英文吗', 1);

  expect(events).toContain('plan_ready');
  expect(events).toContain('final_result');
  expect(events[events.length - 1]).toBe('final_result');
  expect(events).not.toContain('direct_answer');
});

it('KernelHost: rejects invalid command payload through zod gate', async () => {
  const { host } = createHost();
  const invalidCmd = { type: 'nuke' } as unknown as Parameters<KernelHost['send']>[0];

  await expect(host.send(invalidCmd)).rejects.toThrow();
});

it('KernelHost: emits gate_request and resolves requestGate by approveGate', async () => {
  const { host } = createHost();
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
  const { host } = createHost();
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

it('KernelHost: surfaces orchestrator errors as error + failed final_result instead of crashing', async () => {
  const throwingModel: ModelClient = {
    complete: async () => {
      throw new Error('boom from model');
    }
  };
  const host = new KernelHost(() => throwingModel);
  const events: KernelEvent[] = [];
  host.subscribe((event) => {
    events.push(event);
  });

  // File-mutation phrasing routes deterministically to the orchestrator (TASK).
  await expect(host.send({ type: 'startTask', input: '帮我建 hello.txt' })).resolves.toBeUndefined();

  const types = events.map((event) => event.type);
  expect(types).toContain('error');

  const final = events.find(
    (event): event is Extract<KernelEvent, { type: 'final_result' }> => event.type === 'final_result'
  );
  expect(final?.status).toBe('failed');
});
