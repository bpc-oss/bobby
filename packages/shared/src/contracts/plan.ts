import { z } from 'zod';

export const PlanStepSchema = z.object({
  id: z.string().min(1),
  desc: z.string().min(1),
  satisfiesAcIds: z.array(z.string().min(1)).min(1),
  dependsOn: z.array(z.string().min(1)).default([])
});
export type PlanStep = z.infer<typeof PlanStepSchema>;
