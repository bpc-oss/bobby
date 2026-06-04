import { expect, it } from 'vitest';

import { ConstraintsLibrary } from '../src';
import type { Constraint, TaskContract } from '@bobby/shared';

type ConstraintFixture = {
  global: Constraint[];
  task: Constraint[];
};

const createConstraint = (id: string): Constraint => ({
  id,
  desc: `Constraint ${id}`,
  check: `check:${id}`
});

const createContract = (constraints: Constraint[]): TaskContract => ({
  goal: 'sample goal',
  acceptanceCriteria: [
    {
      id: 'A1',
      desc: 'sample acceptance criterion',
      oracleHint: 'run'
    }
  ],
  constraints,
  inputs: [],
  outOfScope: []
});

const fixtures: ConstraintFixture = {
  global: [createConstraint('G1'), createConstraint('G2')],
  task: [createConstraint('T1'), createConstraint('T2')]
};

it('applies global constraints before task-specific constraints', () => {
  const library = new ConstraintsLibrary(fixtures.global);
  const contract = createContract(fixtures.task);

  const merged = library.applyTo(contract);

  expect(merged.constraints).toEqual([
    createConstraint('G1'),
    createConstraint('G2'),
    createConstraint('T1'),
    createConstraint('T2')
  ]);
});

it('does not mutate original contract constraints array', () => {
  const taskConstraints = [createConstraint('T1'), createConstraint('T2')];
  const contract = createContract(taskConstraints);
  const library = new ConstraintsLibrary([]);

  library.applyTo(contract);

  expect(contract.constraints).toEqual([createConstraint('T1'), createConstraint('T2')]);
  expect(contract.constraints).not.toBe(library.applyTo(contract).constraints);
});

it('does not mutate constructor-provided global constraints array', () => {
  const globalConstraints = [createConstraint('G1'), createConstraint('G2')];
  const library = new ConstraintsLibrary(globalConstraints);
  const contract = createContract([]);
  const originalGlobal = [...globalConstraints];

  library.applyTo(contract);

  expect(globalConstraints).toEqual(originalGlobal);
});

it('is exported from kernel root index', () => {
  expect(typeof ConstraintsLibrary).toBe('function');
});
