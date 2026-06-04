import type { AcceptanceCriterion, Evidence, Verdict } from '@bobby/shared';
import type { Oracle } from '../oracle';

type CoveragePayload = {
  items: unknown;
  expected?: unknown;
};

type CoverageItem = {
  loc?: unknown;
  note?: unknown;
};

export class CoverageOracle implements Oracle {
  readonly tier = 'T3' as const;
  readonly name = 'coverage';

  canJudge(_ac: AcceptanceCriterion, evidence: Evidence[]): boolean {
    return evidence.some((entry) => entry.evidenceType === 'quote_with_location');
  }

  async judge(ac: AcceptanceCriterion, evidence: Evidence[]): Promise<Verdict> {
    const quoteEvidence = evidence.find((entry) => entry.evidenceType === 'quote_with_location');
    const payload = (quoteEvidence?.payload ?? {}) as CoveragePayload;

    const expected = typeof payload.expected === 'number' ? payload.expected : undefined;
    const items = Array.isArray(payload.items) ? payload.items : [];
    const covered = items.filter((item): item is CoverageItem => {
      if (!item || typeof item !== 'object') return false;
      return item != null && typeof (item as CoverageItem).loc !== 'undefined' && typeof (item as CoverageItem).note !== 'undefined';
    }).length;

    const pass = typeof expected === 'number' && expected > 0 && covered >= expected;

    return {
      claimId: quoteEvidence?.claimId ?? ac.id,
      acId: ac.id,
      oracleTier: 'T3',
      result: pass ? 'pass' : 'fail',
      detail: pass ? undefined : `coverage check failed: ${covered}/${expected ?? 'N/A'}`,
    };
  }
}
