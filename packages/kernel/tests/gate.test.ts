import { expect, it } from 'vitest';

import { CompletionGate } from '../src/conscience/gate';
import type { TaskContract, Verdict } from '@bobby/shared';
import type { ConstraintResult } from '../src/conscience/constraints';

const contract: TaskContract = {
  goal: 'g',
  acceptanceCriteria: [
    { id: 'AC1', desc: 'ac1', oracleHint: 'run' },
    { id: 'AC2', desc: 'ac2', oracleHint: 'run' }
  ],
  constraints: [],
  inputs: [],
  outOfScope: []
};

const passVerdict = (acId: string): Verdict => ({
  claimId: 'claim',
  acId,
  result: 'pass',
  oracleTier: 'T0'
});

const failVerdict = (acId: string): Verdict => ({
  claimId: 'claim',
  acId,
  result: 'fail',
  oracleTier: 'T0',
  detail: `${acId} failed`
});

const needHumanVerdict = (acId: string): Verdict => ({
  claimId: 'claim',
  acId,
  result: 'need_human',
  oracleTier: 'T0',
  detail: `${acId} need human`
});

const gate = new CompletionGate();

it('all AC pass and constraints pass -> done', () => {
  const verdicts = new Map<string, Verdict>([
    ['AC1', passVerdict('AC1')],
    ['AC2', passVerdict('AC2')]
  ]);
  const constraints: ConstraintResult[] = [{ id: 'C1', result: 'pass' }];
  expect(gate.evaluate(contract, verdicts, constraints).status).toBe('done');
});

it('all AC pass and constraints empty -> done', () => {
  const verdicts = new Map<string, Verdict>([
    ['AC1', passVerdict('AC1')],
    ['AC2', passVerdict('AC2')]
  ]);
  expect(gate.evaluate(contract, verdicts, []).status).toBe('done');
});

it('one AC fail -> failed', () => {
  const verdicts = new Map<string, Verdict>([
    ['AC1', failVerdict('AC1')],
    ['AC2', passVerdict('AC2')]
  ]);
  expect(gate.evaluate(contract, verdicts, []).status).toBe('failed');
});

it('missing AC verdict -> failed', () => {
  const verdicts = new Map<string, Verdict>([['AC1', passVerdict('AC1')]]);
  expect(gate.evaluate(contract, verdicts, []).status).toBe('failed');
});

it('need_human AC -> blocked', () => {
  const verdicts = new Map<string, Verdict>([
    ['AC1', passVerdict('AC1')],
    ['AC2', needHumanVerdict('AC2')]
  ]);
  expect(gate.evaluate(contract, verdicts, []).status).toBe('blocked');
});

it('constraint result need_human + AC pass -> blocked', () => {
  const verdicts = new Map<string, Verdict>([
    ['AC1', passVerdict('AC1')],
    ['AC2', passVerdict('AC2')]
  ]);
  const constraints: ConstraintResult[] = [
    { id: 'C1', result: 'need_human', detail: 'manual review needed' }
  ];
  expect(gate.evaluate(contract, verdicts, constraints).status).toBe('blocked');
});

it('constraint fail -> failed even when AC pass', () => {
  const verdicts = new Map<string, Verdict>([
    ['AC1', passVerdict('AC1')],
    ['AC2', passVerdict('AC2')]
  ]);
  const constraints: ConstraintResult[] = [
    { id: 'C1', result: 'fail', detail: 'forbidden path touched' }
  ];
  expect(gate.evaluate(contract, verdicts, constraints).status).toBe('failed');
});

it('fail + need_human -> failed', () => {
  const verdicts = new Map<string, Verdict>([
    ['AC1', failVerdict('AC1')],
    ['AC2', needHumanVerdict('AC2')]
  ]);
  expect(gate.evaluate(contract, verdicts, []).status).toBe('failed');
});
