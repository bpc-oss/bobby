import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

import {
  EXEC_SYSTEM_PROMPT,
  INTENT_SYSTEM_PROMPT,
  PLAN_SYSTEM_PROMPT,
  PRO_REVIEW_SYSTEM_PROMPT
} from '../src/brain/system-prompts';
import { captureIntent } from '../src/brain/intent';
import { executeStep } from '../src/brain/executor';
import { planTask } from '../src/brain/planner';
import { ProReviewOracle } from '../src/conscience/oracles/pro-review';
import type { PlanStep, TaskContract } from '@bobby/shared';
import type { ModelClient, ModelMessage, ModelResponse, ModelRole } from '../src/model/model-client';

type RecordedMessage = {
  role: ModelRole;
  messages: ModelMessage[];
  opts?: { json?: boolean };
};

class RecordingModelClient implements ModelClient {
  public readonly messages: RecordedMessage[] = [];

  constructor(private readonly responses: Record<ModelRole, string[]>) {}

  async complete(role: ModelRole, messages: ModelMessage[], opts?: { json?: boolean }): Promise<ModelResponse> {
    this.messages.push({ role, messages, opts });

    const response = this.responses[role]?.shift();
    if (!response) {
      throw new Error(`RecordingModelClient: no queued response for role ${role}`);
    }

    return { content: response };
  }
}

const readPrompt = (filename: string): string => {
  const fullPath = fileURLToPath(new URL(`../../../prompts/system/${filename}`, import.meta.url));
  return readFileSync(fullPath, 'utf8').replace(/\r\n/g, '\n');
};

const contractJson = JSON.stringify({
  goal: 'g',
  acceptanceCriteria: [{ id: 'AC1', desc: 'd', oracleHint: 'file' }],
  constraints: [],
  inputs: [],
  outOfScope: []
});

const stepsJson = JSON.stringify([
  {
    id: 'S1',
    desc: 'do something',
    satisfiesAcIds: ['AC1'],
    dependsOn: []
  }
]);

const plan: PlanStep[] = [{ id: 'S1', desc: 'do something', satisfiesAcIds: ['AC1'], dependsOn: [] }];
const contract: TaskContract = {
  goal: 'g',
  acceptanceCriteria: [{ id: 'AC1', desc: 'd', oracleHint: 'file' }],
  constraints: [],
  inputs: [],
  outOfScope: []
};

const reviewJson = JSON.stringify({
  verdict: 'pass',
  defects: [],
  unverifiable: []
});

it('md and TS prompts keep exact text alignment', () => {
  expect(readPrompt('intent.md').trim()).toBe(INTENT_SYSTEM_PROMPT);
  expect(readPrompt('plan.md').trim()).toBe(PLAN_SYSTEM_PROMPT);
  expect(readPrompt('exec.md').trim()).toBe(EXEC_SYSTEM_PROMPT);
  expect(readPrompt('pro-review.md').trim()).toBe(PRO_REVIEW_SYSTEM_PROMPT);
});

it('prompts contain anti-self-praise and evidence constraints', () => {
  expect(INTENT_SYSTEM_PROMPT).toContain('不许自我表扬');
  expect(PLAN_SYSTEM_PROMPT).toContain('不许自我表扬');
  expect(PRO_REVIEW_SYSTEM_PROMPT).toContain('不许自我表扬');
  expect(EXEC_SYSTEM_PROMPT).toContain('不得用“done/completed/verified”之类语句当作完成态');

  expect(INTENT_SYSTEM_PROMPT).toContain('证据');
  expect(PLAN_SYSTEM_PROMPT).toContain('证据');
  expect(EXEC_SYSTEM_PROMPT).toContain('证据');
  expect(PRO_REVIEW_SYSTEM_PROMPT).toContain('证据');
});

it('captureIntent sends the intent system prompt', async () => {
  const model = new RecordingModelClient({ grader: [contractJson], runner: [] });
  await captureIntent(model, 'organize files');

  expect(model.messages[0]?.role).toBe('grader');
  expect(model.messages[0]?.messages).toHaveLength(2);
  expect(model.messages[0]?.messages[0]?.content).toBe(INTENT_SYSTEM_PROMPT);
  expect(model.messages[0]?.messages[0]?.role).toBe('system');
});

it('planTask sends the plan system prompt', async () => {
  const model = new RecordingModelClient({ grader: [stepsJson], runner: [] });
  await planTask(model, contract);

  expect(model.messages[0]?.role).toBe('grader');
  expect(model.messages[0]?.messages).toHaveLength(2);
  expect(model.messages[0]?.messages[0]?.content).toBe(PLAN_SYSTEM_PROMPT);
  expect(model.messages[0]?.messages[0]?.role).toBe('system');
});

it('executeStep sends the execution system prompt', async () => {
  const model = new RecordingModelClient({
    grader: [],
    runner: [JSON.stringify({ calls: [{ tool: 'write_file', input: { path: 'a.txt', content: 'x' } }] })]
  });
  await executeStep(model, plan[0]);

  expect(model.messages[0]?.role).toBe('runner');
  expect(model.messages[0]?.messages).toHaveLength(2);
  expect(model.messages[0]?.messages[0]?.content).toBe(EXEC_SYSTEM_PROMPT);
  expect(model.messages[0]?.messages[0]?.role).toBe('system');
});

it('ProReviewOracle sends the pro-review system prompt', async () => {
  const model = new RecordingModelClient({ grader: [reviewJson], runner: [] });
  const oracle = new ProReviewOracle(model);

  await oracle.judge(
    { id: 'AC1', desc: 'd', oracleHint: 'review' },
    [
      {
        claimId: 'c1',
        acId: 'AC1',
        evidenceType: 'file_diff',
        payload: {},
        producedBy: 'tool'
      }
    ]
  );

  expect(model.messages[0]?.role).toBe('grader');
  expect(model.messages[0]?.messages).toHaveLength(2);
  expect(model.messages[0]?.messages[0]?.content).toBe(PRO_REVIEW_SYSTEM_PROMPT);
  expect(model.messages[0]?.messages[0]?.role).toBe('system');
});
