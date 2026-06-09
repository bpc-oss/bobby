import { describe, expect, it } from 'vitest';
import { KernelCommandSchema, KernelEventSchema } from '../src/api/kernel-api';

const expectStartTaskCommandIsAccepted = (): void => {
  expect(() => KernelCommandSchema.parse({ type: 'startTask', input: 'organize my downloads folder' })).not.toThrow();
};

const expectGateRequestEventIsAccepted = (): void => {
  const e = { type: 'gate_request', taskId: 't1', gateId: 'g1', reason: 'network access' };
  expect(() => KernelEventSchema.parse(e)).not.toThrow();
};

const expectDirectAnswerEventIsAccepted = (): void => {
  const e = { type: 'direct_answer', taskId: 't1', text: '你好，我可以帮你处理。' };
  expect(() => KernelEventSchema.parse(e)).not.toThrow();
};

const expectAssistantDeltaEventIsAccepted = (): void => {
  expect(() =>
    KernelEventSchema.parse({
      type: 'assistant_delta',
      taskId: 'task-1',
      content: 'think slowly',
      sequence: 1
    })
  ).not.toThrow();
};

const expectReasoningDeltaEventIsAccepted = (): void => {
  expect(() =>
    KernelEventSchema.parse({
      type: 'reasoning_delta',
      taskId: 'task-1',
      content: 'analyzing constraints',
      final: true,
      sequence: 2
    })
  ).not.toThrow();
};

const expectToolDeltaEventIsAccepted = (): void => {
  expect(() =>
    KernelEventSchema.parse({
      type: 'tool_delta',
      taskId: 'task-1',
      status: 'chunk',
      stepId: 'S1',
      tool: 'exec',
      content: 'ls',
      sequence: 3
    })
  ).not.toThrow();
};

const expectUsageDeltaEventIsAccepted = (): void => {
  expect(() =>
    KernelEventSchema.parse({
      type: 'usage_delta',
      taskId: 'task-1',
      model: 'deepseek-v3',
      promptTokens: 5,
      completionTokens: 7,
      cachedTokens: 1,
      costUsd: 0.0012,
      sequence: 4
    })
  ).not.toThrow();
};

const expectPlanDecisionIsAccepted = (): void => {
  expect(() => KernelCommandSchema.parse({ type: 'planDecision', taskId: 'task-1', decision: 'approve' })).not.toThrow();
};

const expectPlanDecisionEditWithInstructionsIsAccepted = (): void => {
  expect(() =>
    KernelCommandSchema.parse({
      type: 'planDecision',
      taskId: 'task-1',
      decision: 'edit',
      instructions: 'split the step into two smaller steps'
    })
  ).not.toThrow();
};

const expectPlanDecisionEditWithoutInstructionsToReject = (): void => {
  expect(() =>
    KernelCommandSchema.parse({
      type: 'planDecision',
      taskId: 'task-1',
      decision: 'edit'
    } as unknown)
  ).toThrow();
};

const expectPlanDecisionEmptyInstructionsToReject = (): void => {
  expect(() =>
    KernelCommandSchema.parse({
      type: 'planDecision',
      taskId: 'task-1',
      decision: 'edit',
      instructions: ''
    })
  ).toThrow();
};

const expectApproveGateWithAlwaysDecisionToBeAccepted = (): void => {
  expect(() =>
    KernelCommandSchema.parse({
      type: 'approveGate',
      gateId: 'g1',
      decision: 'always'
    })
  ).not.toThrow();
};

const expectUnknownApproveGateDecisionToReject = (): void => {
  const payload = JSON.parse('{"type":"approveGate","gateId":"g1","decision":"block"}');
  expect(() => KernelCommandSchema.parse(payload)).toThrow();
};

const expectUnknownCommandToReject = (): void => {
  expect(() => KernelCommandSchema.parse({ type: 'nuke' })).toThrow();
};

const expectListAgentsCommandToBeAccepted = (): void => {
  expect(() => KernelCommandSchema.parse({ type: 'listAgents' })).not.toThrow();
};

const expectRestoreSnapshotCommandWithoutSnapshotIdToBeAccepted = (): void => {
  expect(() => KernelCommandSchema.parse({ type: 'restoreSnapshot' })).not.toThrow();
};

const expectRestoreSnapshotCommandWithSnapshotIdToBeAccepted = (): void => {
  expect(() =>
    KernelCommandSchema.parse({
      type: 'restoreSnapshot',
      snapshotId: 'snapshot-1'
    })
  ).not.toThrow();
};

const expectRestoreSnapshotCommandWithEmptySnapshotIdToReject = (): void => {
  expect(() =>
    KernelCommandSchema.parse({
      type: 'restoreSnapshot',
      snapshotId: ''
    })
  ).toThrow();
};

const expectResumeSessionCommandToBeAccepted = (): void => {
  expect(() => KernelCommandSchema.parse({ type: 'resumeSession' })).not.toThrow();
};

describe('Kernel API', () => {
  it('accepts a startTask command', expectStartTaskCommandIsAccepted);
  it('accepts a gate_request event', expectGateRequestEventIsAccepted);
  it('accepts a direct_answer event', expectDirectAnswerEventIsAccepted);
  it('accepts an assistant_delta event', expectAssistantDeltaEventIsAccepted);
  it('accepts a reasoning_delta event', expectReasoningDeltaEventIsAccepted);
  it('accepts a tool_delta event', expectToolDeltaEventIsAccepted);
  it('accepts a usage_delta event', expectUsageDeltaEventIsAccepted);
  it('accepts a planDecision command', expectPlanDecisionIsAccepted);
  it('accepts planDecision edit with non-empty instructions', expectPlanDecisionEditWithInstructionsIsAccepted);
  it('rejects planDecision edit when instructions are missing', expectPlanDecisionEditWithoutInstructionsToReject);
  it('rejects planDecision edit with empty instructions', expectPlanDecisionEmptyInstructionsToReject);
  it('accepts approveGate with always decision', expectApproveGateWithAlwaysDecisionToBeAccepted);
  it('rejects unknown approveGate decision', expectUnknownApproveGateDecisionToReject);
  it('accepts listAgents command', expectListAgentsCommandToBeAccepted);
  it('accepts restoreSnapshot command without snapshotId', expectRestoreSnapshotCommandWithoutSnapshotIdToBeAccepted);
  it('accepts restoreSnapshot command with snapshotId', expectRestoreSnapshotCommandWithSnapshotIdToBeAccepted);
  it('rejects restoreSnapshot command with empty snapshotId', expectRestoreSnapshotCommandWithEmptySnapshotIdToReject);
  it('accepts resumeSession command', expectResumeSessionCommandToBeAccepted);
  it('rejects an unknown command type', expectUnknownCommandToReject);
});
