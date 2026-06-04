import { TaskContractSchema } from '@bobby/shared';
import type { TaskContract } from '@bobby/shared';
import type { ModelClient } from '../model/model-client';

const SYSTEM_PROMPT = `You are an intent parser.
Convert user request into a JSON TaskContract:
{goal, acceptanceCriteria:[{id,desc,oracleHint}], constraints:[{id,desc,check}], inputs, outOfScope}
Only return JSON.`;

export async function captureIntent(model: ModelClient, userInput: string): Promise<TaskContract> {
  const response = await model.complete('grader', [
    { role: 'system', content: SYSTEM_PROMPT },
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
