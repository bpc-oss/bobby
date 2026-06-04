import type { Constraint, TaskContract } from '@bobby/shared';

export class ConstraintsLibrary {
  constructor(private readonly global: Constraint[]) {}

  applyTo(contract: TaskContract): TaskContract {
    return {
      ...contract,
      constraints: [...this.global, ...contract.constraints]
    };
  }
}
