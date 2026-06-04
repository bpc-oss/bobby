import { describe, expect, it } from 'vitest';

import { initialVM, reduceEvent } from '../src/ui/view-model';

describe('view-model', () => {
  it('step_started then final_result produces line and status', () => {
    let vm = initialVM();
    vm = reduceEvent(vm, { type: 'step_started', taskId: 'task-1', stepId: 'S1' });
    vm = reduceEvent(vm, { type: 'final_result', taskId: 'task-1', status: 'done' });
    expect(vm.status).toBe('done');
    expect(vm.lines.some((line) => line.includes('S1'))).toBe(true);
    expect(vm.lines.some((line) => line.includes('done'))).toBe(true);
  });

  it('final_result failed keeps failed status', () => {
    const vm = reduceEvent(initialVM(), { type: 'final_result', taskId: 'task-1', status: 'failed' });
    expect(vm.status).toBe('failed');
    expect(vm.lines.some((line) => line.includes('failed'))).toBe(true);
  });

  it('gate_request updates pendingGate', () => {
    const vm = reduceEvent(
      initialVM(),
      { type: 'gate_request', taskId: 'task-1', gateId: 'g1', reason: '需要联网权限' }
    );
    expect(vm.pendingGate).toEqual({
      gateId: 'g1',
      reason: '需要联网权限'
    });
  });

  it('evidence_produced includes evidenceType and acId', () => {
    const vm = reduceEvent(initialVM(), {
      type: 'evidence_produced',
      taskId: 'task-1',
      evidence: {
        claimId: 'C1',
        acId: 'AC-1',
        evidenceType: 'file_diff',
        payload: { ok: true },
        producedBy: 'tool'
      }
    });
    expect(vm.lines.some((line) => line.includes('file_diff'))).toBe(true);
    expect(vm.lines.some((line) => line.includes('AC-1'))).toBe(true);
  });
});
