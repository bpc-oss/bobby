import type { TaskContract } from '@bobby/shared';

const isVagueGoal = (goal: string): boolean => {
  const trimmed = goal.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const startsWithGenericVerb = /^(improve|enhance|fix|implement|organize|build|create|make|optimize|clean|cleanup|handle|process)\b/i.test(trimmed);

  if (!trimmed || trimmed.length < 24 || words.length <= 3) {
    return true;
  }

  if (startsWithGenericVerb && words.length <= 4) {
    return true;
  }

  return false;
};

export function needsClarification(contract: TaskContract): { should: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (contract.inputs.length === 0) {
    reasons.push('No input paths were provided.');
  }

  if (contract.acceptanceCriteria.every((ac) => ac.oracleHint === 'human' || ac.oracleHint === 'review')) {
    reasons.push('All acceptance criteria are soft-oracle only (human/review).');
  }

  if (isVagueGoal(contract.goal)) {
    reasons.push('Goal is too short or not specific enough.');
  }

  return {
    should: reasons.length >= 2,
    reasons
  };
}
