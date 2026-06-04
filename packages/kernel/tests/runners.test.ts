import { expect, it } from 'vitest';

import { detectRunners } from '../src/hands/runners';

it('detects node/python/bash runners and returns node as available', async () => {
  const runners = await detectRunners();
  const byLang = Object.fromEntries(runners.map((runner) => [runner.lang, runner]));

  expect(runners).toHaveLength(3);
  expect(byLang.node).toBeDefined();
  expect(byLang.python).toBeDefined();
  expect(byLang.bash).toBeDefined();

  expect(byLang.node.available).toBe(true);
  expect(typeof byLang.node.cmd).toBe('string');
  expect(byLang.node.cmd).toBe(process.execPath);

  expect([true, false]).toContain(byLang.python.available);
  expect([true, false]).toContain(byLang.bash.available);
  expect(byLang.python.cmd).toBe('python');
  expect(byLang.bash.cmd).toBe('bash');
});
