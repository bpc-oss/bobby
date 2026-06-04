import { describe, expect, it } from 'vitest';
import { captureIntent } from '../src/brain/intent';
import { MockModelClient } from '../src/model/mock-model-client';

const contractJson = JSON.stringify({
  goal: 'Organize downloads folder',
  acceptanceCriteria: [{ id: 'AC1', desc: 'Files are grouped by type', oracleHint: 'file' }],
  constraints: [],
  inputs: ['~/Downloads'],
  outOfScope: []
});

describe('captureIntent', () => {
  it('parses user input into a valid TaskContract using grader', async () => {
    const model = new MockModelClient({ grader: [contractJson], runner: [] });

    const contract = await captureIntent(model, 'organize my downloads folder');

    expect(contract.goal).toBe('Organize downloads folder');
    expect(contract.acceptanceCriteria).toHaveLength(1);
  });

  it('throws when the model output is not valid JSON', async () => {
    const model = new MockModelClient({ grader: ['not json'], runner: [] });

    await expect(captureIntent(model, 'x')).rejects.toThrow();
  });
});
