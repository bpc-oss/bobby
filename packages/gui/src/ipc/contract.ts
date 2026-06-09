import type { GateDecision, KernelEvent } from '@bobby/shared';

export function makeKernelClient() {
  return {
    startTask: (input: string) => window.bobby.send({ type: 'startTask', input }),
    approveGate: (gateId: string, decision: GateDecision) =>
      window.bobby.send({ type: 'approveGate', gateId, decision }),
    onEvent: (cb: (event: KernelEvent) => void) => window.bobby.onEvent(cb)
  };
}
