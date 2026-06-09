import type { TaskContract } from '@bobby/shared';
import { describe, expect, it } from 'vitest';
import { planTask } from '../src/brain/planner';
import { MockModelClient } from '../src/model/mock-model-client';

const contract: TaskContract = {
  goal: 'g',
  acceptanceCriteria: [{ id: 'AC1', desc: 'd', oracleHint: 'file' }],
  constraints: [],
  inputs: [],
  outOfScope: []
};

const stepsJson = JSON.stringify([
  { id: 'S1', desc: 'Scan directory', satisfiesAcIds: ['AC1'], dependsOn: [] }
]);

const badPlanJson = JSON.stringify([
  { id: 'S1', desc: 'Scan directory', satisfiesAcIds: [], dependsOn: [] }
]);

const expectPlanTaskUsesGrader = async (): Promise<void> => {
  const model = new MockModelClient({ grader: [stepsJson], runner: [] });
  const steps = await planTask(model, contract);
  expect(steps[0]?.satisfiesAcIds).toContain('AC1');
};

const expectRevisionInstructionsAppearInPrompt = async (): Promise<void> => {
  const model = new MockModelClient({
    grader: [stepsJson],
    runner: []
  });
  const steps = await planTask(model, contract, 'run quick smoke test first');

  expect(steps).toHaveLength(1);
  const userMessage = model.calls.at(0)?.messages[1];
  expect(userMessage?.content).toContain('Revision instructions from user');
  expect(userMessage?.content).toContain('run quick smoke test first');
};

const expectSchemaRetryToSucceedAfterOneInvalidPlan = async (): Promise<void> => {
  const model = new MockModelClient({
    grader: [badPlanJson, stepsJson],
    runner: []
  });

  const steps = await planTask(model, contract);

  expect(steps).toEqual([{ id: 'S1', desc: 'Scan directory', satisfiesAcIds: ['AC1'], dependsOn: [] }]);
  expect(model.calls).toHaveLength(2);

  const secondUserMessage = model.calls.at(1)?.messages[1];
  expect(secondUserMessage?.content).toContain('invalid plan schema');
  expect(secondUserMessage?.content).toContain(JSON.stringify(contract));
};

const expectRetryPromptToKeepRevisionInstructions = async (): Promise<void> => {
  const model = new MockModelClient({
    grader: [badPlanJson, stepsJson],
    runner: []
  });

  await planTask(model, contract, 're-plan with less file writes');
  const secondUserMessage = model.calls.at(1)?.messages[1];

  expect(secondUserMessage?.content).toContain('Revision instructions from user');
  expect(secondUserMessage?.content).toContain('re-plan with less file writes');
  expect(secondUserMessage?.content).toContain('invalid plan schema');
};

const expectSchemaRetryToFailAfterSecondFailure = async (): Promise<void> => {
  const model = new MockModelClient({
    grader: [badPlanJson, badPlanJson],
    runner: []
  });

  await expect(planTask(model, contract)).rejects.toThrow('planTask: invalid plan schema');
  expect(model.calls).toHaveLength(2);
};

const expectUnknownAcceptanceCriteriaToReject = async (): Promise<void> => {
  const bad = JSON.stringify([
    { id: 'S1', desc: 'x', satisfiesAcIds: ['AC9'], dependsOn: [] }
  ]);
  const model = new MockModelClient({ grader: [bad], runner: [] });

  await expect(planTask(model, contract)).rejects.toThrow();
};

describe('planTask', () => {
  it('uses grader to produce steps bound to acceptance criteria', expectPlanTaskUsesGrader);
  it('includes revision instructions in grader user prompt when provided', expectRevisionInstructionsAppearInPrompt);
  it('retries once when planner output is invalid and succeeds with a corrected second plan', expectSchemaRetryToSucceedAfterOneInvalidPlan);
  it('keeps revision instructions in retry prompt during schema retry', expectRetryPromptToKeepRevisionInstructions);
  it('retries once when planner output is invalid and rejects after second failure', expectSchemaRetryToFailAfterSecondFailure);
  it('rejects steps that reference unknown acceptance criteria', expectUnknownAcceptanceCriteriaToReject);
});
