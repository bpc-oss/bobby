import { TaskContractSchema } from '@bobby/shared';
import type { TaskContract } from '@bobby/shared';
import type { ModelClient } from '../model/model-client';
import { INTENT_SYSTEM_PROMPT } from './system-prompts';

export async function captureIntent(model: ModelClient, userInput: string): Promise<TaskContract> {
  const response = await model.complete('grader', [
    { role: 'system', content: INTENT_SYSTEM_PROMPT },
    { role: 'user', content: userInput }
  ], { json: true });

  let parsed: unknown;

  try {
    parsed = JSON.parse(response.content);
  } catch {
    throw new Error('captureIntent: model response is not valid JSON');
  }

  return TaskContractSchema.parse(parsed);
}
