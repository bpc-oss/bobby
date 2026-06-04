import type { Evidence } from '@bobby/shared';
import type { ToolRegistry } from './tool';
import type { ExecContext } from '../conscience/constraints';

export interface PlannedCall {
  tool: string;
  input: Record<string, unknown>;
}

export class ToolEvidenceProvider {
  private plans = new Map<string, PlannedCall[]>();
  private touched: string[] = [];

  constructor(private registry: ToolRegistry) {}

  plan(stepId: string, calls: PlannedCall[]): void {
    this.plans.set(stepId, calls);
  }

  async evidenceFor(stepId: string, acIds: string[]): Promise<Evidence[]> {
    if (acIds.length === 0) {
      throw new Error('acIds must include at least one acceptance criterion id');
    }

    const calls = this.plans.get(stepId) ?? [];
    const acId = acIds[0];
    const out: Evidence[] = [];

    for (const call of calls) {
      const res = await this.registry.get(call.tool).run(call.input, { acId, claimId: stepId });
      for (const evidence of res.evidence) {
        out.push(evidence);
        const path = (evidence.payload as { path?: unknown }).path;
        if (typeof path === 'string') {
          this.touched.push(path);
        }
      }
    }

    return out;
  }

  context(): ExecContext {
    return { touchedPaths: [...this.touched] };
  }
}
