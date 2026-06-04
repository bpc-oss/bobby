import { expect, it } from 'vitest';

import { BudgetGuard } from '../src/model/deepseek/routing';

it('throws when accumulated spend exceeds maxUsd', () => {
  const guard = new BudgetGuard({ maxUsd: 1 });
  guard.record({ usd: 0.6, role: 'runner' });
  guard.record({ usd: 0.5, role: 'grader' });

  expect(() => guard.assertWithinBudget()).toThrowError(/budget/);
});

it('does not throw when accumulated spend is below maxUsd', () => {
  const guard = new BudgetGuard({ maxUsd: 1 });
  guard.record({ usd: 0.6, role: 'runner' });
  guard.record({ usd: 0.39, role: 'grader' });

  expect(() => guard.assertWithinBudget()).not.toThrow();
});

it('counts grader calls and runner calls correctly', () => {
  const guard = new BudgetGuard({ maxUsd: 10 });
  guard.record({ usd: 0.1, role: 'grader' });
  guard.record({ usd: 0.2, role: 'runner' });
  guard.record({ usd: 0.3, role: 'grader' });

  expect(guard.proCalls).toBe(2);
  expect(guard.flashCalls).toBe(1);
});

it('returns cumulative spent usd', () => {
  const guard = new BudgetGuard({ maxUsd: 10 });
  guard.record({ usd: 0.2, role: 'runner' });
  guard.record({ usd: 0.3, role: 'grader' });

  expect(guard.spentUsd).toBe(0.5);
});

it('does not throw when accumulated spend equals maxUsd', () => {
  const guard = new BudgetGuard({ maxUsd: 1 });
  guard.record({ usd: 0.6, role: 'runner' });
  guard.record({ usd: 0.4, role: 'grader' });

  expect(() => guard.assertWithinBudget()).not.toThrow();
});
