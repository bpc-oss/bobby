import { z } from 'zod';
import { EvidenceSchema } from '../contracts/evidence';
import { PlanStepSchema } from '../contracts/plan';
import { TaskContractSchema } from '../contracts/task-contract';
import { VerdictSchema } from '../contracts/evidence';

export type GateDecision = 'allow' | 'always' | 'deny';
export type PermissionDecision = GateDecision;

export type PlanDecision =
  | { decision: 'approve' }
  | { decision: 'reject' }
  | { decision: 'edit'; instructions: string };

export type SessionMode = 'plan-only' | 'standard' | 'enhanced' | 'full';

export const KernelCommandSchema = z.union([
  z.object({
    type: z.literal('startTask'),
    input: z.string().min(1),
    taskId: z.string().min(1).optional(),
    mode: z.enum(['plan-only', 'standard', 'enhanced', 'full']).optional()
  }),
  z.object({
    type: z.literal('answer'),
    taskId: z.string().min(1),
    reply: z.string()
  }),
  z.object({
    type: z.literal('approveGate'),
    gateId: z.string().min(1),
    decision: z.enum(['allow', 'always', 'deny'])
  }),
  z.object({
    type: z.literal('planDecision'),
    taskId: z.string().min(1),
    decision: z.literal('approve')
  }),
  z.object({
    type: z.literal('planDecision'),
    taskId: z.string().min(1),
    decision: z.literal('reject')
  }),
  z.object({
    type: z.literal('planDecision'),
    taskId: z.string().min(1),
    decision: z.literal('edit'),
    instructions: z.string().min(1)
  }),
  z.object({
    type: z.literal('abort'),
    taskId: z.string().min(1)
  }),
  z.object({
    type: z.literal('getTrace'),
    taskId: z.string().min(1)
  }),
  z.object({
    type: z.literal('listAgents')
  }),
  z.object({
    type: z.literal('restoreSnapshot'),
    snapshotId: z.string().min(1).optional(),
    restoreConfirmed: z.literal(true).optional()
  }),
  z.object({
    type: z.literal('resumeSession')
  })
]);
export type KernelCommand = z.infer<typeof KernelCommandSchema>;

export const KernelEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('assistant_delta'),
    taskId: z.string().min(1),
    content: z.string(),
    sequence: z.number().nonnegative().optional(),
    final: z.boolean().optional()
  }),
  z.object({
    type: z.literal('reasoning_delta'),
    taskId: z.string().min(1),
    content: z.string(),
    sequence: z.number().nonnegative().optional(),
    final: z.boolean().optional()
  }),
  z.object({
    type: z.literal('tool_delta'),
    taskId: z.string().min(1),
    status: z.enum(['start', 'chunk', 'end']),
    stepId: z.string().min(1).optional(),
    tool: z.string().optional(),
    content: z.string().optional(),
    sequence: z.number().nonnegative().optional()
  }),
  z.object({
    type: z.literal('usage_delta'),
    taskId: z.string().min(1),
    model: z.string().optional(),
    promptTokens: z.number().nonnegative().optional(),
    completionTokens: z.number().nonnegative().optional(),
    cachedTokens: z.number().nonnegative().optional(),
    costUsd: z.number().nonnegative().optional(),
    sequence: z.number().nonnegative().optional()
  }),
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
