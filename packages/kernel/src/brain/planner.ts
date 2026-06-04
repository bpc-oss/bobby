import { PlanStep, PlanStepSchema, TaskContract } from '@bobby/shared';
import { z } from 'zod';
import type { ModelClient } from '../model/model-client';
import { PLAN_SYSTEM_PROMPT } from './system-prompts';

export async function planTask(model: ModelClient, contract: TaskContract): Promise<PlanStep[]> {
  const response = await model.complete('grader', [
    { role: 'system', content: PLAN_SYSTEM_PROMPT },
    { role: 'user', content: JSON.stringify(contract) }
  ], { json: true });

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.content);
  } catch {
    throw new Error('planTask: model response is not valid JSON');
  }

  const stepsResult = z.array(PlanStepSchema).safeParse(parsed);
  if (!stepsResult.success) {
    const issue = stepsResult.error.issues[0];
    if (!issue) {
      throw new Error('planTask: model output violates plan schema');
    }

    const path = issue.path.length ? issue.path.join('.') : 'root';
    throw new Error(`planTask: invalid plan schema at ${path}: ${issue.message}`);
  }

  const steps = stepsResult.data;
  const acIdSet = new Set(contract.acceptanceCriteria.map((ac) => ac.id));

  for (const step of steps) {
    for (const acId of step.satisfiesAcIds) {
      if (!acIdSet.has(acId)) {
        throw new Error(`planTask: step ${step.id} references unknown acceptance criteria id ${acId}`);
      }
    }
  }

  return steps;
}
