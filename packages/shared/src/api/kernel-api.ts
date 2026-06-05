import { z } from 'zod';
import { EvidenceSchema } from '../contracts/evidence';
import { PlanStepSchema } from '../contracts/plan';
import { TaskContractSchema } from '../contracts/task-contract';
import { VerdictSchema } from '../contracts/evidence';

export const KernelCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('startTask'),
    input: z.string().min(1)
  }),
  z.object({
    type: z.literal('answer'),
    taskId: z.string().min(1),
    reply: z.string()
  }),
  z.object({
    type: z.literal('approveGate'),
    gateId: z.string().min(1),
    decision: z.enum(['allow', 'deny'])
  }),
  z.object({
    type: z.literal('abort'),
    taskId: z.string().min(1)
  }),
  z.object({
    type: z.literal('getTrace'),
    taskId: z.string().min(1)
  })
]);
export type KernelCommand = z.infer<typeof KernelCommandSchema>;

export const KernelEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('intent_proposed'),
    taskId: z.string().min(1),
    contract: TaskContractSchema
  }),
  z.object({
    type: z.literal('direct_answer'),
    taskId: z.string().min(1),
    text: z.string().min(1)
  }),
  z.object({
    type: z.literal('plan_ready'),
    taskId: z.string().min(1),
    steps: z.array(PlanStepSchema)
  }),
  z.object({
    type: z.literal('step_started'),
    taskId: z.string().min(1),
    stepId: z.string().min(1)
  }),
  z.object({
    type: z.literal('tool_called'),
    taskId: z.string().min(1),
    stepId: z.string().min(1),
    tool: z.string().min(1)
  }),
  z.object({
    type: z.literal('evidence_produced'),
    taskId: z.string().min(1),
    evidence: EvidenceSchema
  }),
  z.object({
    type: z.literal('verdict'),
    taskId: z.string().min(1),
    verdict: VerdictSchema
  }),
  z.object({
    type: z.literal('gate_request'),
    taskId: z.string().min(1),
    gateId: z.string().min(1),
    reason: z.string().min(1)
  }),
  z.object({
    type: z.literal('final_result'),
    taskId: z.string().min(1),
    status: z.enum(['done', 'failed', 'blocked'])
  }),
  z.object({
    type: z.literal('error'),
    taskId: z.string().min(1),
    message: z.string().min(1)
  })
]);
export type KernelEvent = z.infer<typeof KernelEventSchema>;
