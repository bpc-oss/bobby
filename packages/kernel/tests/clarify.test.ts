import { expect, it } from 'vitest';
import { needsClarification } from '../src';
import type { TaskContract } from '@bobby/shared';

const softCriterion: TaskContract['acceptanceCriteria'][number] = {
  id: 'AC1',
  desc: 'Manual review required',
  oracleHint: 'human'
};

const hardCriterion: TaskContract['acceptanceCriteria'][number] = {
  id: 'AC1',
  desc: 'File output exists',
  oracleHint: 'file'
};

const createContract = (partial: Partial<TaskContract> = {}): TaskContract => ({
  goal: 'Build a robust duplicate-file detector for the downloaded folder and generate a report',
  acceptanceCriteria: [hardCriterion],
  constraints: [],
  inputs: [],
  outOfScope: [],
  ...partial
});

it('returns true when goal is vague, no inputs, and only soft-oracle acceptance criteria', () => {
  const result = needsClarification(
    createContract({
      goal: 'Optimize',
      inputs: [],
      acceptanceCriteria: [softCriterion]
    })
  );

  expect(result.should).toBe(true);
  expect(result.reasons).toContain('No input paths were provided.');
  expect(result.reasons).toContain('All acceptance criteria are soft-oracle only (human/review).');
  expect(result.reasons).toContain('Goal is too short or not specific enough.');
  expect(result.reasons).toHaveLength(3);
});

it('returns false when goal is concrete, input is available, and hard-oracle exists', () => {
  const result = needsClarification(createContract({ inputs: ['~/Downloads'] }));

  expect(result.should).toBe(false);
  expect(result.reasons).toHaveLength(0);
});

it('returns false when only one weak signal is present', () => {
  const result = needsClarification(
    createContract({
      goal: 'Build a duplicate-file detector for the downloaded folder and generate a report with matched file groups.',
      inputs: [],
      acceptanceCriteria: [hardCriterion]
    })
  );

  expect(result.should).toBe(false);
  expect(result.reasons).toHaveLength(1);
  expect(result.reasons).toContain('No input paths were provided.');
});

it('returns true when exactly two weak signals are present', () => {
  const result = needsClarification(
    createContract({
      goal: 'Clean the workspace by scanning files, deduplicating names, and producing grouped summaries.',
      inputs: [],
      acceptanceCriteria: [softCriterion]
    })
  );

  expect(result.should).toBe(true);
  expect(result.reasons).toHaveLength(2);
  expect(result.reasons).toContain('No input paths were provided.');
  expect(result.reasons).toContain('All acceptance criteria are soft-oracle only (human/review).');
});

it('is exported from kernel root index', () => {
  expect(typeof needsClarification).toBe('function');
});
