import { describe, expect, it } from 'vitest';
import { Orchestrator } from '../src/brain/orchestrator';
import { MockModelClient } from '../src/model/mock-model-client';

const contractJson = JSON.stringify({
  goal: 'g',
  acceptanceCriteria: [{ id: 'AC1', desc: 'd', oracleHint: 'file' }],
  constraints: [],
  inputs: [],
  outOfScope: []
});

const stepsJson = JSON.stringify([
  { id: 'S1', desc: 'Do work', satisfiesAcIds: ['AC1'], dependsOn: [] }
]);

describe('Orchestrator', () => {
  it('runs intent to plan to step to final events and stores the trace', async () => {
    const model = new MockModelClient({ grader: [contractJson, stepsJson], runner: ['done'] });
    const orchestrator = new Orchestrator(model);
    const seen: string[] = [];
    orchestrator.on((event) => seen.push(event.type));

    const taskId = await orchestrator.startTask('help me do work');

    expect(seen).toEqual(['intent_proposed', 'plan_ready', 'step_started', 'final_result']);
    expect(orchestrator.trace.get(taskId).length).toBe(4);
  });

  it('always emits failed final_result before M2 validation exists', async () => {
    const model = new MockModelClient({ grader: [contractJson, stepsJson], runner: ['done'] });
    const orchestrator = new Orchestrator(model);

    const taskId = await orchestrator.startTask('help me do work');
    const finalEvent = orchestrator.trace.get(taskId).at(-1);

    expect(finalEvent).toMatchObject({ type: 'final_result', status: 'failed' });
  });
});
