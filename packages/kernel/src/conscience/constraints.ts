import type { Constraint } from '@bobby/shared';

export interface ExecContext {
  touchedPaths: string[];
  networkCalls?: string[];
}

export interface ConstraintResult {
  id: string;
  result: 'pass' | 'fail' | 'need_human';
  detail?: string;
}

export interface ConstraintChecker {
  matches(c: Constraint): boolean;
  check(c: Constraint, ctx: ExecContext): ConstraintResult;
}

export function isMachineCheckableConstraintCheck(check: string): boolean {
  return check.startsWith('path:');
}

export class NoForbiddenPathChecker implements ConstraintChecker {
  matches(c: Constraint): boolean {
    return isMachineCheckableConstraintCheck(c.check);
  }

  check(c: Constraint, ctx: ExecContext): ConstraintResult {
    const prefix = c.check.slice('path:'.length);
    const hit = ctx.touchedPaths.find((path) => path.startsWith(prefix));
    return hit
      ? { id: c.id, result: 'fail', detail: `Forbidden path touched: ${hit}` }
      : { id: c.id, result: 'pass' };
  }
}

export function enforceConstraints(
  constraints: Constraint[],
  ctx: ExecContext,
  checkers: ConstraintChecker[]
): ConstraintResult[] {
  return constraints.map((constraint) => {
    const checker = checkers.find((c) => c.matches(constraint));
    if (!checker) {
      return { id: constraint.id, result: 'need_human', detail: `No machine checker for constraint: ${constraint.check}` };
    }
    return checker.check(constraint, ctx);
  });
}
