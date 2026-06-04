import { describe, expect, it } from 'vitest';
import { EvidenceSchema, VerdictSchema } from '../src/contracts/evidence';

describe('Evidence/Verdict', () => {
  it('accepts valid evidence', () => {
    const ev = {
      claimId: 'cl1',
      acId: 'AC1',
      evidenceType: 'command_output',
      payload: { cmd: 'ls', exitCode: 0, stdout: 'a\nb' },
      producedBy: 'tool'
    };
    expect(() => EvidenceSchema.parse(ev)).not.toThrow();
  });

  it('rejects an illegal evidence producer', () => {
    const ev = {
      claimId: 'cl1',
      acId: 'AC1',
      evidenceType: 'command_output',
      payload: {},
      producedBy: 'santa'
    };
    expect(() => EvidenceSchema.parse(ev)).toThrow();
  });

  it('requires verdict oracleTier and result', () => {
    const v = {
      claimId: 'cl1',
      acId: 'AC1',
      result: 'fail',
      oracleTier: 'T2',
      detail: 'Pro found two defects'
    };
    expect(() => VerdictSchema.parse(v)).not.toThrow();
    expect(() => VerdictSchema.parse({ ...v, result: 'maybe' })).toThrow();
  });
});
