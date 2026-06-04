import { z } from 'zod';

export const EvidenceTypeSchema = z.enum([
  'test_run',
  'command_output',
  'file_diff',
  'file_exists',
  'schema_valid',
  'symbol_exists',
  'quote_with_location',
  'pro_review',
  'human_ack'
]);
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

export const EvidenceSchema = z.object({
  claimId: z.string().min(1),
  acId: z.string().min(1),
  evidenceType: EvidenceTypeSchema,
  payload: z.record(z.unknown()),
  producedBy: z.enum(['tool', 'flash', 'pro', 'human'])
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const OracleTierSchema = z.enum(['T0', 'T1', 'T2', 'T3', 'T4']);
export type OracleTier = z.infer<typeof OracleTierSchema>;

export const VerdictSchema = z.object({
  claimId: z.string().min(1),
  acId: z.string().min(1),
  result: z.enum(['pass', 'fail', 'need_human']),
  oracleTier: OracleTierSchema,
  detail: z.string().optional()
});
export type Verdict = z.infer<typeof VerdictSchema>;
