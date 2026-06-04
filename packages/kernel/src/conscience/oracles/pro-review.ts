import { z } from 'zod';

import type { AcceptanceCriterion, Evidence, Verdict } from '@bobby/shared';

import type { Oracle } from '../oracle';
import type { ModelClient, ModelMessage } from '../../model/model-client';
import { PRO_REVIEW_SYSTEM_PROMPT } from '../../brain/system-prompts';

const ReviewSchema = z.object({
  verdict: z.enum(['pass', 'fail']),
  defects: z.array(
    z.object({
      severity: z.enum(['critical', 'high', 'medium']),
      acId: z.string(),
      evidence: z.string(),
      mustFix: z.boolean(),
    }),
  ),
  unverifiable: z.array(z.string()).default([]),
});

const PROHIBITED_PAYLOAD_FIELDS = new Set(['summary', 'executorSays']);

function stripSelfNarration(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }

  const source = payload as Record<string, unknown>;
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    if (PROHIBITED_PAYLOAD_FIELDS.has(key)) continue;
    cleaned[key] = value;
  }

  return cleaned;
}

function buildMessages(
  ac: AcceptanceCriterion,
  evidence: Evidence[],
): ModelMessage[] {
  const filteredEvidence: Evidence[] = evidence.map((entry) => ({
    ...entry,
    payload: stripSelfNarration(entry.payload),
  }));

  return [
    { role: 'system', content: PRO_REVIEW_SYSTEM_PROMPT },
    { role: 'user', content: JSON.stringify({ ac, evidence: filteredEvidence }) },
  ];
}

export class ProReviewOracle implements Oracle {
  readonly tier = 'T2' as const;
  readonly name = 'pro-review';

  constructor(private readonly model: ModelClient) {}

  canJudge(ac: AcceptanceCriterion, evidence: Evidence[]): boolean {
    return ac.oracleHint === 'review' || evidence.some((entry) => entry.evidenceType === 'file_diff');
  }

  async judge(ac: AcceptanceCriterion, evidence: Evidence[]): Promise<Verdict> {
    const raw = await this.model.complete('grader', buildMessages(ac, evidence), { json: true });
    const review = ReviewSchema.parse(JSON.parse(raw.content));
    const blockingDefect = review.defects.some((defect) =>
      defect.severity === 'critical' || defect.severity === 'high',
    );
    const result: Verdict['result'] =
      blockingDefect || review.verdict === 'fail'
        ? 'fail'
        : review.unverifiable.length > 0
          ? 'need_human'
          : 'pass';

    return {
      claimId: evidence[0]?.claimId ?? ac.id,
      acId: ac.id,
      oracleTier: 'T2',
      result,
      detail: result === 'pass' ? undefined : JSON.stringify(review),
    };
  }
}
