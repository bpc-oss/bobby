import { KernelEventSchema } from '@bobby/shared';
import { describe, expect, it } from 'vitest';

import type { ScriptStep } from '../src/kernel/mock/fixtures';
import { FIXTURES } from '../src/kernel/mock/fixtures';

function isKernelStep(step: ScriptStep): step is ScriptStep & { emit: { kind: 'kernel'; event: unknown } } {
  return step.emit.kind === 'kernel';
}

describe('mock fixtures', () => {
  it('contains the richer shell session set used by the mockup-aligned sidebar', () => {
    expect(Object.keys(FIXTURES)).toEqual([
      'chat-basic',
      'chat-pinned-deepseek',
      'chat-project-intro',
      'chat-project-review',
      'chat-today-electron',
      'chat-yesterday-pnpm',
      'chat-yesterday-zustand',
      'code-shell-p0',
      'code-gate-evidence',
      'loop-converge',
      'multi-session',
      'paper-tools-pdf',
      'paper-tools-release'
    ]);
  });

  it('all kernel steps still validate against the shared schema', () => {
    for (const script of Object.values(FIXTURES)) {
      for (const step of script.steps) {
        if (isKernelStep(step)) {
          expect(() => KernelEventSchema.parse(step.emit.event)).not.toThrow();
        }
      }
    }
  });

  it('code-gate-evidence still pauses at gate_request before later evidence appears', () => {
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
