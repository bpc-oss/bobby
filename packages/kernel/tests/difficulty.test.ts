import { describe, expect, it } from 'vitest';

import {
  allocateBudget,
  estimateDifficulty,
  scoreToTier,
  type DifficultyTier
} from '../src/model/deepseek/difficulty';

const makeContract = (
  acceptanceCriteriaCount: number,
  constraintsCount: number,
  outOfScopeCount: number,
  oracleHints: Array<'test' | 'run' | 'file' | 'schema' | 'review' | 'human'>,
  inputBytes = 0
) => ({
  goal: 'build this',
  acceptanceCriteria: [...Array.from({ length: acceptanceCriteriaCount })].map((_, idx) => ({
    id: `AC${idx}`,
    desc: 'auto',
    oracleHint: oracleHints[idx] ?? 'run'
  })),
  constraints: [...Array.from({ length: constraintsCount })].map((_, idx) => ({
    id: `C${idx}`,
    desc: `constraint ${idx}`,
    check: `path:/tmp/c${idx}`
  })),
  inputs: inputBytes > 0 ? ['x'.repeat(inputBytes)] : [],
  outOfScope: [...Array.from({ length: outOfScopeCount })].map((_, idx) => `scope/${idx}`)
});

describe('difficulty estimation', () => {
  it('is deterministic for the same contract', () => {
    const contract = makeContract(2, 1, 0, ['run', 'human'], 64);

    expect(estimateDifficulty(contract)).toBe(estimateDifficulty(contract));
  });

  it('maps higher difficulty score to harder tier', () => {
    const simple = estimateDifficulty(makeContract(1, 0, 0, ['file'], 0));
    const normal = estimateDifficulty(makeContract(2, 1, 1, ['run', 'review'], 40));
    const difficult = estimateDifficulty(makeContract(4, 4, 2, ['human', 'review', 'human', 'run'], 300));

    expect(simple).toBeLessThan(normal);
    expect(normal).toBeLessThan(difficult);
    expect(scoreToTier(simple)).toBe('simple');
    expect(scoreToTier(normal)).toBe('normal');
    expect(scoreToTier(difficult)).toBe('difficult');
  });

  it('assigns increasingly permissive budgets by tier', () => {
    const simpleBudget = allocateBudget('simple' as DifficultyTier);
    const normalBudget = allocateBudget('normal' as DifficultyTier);
    const difficultBudget = allocateBudget('difficult' as DifficultyTier);

    expect(simpleBudget.maxTurns).toBeLessThanOrEqual(normalBudget.maxTurns);
    expect(normalBudget.maxTurns).toBeLessThanOrEqual(difficultBudget.maxTurns);
    expect(simpleBudget.maxRetries).toBeLessThanOrEqual(normalBudget.maxRetries);
    expect(normalBudget.maxRetries).toBeLessThanOrEqual(difficultBudget.maxRetries);
    expect(simpleBudget.reasoning_effort).toBe('low');
    expect(normalBudget.reasoning_effort).toBe('medium');
    expect(difficultBudget.reasoning_effort).toBe('high');
    expect(difficultBudget.maxTurns).toBeGreaterThan(simpleBudget.maxTurns);
    expect(difficultBudget.maxRetries).toBeGreaterThan(simpleBudget.maxRetries);
  });
});
