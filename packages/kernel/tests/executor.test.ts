import type { PlanStep } from '@bobby/shared';
import { describe, expect, it } from 'vitest';
import { executeStep } from '../src/brain/executor';
import { MockModelClient } from '../src/model/mock-model-client';

const step: PlanStep = {
  id: 'S1',
  desc: 'Scan directory',
  satisfiesAcIds: ['AC1'],
  dependsOn: []
};

describe('executeStep', () => {
  it('uses runner to execute and produces a Claim bound to acceptance criteria', async () => {
    const model = new MockModelClient({ grader: [], runner: ['Scan complete, 12 files found'] });

    const claim = await executeStep(model, step);

    expect(claim.stepId).toBe('S1');
    expect(claim.acIds).toContain('AC1');
    expect(claim.summary).toContain('Scan');
  });
});
