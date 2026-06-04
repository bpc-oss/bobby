import { z } from 'zod';

export const OracleHintSchema = z.enum(['test', 'run', 'file', 'schema', 'review', 'human']);
export type OracleHint = z.infer<typeof OracleHintSchema>;

export const AcceptanceCriterionSchema = z.object({
  id: z.string().min(1),
  desc: z.string().min(1),
  oracleHint: OracleHintSchema
});
export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;

export const ConstraintSchema = z.object({
  id: z.string().min(1),
  desc: z.string().min(1),
  check: z.string().min(1)
});
export type Constraint = z.infer<typeof ConstraintSchema>;

export const TaskContractSchema = z.object({
  goal: z.string().min(1),
  acceptanceCriteria: z.array(AcceptanceCriterionSchema).min(1),
  constraints: z.array(ConstraintSchema).default([]),
  inputs: z.array(z.string()).default([]),
  outOfScope: z.array(z.string()).default([])
});
export type TaskContract = z.infer<typeof TaskContractSchema>;
