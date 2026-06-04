import { describe, expect, it } from 'vitest';
import { PlanStepSchema } from '../src/contracts/plan';

describe('PlanStep', () => {
  it('requires every step to bind acceptance criteria', () => {
    const step = {
      id: 'S1',
      desc: 'Walk the directory and rename files',
      satisfiesAcIds: ['AC1'],
      dependsOn: []
    };
    expect(() => PlanStepSchema.parse(step)).not.toThrow();
  });

  it('rejects a step without satisfiesAcIds', () => {
    expect(() =>
      PlanStepSchema.parse({ id: 'S1', desc: 'x', satisfiesAcIds: [], dependsOn: [] })
    ).toThrow();
  });
});
