import type { PlanStep } from '@bobby/shared';
import { z } from 'zod';
import type { ModelClient } from '../model/model-client';
import { EXEC_SYSTEM_PROMPT } from './system-prompts';
import type { PlannedCall } from '../hands/evidence-provider';

export interface Claim {
  stepId: string;
  acIds: string[];
  summary: string;
  calls: PlannedCall[];
}

const RunnerCallSchema = z.object({
  tool: z.string().min(1),
  input: z.record(z.unknown())
});

const RunnerResponseSchema = z.object({
  calls: z.array(RunnerCallSchema).min(1)
});

export async function executeStep(model: ModelClient, step: PlanStep): Promise<Claim> {
  const response = await model.complete(
    'runner',
    [
    { role: 'system', content: EXEC_SYSTEM_PROMPT },
    { role: 'user', content: step.desc }
  ], { json: true });

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.content);
  } catch {
    throw new Error('executeStep: model response is not valid JSON');
  }

  const planResult = RunnerResponseSchema.safeParse(parsed);
  if (!planResult.success) {
    const issue = planResult.error.issues[0];
    if (!issue) {
      throw new Error('executeStep: model output violates runner call schema');
    }

    const path = issue.path.length ? issue.path.join('.') : 'root';
    throw new Error(`executeStep: invalid runner schema at ${path}: ${issue.message}`);
  }

  const plan = planResult.data;

  return {
    stepId: step.id,
    acIds: step.satisfiesAcIds,
    summary: response.content,
    calls: plan.calls
  };
}
