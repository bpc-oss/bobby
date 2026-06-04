import type { AcceptanceCriterion, Evidence, OracleTier, Verdict } from '@bobby/shared';

export interface Oracle {
  readonly tier: OracleTier;
  readonly name: string;

  canJudge(ac: AcceptanceCriterion, evidence: Evidence[]): boolean;
  judge(ac: AcceptanceCriterion, evidence: Evidence[]): Promise<Verdict>;
}

const ORDER: OracleTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];

export function tierRank(tier: OracleTier): number {
  return ORDER.indexOf(tier);
}
