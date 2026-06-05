import type { ModelRole } from '../model-client';
import type { ReasoningEffort } from '../model-client';

export interface EscalationPlan {
  role: ModelRole;
  model?: string;
  reasoning_effort?: ReasoningEffort;
  maxTurns: number;
}

export interface EscalationBudget {
  maxTurns: number;
  maxRetries: number;
  reasoning_effort: ReasoningEffort;
}

const FLASH_MAX_FAILS = 2;
const FLASH_MAX_TURNS = 2;

export function buildEscalationPlan(
  tier: ModelRole,
  failCount: number,
  budget?: Pick<EscalationBudget, 'maxTurns' | 'maxRetries' | 'reasoning_effort'>
): EscalationPlan {
  const maxRetries = budget?.maxRetries ?? FLASH_MAX_FAILS;
  const maxTurns = budget?.maxTurns ?? FLASH_MAX_TURNS;
  const reasoningEffort = budget?.reasoning_effort;

  if (tier !== 'runner' || failCount >= maxRetries) {
    return {
      role: 'grader',
      reasoning_effort: 'high',
      maxTurns: 1
    };
  }

  return {
    role: 'runner',
    reasoning_effort: reasoningEffort,
    maxTurns
  };
}
