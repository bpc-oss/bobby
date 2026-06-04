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
  it('parses strict JSON tool calls and returns them in claim', async () => {
    const model = new MockModelClient({
      grader: [],
      runner: [
        JSON.stringify({
          calls: [{ tool: 'write_file', input: { path: 'a.txt', content: 'x' } }]
        })
      ]
    });

    const claim = await executeStep(model, step);

    expect(claim.stepId).toBe('S1');
    expect(claim.acIds).toContain('AC1');
    expect(claim.calls).toEqual([{ tool: 'write_file', input: { path: 'a.txt', content: 'x' } }]);
  });

  it('rejects non-JSON runner output', async () => {
    const model = new MockModelClient({ grader: [], runner: ['done'] });

    await expect(executeStep(model, step)).rejects.toThrow('executeStep: model response is not valid JSON');
  });
});
