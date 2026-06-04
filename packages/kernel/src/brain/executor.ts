import type { PlanStep } from '@bobby/shared';
import type { ModelClient } from '../model/model-client';
import { EXEC_SYSTEM_PROMPT } from './system-prompts';

export interface Claim {
  stepId: string;
  acIds: string[];
  summary: string;
}

export async function executeStep(model: ModelClient, step: PlanStep): Promise<Claim> {
  const response = await model.complete('runner', [
    { role: 'system', content: EXEC_SYSTEM_PROMPT },
    { role: 'user', content: step.desc }
  ]);

  return {
    stepId: step.id,
    acIds: step.satisfiesAcIds,
    summary: response.content
  };
}
