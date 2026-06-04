import type { TaskContract, Verdict } from '@bobby/shared';
import type { ConstraintResult } from './constraints';

export interface GateResult {
  status: 'done' | 'failed' | 'blocked';
  reasons: string[];
}

export class CompletionGate {
  evaluate(contract: TaskContract, verdicts: Map<string, Verdict>, constraints: ConstraintResult[]): GateResult {
    const reasons: string[] = [];
    let failed = false;
    let blocked = false;

    for (const ac of contract.acceptanceCriteria) {
      const verdict = verdicts.get(ac.id);
      if (!verdict) {
        failed = true;
        reasons.push(`Missing verdict for AC ${ac.id}`);
        continue;
      }

      if (verdict.result === 'fail') {
        failed = true;
        reasons.push(`AC ${ac.id} failed: ${verdict.detail ?? 'no details provided'}`);
      } else if (verdict.result === 'need_human') {
        blocked = true;
        reasons.push(`AC ${ac.id} needs human confirmation`);
      }
    }

    for (const constraint of constraints) {
      if (constraint.result === 'fail') {
        failed = true;
        reasons.push(`Constraint ${constraint.id} failed: ${constraint.detail ?? 'no details provided'}`);
      } else if (constraint.result === 'need_human') {
        blocked = true;
        reasons.push(`Constraint ${constraint.id} needs human confirmation`);
      }
    }

    return {
      status: failed ? 'failed' : blocked ? 'blocked' : 'done',
      reasons
    };
  }
}

