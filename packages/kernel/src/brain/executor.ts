import type { PlanStep } from '@bobby/shared';
import type { ModelClient } from '../model/model-client';

export interface Claim {
  stepId: string;
  acIds: string[];
  summary: string;
}

const SYSTEM_PROMPT = `You are a runner. Execute the provided step and briefly describe what was done.
M1 does not yet include evidence checks or verdict generation.`;

export async function executeStep(model: ModelClient, step: PlanStep): Promise<Claim> {
  const response = await model.complete('runner', [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: step.desc }
  ]);

  return {
    stepId: step.id,
    acIds: step.satisfiesAcIds,
    summary: response.content
  };
}
