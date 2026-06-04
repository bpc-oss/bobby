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

  const parsedContract = TaskContractSchema.safeParse(parsed);
  if (!parsedContract.success) {
    const firstIssue = parsedContract.error.issues[0];
    if (!firstIssue) {
      throw new Error('captureIntent: model response violates task contract schema');
    }

    const path = firstIssue.path.length ? firstIssue.path.join('.') : 'root';
    throw new Error(`captureIntent: invalid task contract schema at ${path}: ${firstIssue.message}`);
  }

  return parsedContract.data;
}
