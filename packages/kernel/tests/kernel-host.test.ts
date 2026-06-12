import { expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { KernelEvent } from '@bobby/shared';

import { createSnapshot } from '../src/hands/snapshot';
import { KernelHost } from '../src/host/kernel-host';
import { MockModelClient } from '../src/model/mock-model-client';
import type { ModelClient } from '../src/model/model-client';

const contractJson = JSON.stringify({
  goal: 'Create a report file from the provided workspace input',
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

const createHost = (): { host: KernelHost; makeModel: ReturnType<typeof vi.fn>; createSnapshot: ReturnType<typeof vi.fn> } => {
  const makeModel = vi.fn(() =>
    new MockModelClient({
      grader: [contractJson, stepsJson],
      runner: [JSON.stringify({ calls: [{ tool: 'write_file', input: { path: 'a.txt', content: 'x' } }] })]
    })
  );
  const createSnapshot = vi.fn().mockResolvedValue({
    id: 'snap-task-step',
    createdAt: '2026-06-11T00:00:00.000Z',
    copied: [],
    skipped: []
  });

  return {
    host: new KernelHost(makeModel, undefined, process.cwd(), false, createSnapshot),
    makeModel,
    createSnapshot
  };
};

const createHostWithWorkspace = (workspaceRoot: string): NewHost => {
  const makeModel = vi.fn(() =>
    new MockModelClient({
      grader: [contractJson, stepsJson],
      runner: [JSON.stringify({ calls: [{ tool: 'write_file', input: { path: 'a.txt', content: 'x' } }] })]
    })
  );

  return {
    host: new KernelHost(makeModel, undefined, workspaceRoot),
    makeModel
  };
};

type NewHost = {
  host: KernelHost;
  makeModel: ReturnType<typeof vi.fn>;
};

type ResumeStatus = 'done' | 'failed' | 'blocked' | 'running';

function makeTempWorkspace(): string {
  return mkdtempSync(join(tmpdir(), 'bobby-kernel-host-'));
}

async function withTempWorkspace<T>(callback: (workspaceRoot: string) => Promise<T> | T): Promise<T> {
  const workspaceRoot = makeTempWorkspace();
  try {
    return await callback(workspaceRoot);
  } finally {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
}

function writeAgentFile(root: string, name: string, markdown: string): void {
  const agentsDir = join(root, '.bobby', 'agents');
  mkdirSync(agentsDir, { recursive: true });
  writeFileSync(join(agentsDir, `${name}.md`), markdown, 'utf8');
}

const revisedStepsJson = JSON.stringify([
  {
    id: 'S2',
    desc: 'Revised thing',
    satisfiesAcIds: ['AC1'],
    dependsOn: []
  }
]);

type ReplanObservation = {
  eventTypes: string[];
  planReadyCount: number;
  taskIds: string[];
  stepStarted: string[];
};

const withReplanObservation = (host: KernelHost): ReplanObservation => {
  const observation: ReplanObservation = {
    eventTypes: [],
    planReadyCount: 0,
    taskIds: [],
    stepStarted: []
  };

  host.subscribe((event) => {
    observation.eventTypes.push(event.type);
    if (event.type !== 'plan_ready' && event.type !== 'step_started') {
      return;
    }

    if (event.type === 'plan_ready') {
      observation.planReadyCount += 1;
      observation.taskIds.push(event.taskId);

      if (observation.planReadyCount === 1) {
        void host.send({
          type: 'planDecision',
          taskId: event.taskId,
          decision: 'edit',
          instructions: 'add an extra guard step'
        });
        return;
      }

      void host.send({
        taskId: event.taskId,
        type: 'planDecision',
        decision: 'approve'
      });
      return;
    }

    observation.stepStarted.push(event.stepId);
  });

  return observation;
};

const expectReplannedExecution = (
  observation: ReplanObservation,
  makeModel: ReturnType<typeof vi.fn>
): void => {
  expect(observation.planReadyCount).toBe(2);
  expect(observation.taskIds.every((taskId) => taskId === observation.taskIds[0])).toBe(true);
  expect(observation.eventTypes).toContain('final_result');
  expect(observation.stepStarted).toEqual(['S2']);
  expect(observation.eventTypes).toEqual([
    'intent_proposed',
    'plan_ready',
    'plan_ready',
    'step_started',
    'final_result'
  ]);
  expect(makeModel).toHaveBeenCalledTimes(1);

  const model = makeModel.mock.results[0]?.value as MockModelClient;
  expect(model.calls.map((entry) => entry.role)).toEqual(['grader', 'grader', 'grader', 'runner']);
};

const createHostWithHostResponses = (graderResponses: string[], runnerResponses: string[]): {
  host: KernelHost;
  makeModel: ReturnType<typeof vi.fn>;
} => {
  const makeModel = vi.fn(() => new MockModelClient({ grader: graderResponses, runner: runnerResponses }));

  return {
    host: new KernelHost(makeModel),
    makeModel
  };
};

const createPersistentMockHost = (workspaceRoot: string): KernelHost =>
  new KernelHost(
    () =>
      new MockModelClient({
        grader: [contractJson, stepsJson],
        runner: [JSON.stringify({ calls: [{ tool: 'write_file', input: { path: 'a.txt', content: 'x' } }] })]
      }),
    undefined,
    workspaceRoot,
    true
  );

const runApprovedTask = async (host: KernelHost): Promise<{ taskId: string; status: ResumeStatus }> => {
  let taskId = '';
  let status: ResumeStatus = 'running';

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
      status = event.status;
    }
  });

  await host.send({ type: 'startTask', input: 'run this task' });
  return { taskId, status };
};

const readResumeSummary = async (host: KernelHost): Promise<string> => {
  let summary = '';
  host.subscribe((event) => {
    if (event.type === 'direct_answer') {
      summary += event.text;
    }
  });

  await host.send({ type: 'resumeSession' });
  return summary;
};

const autoApproveOnPlan = async (host: KernelHost, event: { type: string; taskId?: string }): Promise<void> => {
  if (event.type === 'plan_ready' && event.taskId) {
    await host.send({
      type: 'planDecision',
      taskId: event.taskId,
      decision: 'approve'
    });
  }
};

const expectMakeModelCalled = async (input: string, expected: number): Promise<{ makeModel: ReturnType<typeof vi.fn>; events: string[] }> => {
  const { host, makeModel } = createHost();
  const events: string[] = [];

  host.subscribe((event) => {
    events.push(event.type);
    void autoApproveOnPlan(host, event);
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
    if (event.type === 'plan_ready') {
      void host.send({
        type: 'planDecision',
        taskId: event.taskId,
        decision: 'approve'
      });
    }
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

it('KernelHost: answers UNCLEAR directly and does not create model', async () => {
  const { host, makeModel } = createHost();
  const events: string[] = [];

  host.subscribe((event) => {
    events.push(event.type);
  });

  await host.send({ type: 'startTask', input: 'a' });

  expect(makeModel).toHaveBeenCalledTimes(0);
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

it('KernelHost: creates a checkpoint snapshot for each started step', async () => {
  const { host, createSnapshot } = createHost();

  host.subscribe((event) => {
    if (event.type === 'plan_ready') {
      void host.send({
        type: 'planDecision',
        taskId: event.taskId,
        decision: 'approve'
      });
    }
  });

  await host.send({ type: 'startTask', input: 'run this task' });

  expect(createSnapshot).toHaveBeenCalledTimes(1);
  expect(createSnapshot).toHaveBeenCalledWith(
    process.cwd(),
    expect.objectContaining({
      taskId: expect.any(String),
      stepId: 'S1'
    })
  );
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

it('KernelHost: reuses an always-approved reason across the same KernelHost session', async () => {
  const { host } = createHost();
  const events: Array<{ gateId: string; reason: string }> = [];

  host.subscribe((event) => {
    if (event.type === 'gate_request') {
      events.push(event);
    }
  });

  const firstGateDecision = host.requestGate('task-1', 'gate-1', 'Need network');

  await host.send({
    type: 'approveGate',
    gateId: 'gate-1',
    decision: 'always'
  });

  await expect(firstGateDecision).resolves.toBe('always');
  expect(events).toMatchObject([
    {
      gateId: 'gate-1',
      reason: 'Need network'
    }
  ]);
  expect(events).toHaveLength(1);

  const secondGateDecision = host.requestGate('task-1', 'gate-2', 'Need network');
  await expect(secondGateDecision).resolves.toBe('always');
  expect(events).toHaveLength(1);
});

it('KernelHost: does not persist allow decisions for subsequent same-reason gates', async () => {
  const { host } = createHost();
  const events: Array<{ gateId: string; reason: string }> = [];

  host.subscribe((event) => {
    if (event.type === 'gate_request') {
      events.push(event);
    }
  });

  const firstGateDecision = host.requestGate('task-1', 'gate-1', 'Need network');

  await host.send({
    type: 'approveGate',
    gateId: 'gate-1',
    decision: 'allow'
  });

  await expect(firstGateDecision).resolves.toBe('allow');

  host.requestGate('task-1', 'gate-2', 'Need network');
  expect(events).toHaveLength(2);
});

it('KernelHost: does not persist deny decisions for subsequent same-reason gates', async () => {
  const { host } = createHost();
  const events: Array<{ gateId: string; reason: string }> = [];

  host.subscribe((event) => {
    if (event.type === 'gate_request') {
      events.push(event);
    }
  });

  const firstGateDecision = host.requestGate('task-1', 'gate-1', 'Need network');

  await host.send({
    type: 'approveGate',
    gateId: 'gate-1',
    decision: 'deny'
  });

  await expect(firstGateDecision).resolves.toBe('deny');

  host.requestGate('task-1', 'gate-2', 'Need network');
  expect(events).toHaveLength(2);
});

it('KernelHost: blocks task execution when plan is rejected via planDecision', async () => {
  const { host } = createHost();
  const eventTypes: string[] = [];
  let taskId = '';

  host.subscribe((event) => {
    eventTypes.push(event.type);
    if (event.type === 'plan_ready') {
      taskId = event.taskId;
      void host.send({
        type: 'planDecision',
        taskId: event.taskId,
        decision: 'reject'
      });
    }
  });

  await host.send({ type: 'startTask', input: 'run this task' });

  expect(eventTypes).toContain('plan_ready');
  expect(eventTypes).toContain('final_result');
  expect(eventTypes).not.toContain('step_started');
  expect(taskId).toMatch(/^task-/);
  expect(taskId).not.toBe('');
});

it('KernelHost: replans on edit planDecision and executes revised plan only', async () => {
  const { host, makeModel } = createHostWithHostResponses(
    [contractJson, stepsJson, revisedStepsJson],
    [JSON.stringify({ calls: [{ tool: 'write_file', input: { path: 'a.txt', content: 'x' } }] })]
  );
  const observation = withReplanObservation(host);

  await host.send({ type: 'startTask', input: 'run this task' });
  expectReplannedExecution(observation, makeModel);
});

it('KernelHost: resolves a pending plan gate on abort and emits blocked final_result', async () => {
  const { host } = createHost();
  const eventTypes: string[] = [];
  let taskId = '';
  let finalStatus: 'done' | 'failed' | 'blocked' | undefined;

  host.subscribe((event) => {
    eventTypes.push(event.type);
    if (event.type === 'plan_ready' && event.taskId) {
      taskId = event.taskId;
      void host.send({
        type: 'abort',
        taskId: event.taskId
      });
    }

    if (event.type === 'final_result') {
      finalStatus = event.status;
    }
  });

  await expect(host.send({ type: 'startTask', input: 'run this task' })).resolves.toBeUndefined();

  expect(taskId).toMatch(/^task-/);
  expect(taskId).not.toBe('');
  expect(eventTypes).toContain('plan_ready');
  expect(eventTypes).toContain('final_result');
  expect(eventTypes).not.toContain('step_started');
  expect(finalStatus).toBe('blocked');

  const finalResult = eventTypes.filter((eventType) => eventType === 'final_result');
  expect(finalResult).toHaveLength(1);
  expect(finalResult).toContain('final_result');
});

it('KernelHost: uses renderer-assigned task ids for startTask events', async () => {
  const { host } = createHost();
  const taskIds: string[] = [];

  host.subscribe((event) => {
    if ('taskId' in event) {
      taskIds.push(event.taskId);
    }
    if (event.type === 'plan_ready') {
      void host.send({
        type: 'planDecision',
        taskId: event.taskId,
        decision: 'approve'
      });
    }
  });

  await host.send({ type: 'startTask', input: 'run this task', taskId: 'task-renderer-1' });

  expect(taskIds.length).toBeGreaterThan(0);
  expect(new Set(taskIds)).toEqual(new Set(['task-renderer-1']));
});

it('KernelHost: unsubscribe should stop receiving events', async () => {
  const { host } = createHost();
  const eventTypes: string[] = [];

  const unsubscribe = host.subscribe((event) => {
    eventTypes.push(event.type);
    if (event.type === 'plan_ready') {
      void host.send({
        type: 'planDecision',
        taskId: event.taskId,
        decision: 'approve'
      });
    }
  });

  await host.send({ type: 'startTask', input: 'run this task' });
  const count = eventTypes.length;

  unsubscribe();
  await host.send({ type: 'startTask', input: 'a' });

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

it('KernelHost: lists agent definitions when descriptors exist', async () => {
  await withTempWorkspace(async (workspaceRoot) => {
    writeAgentFile(
      workspaceRoot,
      'builder',
      [
        '---',
        'name: Builder',
        'description: Creates files',
        'tools: [write_file]',
        'triggers: [build]',
        'systemPrompt: You are a builder.',
        '---',
        'Fallback body'
      ].join('\n')
    );

    const { host } = createHostWithWorkspace(workspaceRoot);
    const eventTypes: string[] = [];
    let answer = '';

    host.subscribe((event) => {
      eventTypes.push(event.type);
      if (event.type === 'direct_answer') {
        answer += event.text;
      }
      if (event.type === 'error') {
        answer += event.message;
      }
    });

    await host.send({ type: 'listAgents' });
    expect(eventTypes).toContain('direct_answer');
    expect(answer).toContain('agents: found 1');
    expect(answer).toContain('Builder');
    expect(answer).not.toContain('diagnostic');
  });
});

it('KernelHost: emits diagnostics for invalid agent descriptor', async () => {
  await withTempWorkspace(async (workspaceRoot) => {
    writeAgentFile(
      workspaceRoot,
      'good',
      ['---', 'name: Good', 'description: valid', '---', 'ok'].join('\n')
    );
    writeAgentFile(
      workspaceRoot,
      'bad',
      ['---', 'description: missing name', '---', 'bad body'].join('\n')
    );

    const { host } = createHostWithWorkspace(workspaceRoot);
    let answer = '';
    const eventTypes: string[] = [];

    host.subscribe((event) => {
      eventTypes.push(event.type);
      if (event.type === 'direct_answer') {
        answer += event.text;
      }
      if (event.type === 'error') {
        answer += event.message;
      }
    });

    await host.send({ type: 'listAgents' });

    expect(eventTypes).toContain('direct_answer');
    expect(answer).toContain('diagnostic');
    expect(answer).toContain('Missing required field "name"');
    expect(answer).toContain('Good');
  });
});

it('KernelHost: reports empty state for listAgents when there are no descriptors', async () => {
  await withTempWorkspace(async (workspaceRoot) => {
    const { host } = createHostWithWorkspace(workspaceRoot);
    let answer = '';

    host.subscribe((event) => {
      if (event.type === 'direct_answer') {
        answer += event.text;
      }
    });

    await host.send({ type: 'listAgents' });
    expect(answer).toContain('agents: no agents');
  });
});

it('KernelHost: restores latest snapshot when undo is called without snapshotId', async () => {
  await withTempWorkspace(async (workspaceRoot) => {
    const source = join(workspaceRoot, 'notes.txt');
    writeFileSync(source, 'before', 'utf8');
    const snapshot = await createSnapshot(workspaceRoot);
    writeFileSync(source, 'after', 'utf8');

    const { host } = createHostWithWorkspace(workspaceRoot);
    let answer = '';
    const events: string[] = [];

    host.subscribe((event) => {
      events.push(event.type);
      if (event.type === 'direct_answer') {
        answer += event.text;
      }
      if (event.type === 'error') {
        answer += event.message;
      }
    });

    await host.send({ type: 'restoreSnapshot' });

    expect(events).toContain('direct_answer');
    expect(events).not.toContain('error');
    expect(answer).toContain(`undo: restored snapshot ${snapshot.id}`);
    expect(answer).toContain('files=1');
    expect(readFileSync(source, 'utf8')).toBe('before');
  });
});

it('KernelHost: reports empty state for undo when there are no snapshots', async () => {
  await withTempWorkspace(async (workspaceRoot) => {
    const { host } = createHostWithWorkspace(workspaceRoot);
    let answer = '';

    host.subscribe((event) => {
      if (event.type === 'direct_answer') {
        answer += event.text;
      }
    });

    await host.send({ type: 'restoreSnapshot' });
    expect(answer).toContain('undo: no snapshots available');
  });
});

it('KernelHost: reports restoreSnapshot errors as error', async () => {
  await withTempWorkspace(async (workspaceRoot) => {
    const { host } = createHostWithWorkspace(workspaceRoot);
    const eventTypes: string[] = [];

    host.subscribe((event) => {
      eventTypes.push(event.type);
    });

    await expect(host.send({ type: 'restoreSnapshot', snapshotId: '../bad-id' })).resolves.toBeUndefined();
    expect(eventTypes).toContain('error');
  });
});

it('KernelHost: summarizes latest trace when resume is requested in same process', async () => {
  await withTempWorkspace(async (workspaceRoot) => {
    const { host } = createHostWithWorkspace(workspaceRoot);
    const eventTypes: string[] = [];
    let completedTaskId = '';
    let summary = '';

    host.subscribe((event) => {
      eventTypes.push(event.type);
      if (event.type === 'plan_ready') {
        void host.send({
          type: 'planDecision',
          taskId: event.taskId,
          decision: 'approve'
        });
      }

      if (event.type === 'final_result') {
        completedTaskId = event.taskId;
      }

      if (event.type === 'direct_answer') {
        summary += event.text;
      }
    });

    await host.send({ type: 'startTask', input: 'run this task' });
    await host.send({ type: 'resumeSession' });

    expect(completedTaskId).toMatch(/^task-/);
    expect(eventTypes).toContain('direct_answer');
    expect(summary).toContain(`resume: task=${completedTaskId}`);
    expect(summary).toMatch(/status=(done|running|failed|blocked)/);
  });
});

it('KernelHost: resumes latest persisted trace when resume is requested from a fresh host', async () => {
  await withTempWorkspace(async (workspaceRoot) => {
    const completed = await runApprovedTask(createPersistentMockHost(workspaceRoot));
    const { host: hostB } = createHostWithWorkspace(workspaceRoot);
    const summary = await readResumeSummary(hostB);

    expect(completed.taskId).toMatch(/^task-/);
    expect(summary).toContain(`resume: task=${completed.taskId}`);
    expect(summary).toContain(`status=${completed.status}`);
    expect(summary).toMatch(/events=\d+/);
  });
});

it('KernelHost: plan-only mode emits a plan without executing steps', async () => {
  await withTempWorkspace(async (workspaceRoot) => {
    const { host } = createHostWithWorkspace(workspaceRoot);
    const events: string[] = [];

    host.subscribe((event) => {
      events.push(event.type);
    });

    await host.send({ type: 'startTask', input: 'run this task', mode: 'plan-only' } as Parameters<KernelHost['send']>[0]);

    expect(events).toEqual(['intent_proposed', 'plan_ready', 'final_result']);
    expect(events).not.toContain('step_started');
    expect(events).not.toContain('tool_called');
  });
});

it('KernelHost: persists traces when persistence is explicitly enabled for the current workspace', async () => {
  await withTempWorkspace(async (workspaceRoot) => {
    const previousCwd = process.cwd();
    process.chdir(workspaceRoot);
    try {
      const completed = await runApprovedTask(createPersistentMockHost(process.cwd()));
      const summary = await readResumeSummary(createPersistentMockHost(process.cwd()));

      expect(completed.taskId).toMatch(/^task-/);
      expect(summary).toContain(`resume: task=${completed.taskId}`);
    } finally {
      process.chdir(previousCwd);
    }
  });
});

it('KernelHost: reports no resumable trace when resume is requested too early', async () => {
  await withTempWorkspace(async (workspaceRoot) => {
    const { host } = createHostWithWorkspace(workspaceRoot);
    let answer = '';

    host.subscribe((event) => {
      if (event.type === 'direct_answer') {
        answer += event.text;
      }
    });

    await host.send({ type: 'resumeSession' });
    expect(answer).toContain('resume: no resumable trace in current process');
  });
});
