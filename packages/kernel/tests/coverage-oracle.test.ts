import { describe, expect, it } from 'vitest';

import { CoverageOracle } from '../src/conscience/oracles/coverage';
import type { AcceptanceCriterion, Evidence } from '@bobby/shared';

const ac: AcceptanceCriterion = { id: 'AC1', desc: 'check 3 items', oracleHint: 'review' };

const makeEvidence = (payload: Record<string, unknown>): Evidence => ({
  claimId: 'c',
  acId: 'AC1',
  evidenceType: 'quote_with_location',
  payload,
  producedBy: 'tool',
});

describe('CoverageOracle', () => {
  const oracle = new CoverageOracle();

  it('covered=expected -> pass', async () => {
    const items = [{ loc: 'L1', note: 'ok' }, { loc: 'L2', note: 'ok' }, { loc: 'L3', note: 'ok' }];
    const verdict = await oracle.judge(ac, [makeEvidence({ items, expected: 3 })]);
    expect(verdict.result).toBe('pass');
  });

  it('covered<expected -> fail', async () => {
    const items = [{ loc: 'L1', note: 'ok' }];
    const verdict = await oracle.judge(ac, [makeEvidence({ items, expected: 3 })]);
    expect(verdict.result).toBe('fail');
    expect(verdict.detail).toContain('coverage');
  });

  it('expected missing -> fail', async () => {
    const items = [{ loc: 'L1', note: 'ok' }];
    const verdict = await oracle.judge(ac, [makeEvidence({ items })]);
    expect(verdict.result).toBe('fail');
  });

  it('expected 0 -> fail', async () => {
    const items = [{ loc: 'L1', note: 'ok' }, { loc: 'L2', note: 'ok' }];
    const verdict = await oracle.judge(ac, [makeEvidence({ items, expected: 0 })]);
    expect(verdict.result).toBe('fail');
  });
});
