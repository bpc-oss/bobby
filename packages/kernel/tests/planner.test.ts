import type { TaskContract } from '@bobby/shared';
import { describe, expect, it } from 'vitest';
import { planTask } from '../src/brain/planner';
import { MockModelClient } from '../src/model/mock-model-client';

const contract: TaskContract = {
  goal: 'g',
  acceptanceCriteria: [{ id: 'AC1', desc: 'd', oracleHint: 'file' }],
  constraints: [],
  inputs: [],
  outOfScope: []
};

const stepsJson = JSON.stringify([
  { id: 'S1', desc: 'Scan directory', satisfiesAcIds: ['AC1'], dependsOn: [] }
]);

describe('planTask', () => {
  it('uses grader to produce steps bound to acceptance criteria', async () => {
    const model = new MockModelClient({ grader: [stepsJson], runner: [] });

    const steps = await planTask(model, contract);

    expect(steps[0]?.satisfiesAcIds).toContain('AC1');
  });

  it('rejects steps that reference unknown acceptance criteria', async () => {
    const bad = JSON.stringify([
      { id: 'S1', desc: 'x', satisfiesAcIds: ['AC9'], dependsOn: [] }
    ]);
    const model = new MockModelClient({ grader: [bad], runner: [] });

    await expect(planTask(model, contract)).rejects.toThrow();
  });
});
