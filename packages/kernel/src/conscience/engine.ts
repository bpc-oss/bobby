import type { AcceptanceCriterion, Evidence, Verdict } from '@bobby/shared';
import { type Oracle, tierRank } from './oracle';

export class VerificationEngine {
  constructor(private readonly oracles: Oracle[]) {}

  async verify(ac: AcceptanceCriterion, allEvidence: Evidence[]): Promise<Verdict> {
    const evidence = allEvidence.filter((entry) => entry.acId === ac.id);
    const usableOracles = this.oracles
      .filter((oracle) => oracle.canJudge(ac, evidence))
      .sort((a, b) => tierRank(a.tier) - tierRank(b.tier));

    if (usableOracles.length === 0) {
      throw new Error(`no oracle can judge AC ${ac.id}`);
    }

    return usableOracles[0].judge(ac, evidence);
  }
}
