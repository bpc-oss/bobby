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

  it('throws when acceptanceCriteria is empty', async () => {
    const noAcJson = JSON.stringify({
      goal: 'Missing criteria',
      acceptanceCriteria: [],
      constraints: [],
      inputs: [],
      outOfScope: []
    });
    const model = new MockModelClient({ grader: [noAcJson], runner: [] });

    await expect(captureIntent(model, 'x')).rejects.toThrow(
      'captureIntent: invalid task contract schema at acceptanceCriteria:'
    );
  });
});

it('captureIntent keeps only machine-checkable constraints from model output', async () => {
  const noisyContractJson = JSON.stringify({
    goal: 'Create hello file',
    acceptanceCriteria: [{ id: 'AC1', desc: "hello.txt contains exactly 'hi'", oracleHint: 'file' }],
    constraints: [
      { id: 'C1', desc: 'Content must be the string hi', check: 'string' },
      { id: 'C2', desc: 'Verification command must run', check: 'run' },
      { id: 'C3', desc: 'Do not touch legacy files', check: 'path:src/legacy/' }
    ],
    inputs: [],
    outOfScope: []
  });
  const model = new MockModelClient({ grader: [noisyContractJson], runner: [] });

  const contract = await captureIntent(model, 'create hello.txt');

  expect(contract.constraints).toEqual([
    { id: 'C3', desc: 'Do not touch legacy files', check: 'path:src/legacy/' }
  ]);
});
