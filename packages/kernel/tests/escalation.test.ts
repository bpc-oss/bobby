import { expect, it } from 'vitest';

import { buildEscalationPlan } from '../src/model/deepseek/escalation';

it('buildEscalationPlan keeps runner for early failures and caps retry turns', () => {
  const first = buildEscalationPlan('runner', 0);
  expect(first).toEqual({
    role: 'runner',
    reasoning_effort: undefined,
    maxTurns: 2
  });

  const second = buildEscalationPlan('runner', 1);
  expect(second).toEqual({
    role: 'runner',
    reasoning_effort: undefined,
    maxTurns: 2
  });
});

it('buildEscalationPlan escalates to grader after repeated runner failures', () => {
  const escalated = buildEscalationPlan('runner', 2);
  expect(escalated.role).toBe('grader');
  expect(escalated.reasoning_effort).toBe('high');
  expect(escalated.maxTurns).toBe(1);
});

it('buildEscalationPlan uses grader settings for grader tier', () => {
  const plan = buildEscalationPlan('grader', 0);
  expect(plan).toEqual({
    role: 'grader',
    reasoning_effort: 'high',
    maxTurns: 1
  });
});
