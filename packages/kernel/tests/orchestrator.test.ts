import { describe, expect, it } from 'vitest';
import { Orchestrator } from '../src/brain/orchestrator';
import { MockModelClient } from '../src/model/mock-model-client';

const contractJson = JSON.stringify({
  goal: 'Create a report file from the provided workspace input',
  acceptanceCriteria: [{ id: 'AC1', desc: 'd', oracleHint: 'file' }],
  constraints: [],
  inputs: ['workspace'],
  outOfScope: []
});

const stepsJson = JSON.stringify([
  { id: 'S1', desc: 'Do work', satisfiesAcIds: ['AC1'], dependsOn: [] }
]);
const revisedStepsJson = JSON.stringify([
  { id: 'S2', desc: 'Revised work', satisfiesAcIds: ['AC1'], dependsOn: [] }
]);

const clarifyContractJson = JSON.stringify({
  goal: 'Optimize',
  acceptanceCriteria: [{ id: 'AC1', desc: 'Manual review required', oracleHint: 'human' }],
  constraints: [],
  inputs: [],
  outOfScope: []
});

const hardOracleClarifyContractJson = JSON.stringify({
  goal: 'Optimize',
  acceptanceCriteria: [{ id: 'AC1', desc: 'File output should exist', oracleHint: 'file' }],
  constraints: [],
  inputs: [],
  outOfScope: []
});

const createOrchestratorWithModel = (graderPayloads: string[], runnerPayloads: string[]): Orchestrator => {
  const model = new MockModelClient({
    grader: graderPayloads,
    runner: runnerPayloads
  });

  return new Orchestrator(model);
};

const createDeferred = <T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} => {
  let resolve = (() => undefined) as (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const waitForNextTick = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const collectEventTypes = async (
  orchestrator: Orchestrator,
  input: string
): Promise<{ taskId: string; eventTypes: string[] }> => {
  const seen: string[] = [];
  orchestrator.on((event) => seen.push(event.type));
  const taskId = await orchestrator.startTask(input);
  return { taskId, eventTypes: seen };
};

const collectTraceEventTypes = (orchestrator: Orchestrator, taskId: string): string[] =>
  orchestrator.trace.get(taskId).map((event) => event.type);

const getStepStartedEvents = (orchestrator: Orchestrator, taskId: string) =>
  orchestrator.trace.get(taskId).filter((event) => event.type === 'step_started');

const expectSimplePlanLifecycle = async (): Promise<void> => {
  const orchestrator = createOrchestratorWithModel(
    [contractJson, stepsJson],
    [JSON.stringify({ calls: [{ tool: 'write_file', input: { path: 'a.txt', content: 'x' } }] })]
  );
  const { taskId, eventTypes } = await collectEventTypes(orchestrator, 'help me do work');

  expect(eventTypes).toEqual(['intent_proposed', 'plan_ready', 'step_started', 'final_result']);
  expect(orchestrator.trace.get(taskId).length).toBe(4);
};

const expectPlanWaitsForApproval = async (): Promise<void> => {
  const decision = createDeferred<{ decision: 'approve' | 'reject' }>();
  const model = new MockModelClient({
    grader: [contractJson, stepsJson],
    runner: [JSON.stringify({ calls: [{ tool: 'write_file', input: { path: 'a.txt', content: 'x' } }] })]
  });
  const orchestrator = new Orchestrator(model, undefined, async () => decision.promise);

  const seen: string[] = [];
  orchestrator.on((event) => seen.push(event.type));
  const task = orchestrator.startTask('help me do work');

  await waitForNextTick();
  expect(seen).toEqual(['intent_proposed', 'plan_ready']);
  expect(seen).not.toContain('step_started');

  decision.resolve({ decision: 'approve' });
  const taskId = await task;
  expect(seen).toEqual(['intent_proposed', 'plan_ready', 'step_started', 'final_result']);
  expect(collectTraceEventTypes(orchestrator, taskId)).toEqual([
    'intent_proposed',
    'plan_ready',
    'step_started',
    'final_result'
  ]);
};

const expectReplanWhenEditIsRequested = async (): Promise<void> => {
  const revisionRequested = createDeferred<{ decision: 'edit'; instructions: string }>();
  const revisionApproved = createDeferred<{ decision: 'approve' }>();
  let attempt = 0;
  const model = new MockModelClient({
    grader: [contractJson, stepsJson, revisedStepsJson],
    runner: [JSON.stringify({ calls: [{ tool: 'write_file', input: { path: 'a.txt', content: 'x' } }] })]
  });
  const orchestrator = new Orchestrator(model, undefined, async () => {
    attempt += 1;
    return attempt === 1 ? revisionRequested.promise : revisionApproved.promise;
  });

  const seen: string[] = [];
  orchestrator.on((event) => seen.push(event.type));
  const task = orchestrator.startTask('help me do work');

  await waitForNextTick();
  expect(seen).toEqual(['intent_proposed', 'plan_ready']);

  revisionRequested.resolve({ decision: 'edit', instructions: 'add one extra validation call' });
  await waitForNextTick();
  expect(seen).toEqual(['intent_proposed', 'plan_ready', 'plan_ready']);

  revisionApproved.resolve({ decision: 'approve' });
  const taskId = await task;

  expect(seen).toEqual(['intent_proposed', 'plan_ready', 'plan_ready', 'step_started', 'final_result']);
  expect(collectTraceEventTypes(orchestrator, taskId)).toEqual([
    'intent_proposed',
    'plan_ready',
    'plan_ready',
    'step_started',
    'final_result'
  ]);

  const stepStarted = getStepStartedEvents(orchestrator, taskId);
  expect(stepStarted).toHaveLength(1);
  expect(stepStarted[0]).toMatchObject({ type: 'step_started', stepId: 'S2' });

  expect(model.calls.map((entry) => entry.role)).toEqual(['grader', 'grader', 'grader', 'runner']);
};

const expectRejectPreventsSteps = async (): Promise<void> => {
  const model = new MockModelClient({
    grader: [contractJson, stepsJson],
    runner: [JSON.stringify({ calls: [{ tool: 'write_file', input: { path: 'a.txt', content: 'x' } }] })]
  });
  const orchestrator = new Orchestrator(model, undefined, async () => ({ decision: 'reject' }));
  const seen: string[] = [];
  orchestrator.on((event) => seen.push(event.type));

  const taskId = await orchestrator.startTask('help me do work');
  expect(seen).toEqual(['intent_proposed', 'plan_ready', 'final_result']);
  expect(seen).not.toContain('step_started');

  const finalEvent = orchestrator.trace.get(taskId).at(-1);
  expect(finalEvent).toMatchObject({ type: 'final_result', status: 'blocked' });

  expect(model.calls.map((entry) => entry.role)).toEqual(['grader', 'grader']);
};

const expectFinalResultFailedByDefault = async (): Promise<void> => {
  const orchestrator = createOrchestratorWithModel(
    [contractJson, stepsJson],
    [JSON.stringify({ calls: [{ tool: 'write_file', input: { path: 'a.txt', content: 'x' } }] })]
  );
  const taskId = await orchestrator.startTask('help me do work');
  const finalEvent = orchestrator.trace.get(taskId).at(-1);

  expect(finalEvent).toMatchObject({ type: 'final_result', status: 'failed' });
};

const expectClarificationSkipsPlanner = async (): Promise<void> => {
  const orchestrator = createOrchestratorWithModel([clarifyContractJson], []);
  const { eventTypes } = await collectEventTypes(orchestrator, 'a');

  expect(eventTypes).toEqual(['intent_proposed', 'direct_answer']);
};

const expectHardOracleClarificationSkipsPlanner = async (): Promise<void> => {
  const orchestrator = createOrchestratorWithModel([hardOracleClarifyContractJson], []);
  const { taskId } = await collectEventTypes(orchestrator, 'please help me');

  expect(taskId).toMatch(/^task-/);
  expect(collectTraceEventTypes(orchestrator, taskId).slice(0, 2)).toEqual(['intent_proposed', 'direct_answer']);
};

describe('Orchestrator', () => {
  it('runs intent to plan to step to final events and stores the trace', expectSimplePlanLifecycle);
  it('waits for plan approval before emitting any step events', expectPlanWaitsForApproval);
  it('replans when edit is requested and executes only the revised plan on approve', expectReplanWhenEditIsRequested);
  it('returns blocked final_result and executes no steps when plan is rejected', expectRejectPreventsSteps);
  it('always emits failed final_result before M2 validation exists', expectFinalResultFailedByDefault);
  it('returns clarification when captureIntent result needs clarification and skips planner', expectClarificationSkipsPlanner);
  it('returns clarification when captureIntent result needs clarification even with hard oracle', expectHardOracleClarificationSkipsPlanner);
});
