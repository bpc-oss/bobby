import type { PlanStep } from '@bobby/shared';
import { z } from 'zod';
import type { ModelClient, ModelRole, ReasoningEffort } from '../model/model-client';
import { RUNNER_SYSTEM_PROMPT } from './system-prompts';
import type { PlannedCall } from '../hands/evidence-provider';

export interface Claim {
  stepId: string;
  acIds: string[];
  summary: string;
  calls: PlannedCall[];
  needsPro?: boolean;
}

const RunnerCallSchema = z.object({
  tool: z.string().min(1),
  input: z.record(z.unknown())
});

const RunnerResponseSchema = z.object({
  calls: z.array(RunnerCallSchema).min(1),
  needsPro: z.boolean().optional()
});

export interface ExecuteStepOptions {
  role?: ModelRole;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  retryContext?: string;
}

export async function executeStep(model: ModelClient, step: PlanStep, options: ExecuteStepOptions = {}): Promise<Claim> {
  const role = options.role ?? 'runner';
  const prompt = options.retryContext
    ? `${step.desc}\n\n${options.retryContext}`
    : step.desc;

  const response = await model.complete(
    role,
    [
    { role: 'system', content: RUNNER_SYSTEM_PROMPT },
    { role: 'user', content: prompt }
  ], {
    json: true,
    model: options.model,
    reasoningEffort: options.reasoningEffort
  });

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
    calls: plan.calls,
    needsPro: plan.needsPro
  };
}
