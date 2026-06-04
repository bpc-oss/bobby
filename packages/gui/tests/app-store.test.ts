import { describe, expect, it } from 'vitest';

import type { Evidence, KernelEvent } from '@bobby/shared';

import { initial, reduce } from '../src/store/app-store';

describe('app store reducer', () => {
  const sampleEvidence: Evidence = {
    claimId: 'claim-1',
    acId: 'AC1',
    evidenceType: 'command_output',
    payload: { exitCode: 0, stdout: 'ok' },
    producedBy: 'tool'
  };

  it('accumulates step started, evidence, and gate request into state', () => {
    const s0 = initial();

    const stepEvent: KernelEvent = {
      type: 'step_started',
      taskId: 'task-1',
      stepId: 'step-1'
    };
    const evidenceEvent: KernelEvent = {
      type: 'evidence_produced',
      taskId: 'task-1',
      evidence: sampleEvidence
    };
    const gateEvent: KernelEvent = {
      type: 'gate_request',
      taskId: 'task-1',
      gateId: 'gate-1',
      reason: 'need approval'
    };

    const s1 = reduce(s0, stepEvent);
    const s2 = reduce(s1, evidenceEvent);
    const s3 = reduce(s2, gateEvent);

    expect(s1).toMatchObject({ steps: ['step-1'], evidence: [], status: 'running' });
    expect(s1.pendingGate).toBeUndefined();
    expect(s2).toMatchObject({
      steps: ['step-1'],
      evidence: [sampleEvidence],
      status: 'running'
    });
    expect(s2.pendingGate).toBeUndefined();
    expect(s3).toMatchObject({
      steps: ['step-1'],
      evidence: [sampleEvidence],
      status: 'running',
      pendingGate: { gateId: 'gate-1', reason: 'need approval' }
    });
  });

  it('updates status and clears pending gate when final_result arrives', () => {
    const states = [
      reduce(
        { ...initial(), pendingGate: { gateId: 'gate-1', reason: 'manual' }, steps: ['step-1'], evidence: [sampleEvidence] },
        { type: 'final_result', taskId: 'task-1', status: 'done' }
      ),
      reduce(
        { ...initial(), pendingGate: { gateId: 'gate-1', reason: 'manual' }, steps: ['step-1'], evidence: [sampleEvidence] },
        { type: 'final_result', taskId: 'task-1', status: 'failed' }
      ),
      reduce(
        { ...initial(), pendingGate: { gateId: 'gate-1', reason: 'manual' }, steps: ['step-1'], evidence: [sampleEvidence] },
        { type: 'final_result', taskId: 'task-1', status: 'blocked' }
      )
    ];

    expect(states[0].status).toBe('done');
    expect(states[0].pendingGate).toBeUndefined();
    expect(states[0].steps).toEqual(['step-1']);
    expect(states[0].evidence).toEqual([sampleEvidence]);

    expect(states[1].status).toBe('failed');
    expect(states[1].pendingGate).toBeUndefined();
    expect(states[1].steps).toEqual(['step-1']);
    expect(states[1].evidence).toEqual([sampleEvidence]);

    expect(states[2].status).toBe('blocked');
    expect(states[2].pendingGate).toBeUndefined();
    expect(states[2].steps).toEqual(['step-1']);
    expect(states[2].evidence).toEqual([sampleEvidence]);
  });

  it('returns unchanged state for unrelated events', () => {
    const base = initial();
    const toolEvent: KernelEvent = {
      type: 'tool_called',
      taskId: 'task-1',
      stepId: 'step-1',
      tool: 'bash'
    };
    const errorEvent: KernelEvent = {
      type: 'error',
      taskId: 'task-1',
      message: 'failed'
    };

    const afterTool = reduce(base, toolEvent);
    const afterError = reduce(base, errorEvent);

    expect(afterTool).toBe(base);
    expect(afterError).toBe(base);
  });

  it('does not mutate previous state object or arrays', () => {
    const base = initial();
    const stepEvent: KernelEvent = {
      type: 'step_started',
      taskId: 'task-1',
      stepId: 'step-1'
    };
    const evidenceEvent: KernelEvent = {
      type: 'evidence_produced',
      taskId: 'task-1',
      evidence: sampleEvidence
    };

    const afterStep = reduce(base, stepEvent);
    const afterEvidence = reduce(afterStep, evidenceEvent);

    expect(base.steps).toEqual([]);
    expect(base.evidence).toEqual([]);
    expect(afterStep.steps).toEqual(['step-1']);
    expect(afterEvidence.evidence).toEqual([sampleEvidence]);
    expect(afterStep.steps).not.toBe(base.steps);
    expect(afterEvidence.evidence).not.toBe(base.evidence);
    expect(afterEvidence.evidence).not.toBe(afterStep.evidence);
  });
});
