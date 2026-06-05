import type { TaskContract } from '@bobby/shared';

type OracleHint = 'test' | 'run' | 'file' | 'schema' | 'review' | 'human';

export type DifficultyTier = 'simple' | 'normal' | 'difficult';

export interface DifficultyBudget {
  maxTurns: number;
  maxRetries: number;
  reasoning_effort: 'low' | 'medium' | 'high';
}

const ORACLE_HINT_WEIGHTS: Record<OracleHint, number> = {
  file: 1,
  run: 2,
  test: 3,
  schema: 2,
  review: 3,
  human: 5
};

function clampScore(score: number): number {
  if (score < 0) {
    return 0;
  }

  return Math.min(score, 100);
}

export function estimateDifficulty(contract: TaskContract): number {
  const acceptanceCriteriaCount = contract.acceptanceCriteria.length;
  const oracleHintWeight = contract.acceptanceCriteria.reduce(
    (sum, ac) => sum + ORACLE_HINT_WEIGHTS[ac.oracleHint],
    0
  );
  const constraintsWeight = contract.constraints.length * 6;
  const inputSizeWeight = contract.inputs.reduce((sum, input) => sum + Math.min(input.length / 20, 6), 0);
  const outOfScopeWeight = contract.outOfScope.length * 2;

  const score =
    acceptanceCriteriaCount * 12 +
    oracleHintWeight +
    constraintsWeight +
    inputSizeWeight +
    outOfScopeWeight;

  return clampScore(Math.round(score));
}

export function scoreToTier(score: number): DifficultyTier {
  if (score <= 22) {
    return 'simple';
  }

  if (score <= 55) {
    return 'normal';
  }

  return 'difficult';
}

export function allocateBudget(tier: DifficultyTier): DifficultyBudget {
  if (tier === 'simple') {
    return { maxTurns: 1, maxRetries: 1, reasoning_effort: 'low' };
  }

  if (tier === 'normal') {
    return { maxTurns: 2, maxRetries: 2, reasoning_effort: 'medium' };
  }

  return { maxTurns: 3, maxRetries: 4, reasoning_effort: 'high' };
}
