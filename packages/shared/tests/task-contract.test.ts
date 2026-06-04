import { describe, expect, it } from 'vitest';
import { TaskContractSchema } from '../src/contracts/task-contract';

const valid = {
  goal: 'Rename 100 PDFs by year',
  acceptanceCriteria: [{ id: 'AC1', desc: 'All 100 files are renamed', oracleHint: 'file' }],
  constraints: [{ id: 'C1', desc: 'Do not delete originals', check: 'diff has no delete' }],
  inputs: ['./pdfs'],
  outOfScope: ['edit file contents']
};

describe('TaskContractSchema', () => {
  it('accepts a valid contract', () => {
    expect(() => TaskContractSchema.parse(valid)).not.toThrow();
  });

  it('rejects a contract without acceptance criteria', () => {
    expect(() => TaskContractSchema.parse({ ...valid, acceptanceCriteria: [] })).toThrow();
  });

  it('rejects an invalid oracleHint', () => {
    const bad = {
      ...valid,
      acceptanceCriteria: [{ id: 'AC1', desc: 'x', oracleHint: 'magic' }]
    };
    expect(() => TaskContractSchema.parse(bad)).toThrow();
  });
});
