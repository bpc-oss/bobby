export class BudgetGuard {
  private usd = 0;
  proCalls = 0;
  flashCalls = 0;

  constructor(private cfg: { maxUsd: number }) {}

  record(c: { usd: number; role: 'runner' | 'grader' }) {
    this.usd += c.usd;
    if (c.role === 'grader') {
      this.proCalls++;
    } else {
      this.flashCalls++;
    }
  }

  assertWithinBudget() {
    if (this.usd > this.cfg.maxUsd) {
      throw new Error(`budget exceeded: $${this.usd.toFixed(4)} > $${this.cfg.maxUsd}`);
    }
  }

  get spentUsd() {
    return this.usd;
  }
}
