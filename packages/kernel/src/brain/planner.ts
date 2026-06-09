import { PlanStep, PlanStepSchema, TaskContract } from '@bobby/shared';
import { z } from 'zod';
import type { ModelClient } from '../model/model-client';
import { GRADER_SYSTEM_PROMPT } from './system-prompts';

const formatRevisionInstructions = (revisionInstructions?: string): string =>
  revisionInstructions ? `\n\nRevision instructions from user:\n${revisionInstructions}` : '';

const buildInitialPrompt = (contract: TaskContract, revisionInstructions?: string): string =>
  `${JSON.stringify(contract)}${formatRevisionInstructions(revisionInstructions)}`;

const buildRetryPrompt = (contract: TaskContract, reason: string, revisionInstructions?: string): string =>
  `Previous grader output was invalid: ${reason}\n\nContract:\n${JSON.stringify(
    contract
  )}${formatRevisionInstructions(revisionInstructions)}\n\nReturn a valid JSON plan.`;

const isRetryableValidationError = (message: string): boolean =>
  message.startsWith('planTask: model response is not valid JSON') ||
  message.startsWith('planTask: invalid plan schema') ||
  message.startsWith('planTask: model output violates plan schema');

const validatePlan = (raw: string, contract: TaskContract): PlanStep[] => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
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
};

export async function planTask(
  model: ModelClient,
  contract: TaskContract,
  revisionInstructions?: string
): Promise<PlanStep[]> {
  let userPrompt = buildInitialPrompt(contract, revisionInstructions);

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await model.complete('grader', [
      { role: 'system', content: GRADER_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ], { json: true });

    try {
      return validatePlan(response.content, contract);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === 1 || !isRetryableValidationError(message)) {
        throw error;
      }

      userPrompt = buildRetryPrompt(contract, message, revisionInstructions);
    }
  }

  throw new Error('planTask: retry attempts exhausted');
}
