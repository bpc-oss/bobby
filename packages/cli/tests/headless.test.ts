import { expect, it, vi } from 'vitest';

import type { Evidence } from '@bobby/shared';
import {
  CommandExitOracle,
  CompletionGate,
  KernelHost,
  MockModelClient,
  VerificationEngine,
  type ModelClient
} from '@bobby/kernel';

import { runHeadless } from '../src/headless';

const contractJson = JSON.stringify({
  goal: 'Run the requested command and validate completion',
  acceptanceCriteria: [{ id: 'AC1', desc: 'run command', oracleHint: 'run' }],
  constraints: [],
  inputs: ['workspace'],
  outOfScope: []
});

const stepsJson = JSON.stringify([
  { id: 'S1', desc: 'Do work', satisfiesAcIds: ['AC1'], dependsOn: [] }
]);

const successRunnerOutput = JSON.stringify({
  calls: [
    {
      tool: 'exec',
      input: { cmd: 'node', args: ['-e', 'process.exit(0)'] }
    }
  ]
});

const makeHost = (options: {
  runnerOutput?: string;
  evidence?: Evidence[];
  engine?: VerificationEngine;
} = {}): KernelHost => {
  const model: ModelClient = new MockModelClient({
    grader: [contractJson, stepsJson],
    runner: [options.runnerOutput ?? successRunnerOutput]
  });

  const evidenceFor = (): Evidence[] =>
    options.evidence ??
    [
      {
        claimId: 'c1',
        acId: 'AC1',
        evidenceType: 'command_output',
        payload: { exitCode: 0 },
        producedBy: 'tool'
      }
    ];

  const engine = options.engine ?? new VerificationEngine([new CommandExitOracle()]);

  return new KernelHost(() => model, {
    engine,
    gate: new CompletionGate(),
    evidenceFor
  });
};

it('returns exitCode 0 when final_result status is done', async () => {
  const host = makeHost();
  const result = await runHeadless(host, 'do work');

  expect(result.status).toBe('done');
  expect(result.exitCode).toBe(0);
});

it('logs plan/step/evidence/final status lines from kernel events', async () => {
  const host = makeHost();
  const logs: string[] = [];

  const result = await runHeadless(host, 'do work', (msg) => {
    logs.push(msg);
  });

  const output = logs.join('\n');
  expect(result.status).toBe('done');
  expect(output).toContain('[plan] goal:');
  expect(output).toContain('[plan] steps: S1');
  expect(output).toContain('[step] started S1');
  expect(output).toContain('[evidence] type=command_output');
  expect(output).toContain('[status] done');
});

it('auto sends planDecision approve in headless mode', async () => {
  const logs: string[] = [];
  let eventListener: (event: unknown) => void = () => {};
  const send = vi.fn(async (cmd) => {
    if (cmd.type === 'startTask') {
      eventListener({
        type: 'intent_proposed',
        taskId: 'task-1',
        contract: {
          goal: 'do work',
          acceptanceCriteria: [],
          constraints: [],
          inputs: [],
          outOfScope: []
        }
      });
      eventListener({
        type: 'plan_ready',
        taskId: 'task-1',
        steps: [{ id: 'S1', desc: 'Do work', satisfiesAcIds: [], dependsOn: [] }]
      });
      eventListener({
        type: 'final_result',
        taskId: 'task-1',
        status: 'done'
      });
    }
  });
  const host = {
    subscribe: vi.fn().mockImplementation((fn: (event: unknown) => void) => {
      eventListener = fn;
      return () => undefined;
    }),
    send
  } as unknown as KernelHost;

  const result = await runHeadless(host, 'do work', (msg) => {
    logs.push(msg);
  });

  expect(result.status).toBe('done');
  expect(send).toHaveBeenCalledWith({ type: 'startTask', input: 'do work' });
  expect(send).toHaveBeenCalledWith({
    type: 'planDecision',
    taskId: 'task-1',
    decision: 'approve'
  });
  expect(logs.join('\n')).toContain('[status] done');
});

const emitStreamingHeadlessEvents = (listener: (event: unknown) => void): void => {
  listener({
    type: 'assistant_delta',
    taskId: 'task-1',
    content: 'draft',
    sequence: 1
  });
  listener({
    type: 'assistant_delta',
    taskId: 'task-1',
    content: 'ing',
    sequence: 2
  });
  listener({
    type: 'reasoning_delta',
    taskId: 'task-1',
    content: 'thinking',
    sequence: 3
  });
  listener({
    type: 'tool_delta',
    taskId: 'task-1',
    status: 'start',
    tool: 'exec',
    content: 'node --version'
  });
  listener({
    type: 'usage_delta',
    taskId: 'task-1',
    model: 'deepseek-v3',
    promptTokens: 10,
    completionTokens: 4,
    cachedTokens: 2,
    costUsd: 0.12
  });
  listener({ type: 'final_result', taskId: 'task-1', status: 'done' });
};

it('prints streaming events using stable text-only formats', async () => {
  const logs: string[] = [];
  let eventListener: (event: unknown) => void = () => {};

  const send = vi.fn(async (cmd) => {
    if (cmd.type === 'startTask') {
      emitStreamingHeadlessEvents(eventListener);
    }
  });

  const host = {
    subscribe: vi.fn().mockImplementation((fn: (event: unknown) => void) => {
      eventListener = fn;
      return () => undefined;
    }),
    send
  } as unknown as KernelHost;

  const result = await runHeadless(host, 'streaming input', (msg) => {
    logs.push(msg);
  });

  const output = logs.join('\n');
  expect(result.status).toBe('done');
  expect(output).toContain('draft');
  expect(output).toContain('ing');
  expect(output).toContain('[reasoning] thinking');
  expect(output).toContain('[tool] start exec node --version');
  expect(output).toContain('[usage] model=deepseek-v3 prompt=10 completion=4 cached=2 cost=$0.1200');
});

it('returns done when direct_answer is emitted without final_result', async () => {
  const logs: string[] = [];
  let subscriber: (event: unknown) => void = () => {};
  const unsubscribe = vi.fn();

  const host = {
    subscribe: vi.fn().mockImplementation((fn: (event: unknown) => void) => {
      subscriber = fn;
      return unsubscribe;
    }),
    send: vi.fn().mockResolvedValue(undefined)
  } as unknown as KernelHost;

  const run = runHeadless(host, 'hi', (msg) => {
    logs.push(msg);
  });

  subscriber({
    type: 'direct_answer',
    taskId: 'task-1',
    text: '你好，我在的'
  });

  const result = await run;

  const output = logs.join('\n');
  expect(result.status).toBe('done');
  expect(result.exitCode).toBe(0);
  expect(output).toContain('你好，我在的');
  expect(output).toContain('[status] done');
});

it('returns exitCode non-zero when final_result status is failed', async () => {
  const host = makeHost({
    evidence: [
      {
        claimId: 'c1',
        acId: 'AC1',
        evidenceType: 'command_output',
        payload: { exitCode: 1 },
        producedBy: 'tool'
      }
    ]
  });
  const result = await runHeadless(host, 'do work');

  expect(result.status).toBe('failed');
  expect(result.exitCode).toBe(1);
});

it('returns failed when no evidence is available', async () => {
  const host = makeHost({ evidence: [] });
  const result = await runHeadless(host, 'do work');

  expect(result.status).toBe('failed');
  expect(result.exitCode).toBe(1);
});

const makeNeedHumanHost = (): KernelHost => {
  const needHumanOracle = {
    tier: 'T4' as const,
    name: 'manual-review',
    canJudge: () => true,
    judge: async () => ({
      claimId: 'c1',
      acId: 'AC1',
      oracleTier: 'T4' as const,
      result: 'need_human' as const,
      detail: 'manual confirmation needed'
    })
  };

  return new KernelHost(
    () =>
      new MockModelClient({
        grader: [contractJson, stepsJson],
        runner: [successRunnerOutput]
      }),
    {
      engine: new VerificationEngine([needHumanOracle]),
      gate: new CompletionGate(),
      evidenceFor: () => [
        {
          claimId: 'c1',
          acId: 'AC1',
          evidenceType: 'command_output',
          payload: { exitCode: 0 },
          producedBy: 'tool'
        }
      ]
    }
  );
};

it('returns blocked when verifier needs human confirmation', async () => {
  const result = await runHeadless(makeNeedHumanHost(), 'do work');

  expect(result.status).toBe('blocked');
  expect(result.exitCode).toBe(1);
});

it('returns failed when runner output is plain text (no JSON calls)', async () => {
  const host = makeHost({ runnerOutput: 'done' });
  const result = await runHeadless(host, 'do work');

  expect(result.status).toBe('failed');
  expect(result.exitCode).toBe(1);
});

it('logs failed status when host.send throws before final_result', async () => {
  const unsubscribe = vi.fn();
  const host = {
    subscribe: vi.fn().mockReturnValue(unsubscribe),
    send: vi.fn().mockRejectedValue(new Error('tool-call parse failed'))
  } as unknown as KernelHost;
  const logs: string[] = [];

  const result = await runHeadless(host, 'do work', (msg) => {
    logs.push(msg);
  });

  const output = logs.join('\n');
  expect(result.status).toBe('failed');
  expect(result.exitCode).toBe(1);
  expect(output).toContain('[error] tool-call parse failed');
  expect(output).toContain('[status] failed');
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

it('unsubscribes after host.send resolves', async () => {
  const unsubscribe = vi.fn();
  const host = {
    subscribe: vi.fn().mockReturnValue(unsubscribe),
    send: vi.fn().mockResolvedValue(undefined)
  } as unknown as KernelHost;

  await runHeadless(host, 'anything');

  expect(unsubscribe).toHaveBeenCalledTimes(1);
});
