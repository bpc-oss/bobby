import { KernelEventSchema } from '@bobby/shared';
import { describe, expect, it } from 'vitest';

import type { ScriptStep } from '../src/kernel/mock/fixtures';
import { FIXTURES } from '../src/kernel/mock/fixtures';

function isKernelStep(step: ScriptStep): step is ScriptStep & { emit: { kind: 'kernel'; event: unknown } } {
  return step.emit.kind === 'kernel';
}

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
        if (isKernelStep(step)) {
          expect(() => KernelEventSchema.parse(step.emit.event)).not.toThrow();
        }
      }
    }
  });

  it('code-gate-evidence 含一次 gate_request，且其后存在 evidence_produced', () => {
    const steps = FIXTURES['code-gate-evidence'].steps;
    const gateIdx = steps.findIndex(
      (step) => isKernelStep(step) && step.emit.event.type === 'gate_request'
    );
    const evidenceIdx = steps.findIndex(
      (step) => isKernelStep(step) && step.emit.event.type === 'evidence_produced'
    );

    expect(gateIdx).toBeGreaterThan(-1);
    expect(evidenceIdx).toBeGreaterThan(gateIdx);
  });
});
