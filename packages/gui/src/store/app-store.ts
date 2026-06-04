import type { Evidence, KernelEvent } from '@bobby/shared';

export interface AppState {
  steps: string[];
  evidence: Evidence[];
  status: string;
  pendingGate?: { gateId: string; reason: string };
}

export const initial = (): AppState => ({
  steps: [],
  evidence: [],
  status: 'running'
});

export function reduce(s: AppState, e: KernelEvent): AppState {
  switch (e.type) {
    case 'step_started':
      return {
        ...s,
        steps: [...s.steps, e.stepId]
      };
    case 'evidence_produced':
      return {
        ...s,
        evidence: [...s.evidence, e.evidence]
      };
    case 'gate_request':
      return {
        ...s,
        pendingGate: {
          gateId: e.gateId,
          reason: e.reason
        }
      };
    case 'final_result':
      return {
        ...s,
        status: e.status,
        pendingGate: undefined
      };
    default:
      return s;
  }
}
