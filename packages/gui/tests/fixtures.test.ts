import { KernelEventSchema } from '@bobby/shared';
import { describe, expect, it } from 'vitest';

import { FIXTURES } from '../src/kernel/mock/fixtures';

describe('mock fixtures', () => {
  it('包含 4 套剧本', () => {
    expect(Object.keys(FIXTURES)).toEqual([
      'chat-basic',
      'code-gate-evidence',
      'loop-converge',
      'multi-session'
    ]);
  });

  it('所有 kernel 步骤事件通过 shared schema 校验', () => {
    for (const script of Object.values(FIXTURES)) {
      for (const step of script.steps) {
        if (step.emit.kind === 'kernel') {
          expect(() => KernelEventSchema.parse(step.emit.event)).not.toThrow();
        }
      }
    }
  });

  it('code-gate-evidence 含一次 gate_request 且其后存在 evidence_produced', () => {
    const steps = FIXTURES['code-gate-evidence'].steps;
    const gateIdx = steps.findIndex(
      (step) => step.emit.kind === 'kernel' && step.emit.event.type === 'gate_request'
    );
    const evidenceIdx = steps.findIndex(
      (step) => step.emit.kind === 'kernel' && step.emit.event.type === 'evidence_produced'
    );

    expect(gateIdx).toBeGreaterThan(-1);
    expect(evidenceIdx).toBeGreaterThan(gateIdx);
  });
});
