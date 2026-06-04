# M2 良心引擎 Implementation Plan（Bobby v1）★ 灵魂里程碑

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` 或 `superpowers:executing-plans`。步骤用 `- [ ]` 跟踪。
> 总纲：`2026-06-04-bobby-v1-master-plan.md`　前置：M0、M1 已完成。

**Goal:** 实现"声称→证据→裁决"的验证引擎与**完成闸门**，让任务**只有在每条验收标准都拿到 pass 裁决、且全部禁令通过时**才允许 `done`。彻底铲除"自审总通过 / 没看完就说看完 / 违反禁令还谎称遵守"。

**Architecture:** 裁判（Oracle）分级 T0–T4，**优先用最硬的可用裁判**。证据来自工具/沙箱直出（M0 schema），裁判只读证据不读模型自述（守 L1/L2）。VerificationEngine 按证据类型选裁判出裁决；CompletionGate 汇总裁决 + 禁令校验给最终状态；最后接入 M1 编排器循环末尾。

**Tech Stack:** TypeScript、Zod、Vitest；`@bobby/kernel` 内新增 `conscience/`。

---

## 文件结构（本里程碑创建/修改）
- `src/conscience/oracle.ts` —— Oracle 接口 + tier 排序
- `src/conscience/oracles/deterministic.ts` —— T0：退出码 / 文件存在
- `src/conscience/oracles/coverage.ts` —— T3：覆盖率（反偷懒）
- `src/conscience/oracles/pro-review.ts` —— T2：Pro 对抗审查
- `src/conscience/engine.ts` —— VerificationEngine（选裁判 + 出裁决）
- `src/conscience/constraints.ts` —— 禁令校验器 + 执行上下文
- `src/conscience/gate.ts` —— CompletionGate（最终放行/拦截）
- Modify `src/brain/orchestrator.ts` —— 把闸门插进循环末尾
- 各对应 `tests/*.test.ts`

---

## Task 1: Oracle 接口 + tier 排序（TDD）

**Files:** Create `src/conscience/oracle.ts`; Test `tests/oracle.test.ts`

- [ ] **Step 1: 写失败测试**
```ts
// packages/kernel/tests/oracle.test.ts
import { describe, it, expect } from 'vitest';
import { tierRank } from '../src/conscience/oracle';

describe('tierRank', () => {
  it('T0 最硬（rank 最小），T4 最软', () => {
    expect(tierRank('T0')).toBeLessThan(tierRank('T2'));
    expect(tierRank('T2')).toBeLessThan(tierRank('T4'));
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/conscience/oracle.ts
import type { AcceptanceCriterion, Evidence, OracleTier, Verdict } from '@bobby/shared';

export interface Oracle {
  readonly tier: OracleTier;
  readonly name: string;
  canJudge(ac: AcceptanceCriterion, evidence: Evidence[]): boolean;
  judge(ac: AcceptanceCriterion, evidence: Evidence[]): Promise<Verdict>;
}
const ORDER: OracleTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
export function tierRank(t: OracleTier): number { return ORDER.indexOf(t); }
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(conscience): Oracle interface + tier ranking"`

---

## Task 2: T0 确定性裁判（退出码 / 文件存在）（TDD）

**Files:** Create `src/conscience/oracles/deterministic.ts`; Test `tests/deterministic-oracle.test.ts`

- [ ] **Step 1: 写失败测试**
```ts
// packages/kernel/tests/deterministic-oracle.test.ts
import { describe, it, expect } from 'vitest';
import { CommandExitOracle, FileExistsOracle } from '../src/conscience/oracles/deterministic';
import type { AcceptanceCriterion, Evidence } from '@bobby/shared';

const ac: AcceptanceCriterion = { id: 'AC1', desc: 'd', oracleHint: 'run' };
const ev = (t: Evidence['evidenceType'], payload: Record<string, unknown>): Evidence =>
  ({ claimId: 'c', acId: 'AC1', evidenceType: t, payload, producedBy: 'tool' });

describe('CommandExitOracle', () => {
  const o = new CommandExitOracle();
  it('退出码 0 → pass', async () => {
    expect((await o.judge(ac, [ev('command_output', { exitCode: 0 })])).result).toBe('pass');
  });
  it('退出码非 0 → fail（模型嘴硬也没用）', async () => {
    expect((await o.judge(ac, [ev('command_output', { exitCode: 1, stderr: 'boom' })])).result).toBe('fail');
  });
});

describe('FileExistsOracle', () => {
  const o = new FileExistsOracle();
  it('文件不存在 → fail', async () => {
    expect((await o.judge(ac, [ev('file_exists', { exists: false })])).result).toBe('fail');
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/conscience/oracles/deterministic.ts
import type { AcceptanceCriterion, Evidence, Verdict } from '@bobby/shared';
import type { Oracle } from '../oracle';

export class CommandExitOracle implements Oracle {
  readonly tier = 'T0' as const; readonly name = 'command-exit';
  canJudge(_ac: AcceptanceCriterion, ev: Evidence[]) { return ev.some((e) => e.evidenceType === 'command_output'); }
  async judge(ac: AcceptanceCriterion, ev: Evidence[]): Promise<Verdict> {
    const cmds = ev.filter((e) => e.evidenceType === 'command_output');
    const bad = cmds.find((e) => (e.payload as { exitCode?: number }).exitCode !== 0);
    return { claimId: cmds[0]?.claimId ?? 'n/a', acId: ac.id, oracleTier: 'T0',
      result: bad ? 'fail' : 'pass', detail: bad ? `非零退出码: ${JSON.stringify(bad.payload)}` : undefined };
  }
}

export class FileExistsOracle implements Oracle {
  readonly tier = 'T0' as const; readonly name = 'file-exists';
  canJudge(_ac: AcceptanceCriterion, ev: Evidence[]) { return ev.some((e) => e.evidenceType === 'file_exists'); }
  async judge(ac: AcceptanceCriterion, ev: Evidence[]): Promise<Verdict> {
    const f = ev.filter((e) => e.evidenceType === 'file_exists');
    const missing = f.find((e) => (e.payload as { exists?: boolean }).exists !== true);
    return { claimId: f[0]?.claimId ?? 'n/a', acId: ac.id, oracleTier: 'T0',
      result: missing ? 'fail' : 'pass', detail: missing ? `文件不存在: ${JSON.stringify(missing.payload)}` : undefined };
  }
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(conscience): T0 deterministic oracles (exit code, file exists)"`

---

## Task 3: T3 覆盖率裁判（反偷懒）（TDD）

**Files:** Create `src/conscience/oracles/coverage.ts`; Test `tests/coverage-oracle.test.ts`

- [ ] **Step 1: 写失败测试**
```ts
// packages/kernel/tests/coverage-oracle.test.ts
import { describe, it, expect } from 'vitest';
import { CoverageOracle } from '../src/conscience/oracles/coverage';
import type { AcceptanceCriterion, Evidence } from '@bobby/shared';

const ac: AcceptanceCriterion = { id: 'AC1', desc: '逐行检查 3 条', oracleHint: 'review' };
const ev = (payload: Record<string, unknown>): Evidence =>
  ({ claimId: 'c', acId: 'AC1', evidenceType: 'quote_with_location', payload, producedBy: 'tool' });

describe('CoverageOracle', () => {
  const o = new CoverageOracle();
  it('逐项留痕齐全（covered=expected）→ pass', async () => {
    const items = [{ loc: 'L1', note: 'ok' }, { loc: 'L2', note: 'ok' }, { loc: 'L3', note: 'ok' }];
    expect((await o.judge(ac, [ev({ items, expected: 3 })])).result).toBe('pass');
  });
  it('没看完（covered<expected）→ fail（守反偷懒 L3）', async () => {
    const items = [{ loc: 'L1', note: 'ok' }];
    const v = await o.judge(ac, [ev({ items, expected: 3 })]);
    expect(v.result).toBe('fail');
    expect(v.detail).toContain('覆盖率');
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/conscience/oracles/coverage.ts
import type { AcceptanceCriterion, Evidence, Verdict } from '@bobby/shared';
import type { Oracle } from '../oracle';

interface CoveragePayload { items: { loc: string; note: string }[]; expected: number; }

export class CoverageOracle implements Oracle {
  readonly tier = 'T3' as const; readonly name = 'coverage';
  canJudge(_ac: AcceptanceCriterion, ev: Evidence[]) { return ev.some((e) => e.evidenceType === 'quote_with_location'); }
  async judge(ac: AcceptanceCriterion, ev: Evidence[]): Promise<Verdict> {
    const e = ev.find((x) => x.evidenceType === 'quote_with_location');
    const p = (e?.payload ?? { items: [], expected: 1 }) as CoveragePayload;
    const covered = p.items.filter((i) => i.loc && i.note).length;
    const pass = covered >= p.expected && p.expected > 0;
    return { claimId: e?.claimId ?? 'n/a', acId: ac.id, oracleTier: 'T3',
      result: pass ? 'pass' : 'fail',
      detail: pass ? undefined : `覆盖率不足: ${covered}/${p.expected}（漏看必然缺证据）` };
  }
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(conscience): T3 coverage oracle (anti-skimming)"`

---

## Task 4: T2 Pro 对抗审查裁判（TDD）

**Files:** Create `src/conscience/oracles/pro-review.ts`; Test `tests/pro-review-oracle.test.ts`

- [ ] **Step 1: 写失败测试**
```ts
// packages/kernel/tests/pro-review-oracle.test.ts
import { describe, it, expect } from 'vitest';
import { ProReviewOracle } from '../src/conscience/oracles/pro-review';
import { MockModelClient } from '../src/model/mock-model-client';
import type { AcceptanceCriterion, Evidence } from '@bobby/shared';

const ac: AcceptanceCriterion = { id: 'AC1', desc: '逻辑正确', oracleHint: 'review' };
const ev: Evidence[] = [{ claimId: 'c', acId: 'AC1', evidenceType: 'file_diff', payload: { diff: '...' }, producedBy: 'tool' }];

describe('ProReviewOracle', () => {
  it('Pro 发现 critical 缺陷 → fail', async () => {
    const review = JSON.stringify({ verdict: 'fail', defects: [{ severity: 'critical', acId: 'AC1', evidence: '第3行越界', mustFix: true }], unverifiable: [] });
    const o = new ProReviewOracle(new MockModelClient({ grader: [review], runner: [] }));
    expect((await o.judge(ac, ev)).result).toBe('fail');
  });
  it('Pro 说不准 → need_human（不蒙混）', async () => {
    const review = JSON.stringify({ verdict: 'pass', defects: [], unverifiable: ['无法判断业务含义'] });
    const o = new ProReviewOracle(new MockModelClient({ grader: [review], runner: [] }));
    expect((await o.judge(ac, ev)).result).toBe('need_human');
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/conscience/oracles/pro-review.ts
import { z } from 'zod';
import type { AcceptanceCriterion, Evidence, Verdict } from '@bobby/shared';
import type { Oracle } from '../oracle';
import type { ModelClient } from '../../model/model-client';

const ReviewSchema = z.object({
  verdict: z.enum(['pass', 'fail']),
  defects: z.array(z.object({ severity: z.enum(['critical', 'high', 'medium']), acId: z.string(), evidence: z.string(), mustFix: z.boolean() })),
  unverifiable: z.array(z.string()).default([]),
});

const SYS = `你是带敌意的审查者(Pro)。默认产物存在缺陷，尽力证伪它满足了验收标准。
只读验收标准与真实产物（diff/输出/文件），不读执行者的辩解。输出 JSON：
{verdict:'pass'|'fail', defects:[{severity,acId,evidence,mustFix}], unverifiable:[...]}。`;

export class ProReviewOracle implements Oracle {
  readonly tier = 'T2' as const; readonly name = 'pro-review';
  constructor(private model: ModelClient) {}
  canJudge(ac: AcceptanceCriterion, ev: Evidence[]) { return ac.oracleHint === 'review' || ev.some((e) => e.evidenceType === 'file_diff'); }
  async judge(ac: AcceptanceCriterion, ev: Evidence[]): Promise<Verdict> {
    const res = await this.model.complete('grader', [
      { role: 'system', content: SYS },
      { role: 'user', content: JSON.stringify({ ac, evidence: ev }) },
    ], { json: true });
    const r = ReviewSchema.parse(JSON.parse(res.content));
    const blocking = r.defects.some((d) => d.severity === 'critical' || d.severity === 'high');
    const result: Verdict['result'] = blocking || r.verdict === 'fail' ? 'fail'
      : r.unverifiable.length > 0 ? 'need_human' : 'pass';
    return { claimId: ev[0]?.claimId ?? 'n/a', acId: ac.id, oracleTier: 'T2', result,
      detail: result === 'pass' ? undefined : JSON.stringify({ defects: r.defects, unverifiable: r.unverifiable }) };
  }
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(conscience): T2 Pro adversarial review oracle"`

---

## Task 5: VerificationEngine（选最硬可用裁判）（TDD）

**Files:** Create `src/conscience/engine.ts`; Test `tests/engine.test.ts`

- [ ] **Step 1: 写失败测试**
```ts
// packages/kernel/tests/engine.test.ts
import { describe, it, expect } from 'vitest';
import { VerificationEngine } from '../src/conscience/engine';
import { CommandExitOracle, FileExistsOracle } from '../src/conscience/oracles/deterministic';
import { CoverageOracle } from '../src/conscience/oracles/coverage';
import type { AcceptanceCriterion, Evidence } from '@bobby/shared';

const ac: AcceptanceCriterion = { id: 'AC1', desc: 'd', oracleHint: 'run' };
const ev = (t: Evidence['evidenceType'], payload: Record<string, unknown>): Evidence =>
  ({ claimId: 'c', acId: 'AC1', evidenceType: t, payload, producedBy: 'tool' });

describe('VerificationEngine', () => {
  const engine = new VerificationEngine([new CommandExitOracle(), new FileExistsOracle(), new CoverageOracle()]);

  it('有确定性证据时优先用 T0', async () => {
    const v = await engine.verify(ac, [ev('command_output', { exitCode: 0 })]);
    expect(v.oracleTier).toBe('T0');
    expect(v.result).toBe('pass');
  });
  it('没有任何可用裁判 → 抛错（守 L6：不许裸奔放行）', async () => {
    await expect(engine.verify(ac, [ev('pro_review', {})])).rejects.toThrow(/no oracle/i);
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/conscience/engine.ts
import type { AcceptanceCriterion, Evidence, Verdict } from '@bobby/shared';
import { type Oracle, tierRank } from './oracle';

export class VerificationEngine {
  constructor(private oracles: Oracle[]) {}
  async verify(ac: AcceptanceCriterion, allEvidence: Evidence[]): Promise<Verdict> {
    const evidence = allEvidence.filter((e) => e.acId === ac.id);
    const usable = this.oracles.filter((o) => o.canJudge(ac, evidence)).sort((a, b) => tierRank(a.tier) - tierRank(b.tier));
    if (usable.length === 0) throw new Error(`no oracle can judge AC ${ac.id} (L6: refuse to pass unverifiable)`);
    return usable[0].judge(ac, evidence); // 用最硬（tier 最小）的裁判
  }
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(conscience): VerificationEngine picks hardest usable oracle"`

---

## Task 6: 禁令校验（针对"明令禁止仍违反"）（TDD）

**Files:** Create `src/conscience/constraints.ts`; Test `tests/constraints.test.ts`

- [ ] **Step 1: 写失败测试**
```ts
// packages/kernel/tests/constraints.test.ts
import { describe, it, expect } from 'vitest';
import { NoForbiddenPathChecker, enforceConstraints } from '../src/conscience/constraints';
import type { Constraint } from '@bobby/shared';

const c: Constraint = { id: 'C1', desc: '禁止改动 legacy', check: 'path:src/legacy/' };

describe('禁令校验', () => {
  it('碰了禁区 → fail', () => {
    const r = enforceConstraints([c], { touchedPaths: ['src/legacy/a.ts'] }, [new NoForbiddenPathChecker()]);
    expect(r[0].result).toBe('fail');
  });
  it('没碰禁区 → pass', () => {
    const r = enforceConstraints([c], { touchedPaths: ['src/app.ts'] }, [new NoForbiddenPathChecker()]);
    expect(r[0].result).toBe('pass');
  });
  it('无机器校验器的禁令 → need_human（转人类，不假装遵守）', () => {
    const weird: Constraint = { id: 'C2', desc: '保持优雅', check: 'vibe' };
    const r = enforceConstraints([weird], { touchedPaths: [] }, [new NoForbiddenPathChecker()]);
    expect(r[0].result).toBe('need_human');
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/conscience/constraints.ts
import type { Constraint } from '@bobby/shared';

export interface ExecContext { touchedPaths: string[]; networkCalls?: string[]; }
export interface ConstraintResult { id: string; result: 'pass' | 'fail' | 'need_human'; detail?: string; }
export interface ConstraintChecker { matches(c: Constraint): boolean; check(c: Constraint, ctx: ExecContext): ConstraintResult; }

export class NoForbiddenPathChecker implements ConstraintChecker {
  matches(c: Constraint) { return c.check.startsWith('path:'); }
  check(c: Constraint, ctx: ExecContext): ConstraintResult {
    const prefix = c.check.slice('path:'.length);
    const hit = ctx.touchedPaths.find((p) => p.startsWith(prefix));
    return { id: c.id, result: hit ? 'fail' : 'pass', detail: hit ? `触碰禁区: ${hit}` : undefined };
  }
}

export function enforceConstraints(cs: Constraint[], ctx: ExecContext, checkers: ConstraintChecker[]): ConstraintResult[] {
  return cs.map((c) => {
    const checker = checkers.find((k) => k.matches(c));
    if (!checker) return { id: c.id, result: 'need_human', detail: `禁令 ${c.id} 无机器校验器，转人类（不假装遵守，守 L7）` };
    return checker.check(c, ctx);
  });
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(conscience): constraint enforcement with human escalation"`

---

## Task 7: CompletionGate（最终放行/拦截）（TDD）★

**Files:** Create `src/conscience/gate.ts`; Test `tests/gate.test.ts`

- [ ] **Step 1: 写失败测试（含反蒙混核心用例）**
```ts
// packages/kernel/tests/gate.test.ts
import { describe, it, expect } from 'vitest';
import { CompletionGate } from '../src/conscience/gate';
import type { TaskContract, Verdict } from '@bobby/shared';

const contract: TaskContract = {
  goal: 'g', acceptanceCriteria: [{ id: 'AC1', desc: 'd', oracleHint: 'run' }],
  constraints: [], inputs: [], outOfScope: [],
};
const v = (result: Verdict['result']): Verdict => ({ claimId: 'c', acId: 'AC1', result, oracleTier: 'T0' });

describe('CompletionGate', () => {
  const gate = new CompletionGate();
  it('全部 pass + 禁令通过 → done', () => {
    expect(gate.evaluate(contract, new Map([['AC1', v('pass')]]), []).status).toBe('done');
  });
  it('有 AC 失败 → failed（绝不 done）', () => {
    expect(gate.evaluate(contract, new Map([['AC1', v('fail')]]), []).status).toBe('failed');
  });
  it('缺某条 AC 的裁决 → failed（没证据不许过）', () => {
    expect(gate.evaluate(contract, new Map(), []).status).toBe('failed');
  });
  it('有 need_human → blocked（升级人类，不蒙混）', () => {
    expect(gate.evaluate(contract, new Map([['AC1', v('need_human')]]), []).status).toBe('blocked');
  });
  it('禁令 fail → failed（即便 AC 全过）', () => {
    const r = gate.evaluate(contract, new Map([['AC1', v('pass')]]), [{ id: 'C1', result: 'fail' }]);
    expect(r.status).toBe('failed');
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/conscience/gate.ts
import type { TaskContract, Verdict } from '@bobby/shared';
import type { ConstraintResult } from './constraints';

export interface GateResult { status: 'done' | 'failed' | 'blocked'; reasons: string[]; }

export class CompletionGate {
  evaluate(contract: TaskContract, verdicts: Map<string, Verdict>, constraints: ConstraintResult[]): GateResult {
    const reasons: string[] = [];
    let needHuman = false, failed = false;
    for (const ac of contract.acceptanceCriteria) {
      const v = verdicts.get(ac.id);
      if (!v) { failed = true; reasons.push(`AC ${ac.id} 无裁决（缺证据）`); continue; }
      if (v.result === 'fail') { failed = true; reasons.push(`AC ${ac.id} 未通过: ${v.detail ?? ''}`); }
      if (v.result === 'need_human') { needHuman = true; reasons.push(`AC ${ac.id} 需人类确认`); }
    }
    for (const c of constraints) {
      if (c.result === 'fail') { failed = true; reasons.push(`禁令 ${c.id} 违反: ${c.detail ?? ''}`); }
      if (c.result === 'need_human') { needHuman = true; reasons.push(`禁令 ${c.id} 需人类确认`); }
    }
    // 优先级：任何 fail → failed；否则有 need_human → blocked；否则 done。
    const status: GateResult['status'] = failed ? 'failed' : needHuman ? 'blocked' : 'done';
    return { status, reasons };
  }
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(conscience): CompletionGate — no done without all-pass + constraints"`

---

## Task 8: 把闸门插进编排器（替换 M1 的占位 done）（TDD）

**Files:** Modify `src/brain/orchestrator.ts`; Test `tests/orchestrator-gated.test.ts`

- [ ] **Step 1: 写失败测试（端到端反蒙混）**
```ts
// packages/kernel/tests/orchestrator-gated.test.ts
import { describe, it, expect } from 'vitest';
import { Orchestrator } from '../src/brain/orchestrator';
import { VerificationEngine } from '../src/conscience/engine';
import { CommandExitOracle } from '../src/conscience/oracles/deterministic';
import { CompletionGate } from '../src/conscience/gate';
import { MockModelClient } from '../src/model/mock-model-client';
import type { Evidence } from '@bobby/shared';

const contractJson = JSON.stringify({ goal: 'g', acceptanceCriteria: [{ id: 'AC1', desc: 'd', oracleHint: 'run' }], constraints: [], inputs: [], outOfScope: [] });
const stepsJson = JSON.stringify([{ id: 'S1', desc: '做事', satisfiesAcIds: ['AC1'], dependsOn: [] }]);

function makeOrch(exitCode: number) {
  const model = new MockModelClient({ grader: [contractJson, stepsJson], runner: ['做完了'] });
  const engine = new VerificationEngine([new CommandExitOracle()]);
  // 注入"步骤证据提供者"：M3 会换成真实工具，这里用真实退出码模拟
  const evidenceFor = (): Evidence[] => [{ claimId: 'c', acId: 'AC1', evidenceType: 'command_output', payload: { exitCode }, producedBy: 'tool' }];
  return new Orchestrator(model, { engine, gate: new CompletionGate(), evidenceFor });
}

describe('Orchestrator + 闸门', () => {
  it('证据为真（exit 0）→ done', async () => {
    const o = makeOrch(0); let final = '';
    o.on((e) => { if (e.type === 'final_result') final = e.status; });
    await o.startTask('x'); expect(final).toBe('done');
  });
  it('证据打脸（exit 1）→ failed，即使模型声称做完了（守反蒙混）', async () => {
    const o = makeOrch(1); let final = '';
    o.on((e) => { if (e.type === 'final_result') final = e.status; });
    await o.startTask('x'); expect(final).toBe('failed');
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL（Orchestrator 构造签名不符）
- [ ] **Step 3: 改实现（替换 Task M1.6 的 startTask 末段）**
```ts
// packages/kernel/src/brain/orchestrator.ts （新增依赖与构造参数，循环末尾接闸门）
import { randomUUID } from 'node:crypto';
import type { Evidence, KernelEvent, Verdict } from '@bobby/shared';
import type { ModelClient } from '../model/model-client';
import { captureIntent } from './intent';
import { planTask } from './planner';
import { executeStep } from './executor';
import { TraceStore } from '../trace/trace-store';
import type { VerificationEngine } from '../conscience/engine';
import type { CompletionGate } from '../conscience/gate';

type Listener = (e: KernelEvent) => void;
export interface ConscienceDeps {
  engine: VerificationEngine;
  gate: CompletionGate;
  evidenceFor: (stepId: string, acIds: string[]) => Evidence[] | Promise<Evidence[]>; // M3 提供真实工具证据
}

export class Orchestrator {
  readonly trace = new TraceStore();
  private listeners = new Set<Listener>();
  constructor(private model: ModelClient, private conscience?: ConscienceDeps) {}
  on(fn: Listener) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit(taskId: string, e: KernelEvent) { this.trace.append(taskId, e); for (const fn of this.listeners) fn(e); }

  async startTask(input: string): Promise<string> {
    const taskId = randomUUID();
    const contract = await captureIntent(this.model, input);
    this.emit(taskId, { type: 'intent_proposed', taskId, contract });
    const steps = await planTask(this.model, contract);
    this.emit(taskId, { type: 'plan_ready', taskId, steps });

    const verdicts = new Map<string, Verdict>();
    for (const step of steps) {
      this.emit(taskId, { type: 'step_started', taskId, stepId: step.id });
      await executeStep(this.model, step);
      if (this.conscience) {
        const evidence = await this.conscience.evidenceFor(step.id, step.satisfiesAcIds);
        for (const e of evidence) this.emit(taskId, { type: 'evidence_produced', taskId, evidence: e });
        for (const ac of contract.acceptanceCriteria.filter((a) => step.satisfiesAcIds.includes(a.id))) {
          const v = await this.conscience.engine.verify(ac, evidence);
          verdicts.set(ac.id, v);
          this.emit(taskId, { type: 'verdict', taskId, verdict: v });
        }
      }
    }

    let status: 'done' | 'failed' | 'blocked' = 'failed';
    if (this.conscience) status = this.conscience.gate.evaluate(contract, verdicts, []).status; // 禁令在 M3 接真实上下文
    this.emit(taskId, { type: 'final_result', taskId, status });
    return taskId;
  }
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS（M1 的 `orchestrator.test.ts` 仍应通过：无 conscience 时 final=failed）
- [ ] **Step 5: 提交** — `git commit -am "feat(conscience): wire CompletionGate + engine into orchestrator loop"`

---

## ✅ M2 验收标准（灵魂里程碑，必须全绿）
- [ ] `pnpm --filter @bobby/kernel test` 全绿。
- [ ] **反蒙混端到端**：模型声称"做完了"但证据退出码非 0 → `final_result=failed`（Task 8 用例）。
- [ ] **反偷懒**：覆盖率 < expected → fail（Task 3）。
- [ ] **反违禁**：触碰禁区 → fail；无机器校验器的禁令 → need_human（Task 6）。
- [ ] **不许裸奔**：无任何可用裁判 → 抛错，绝不默认通过（Task 5）。
- [ ] **闸门铁律**：缺裁决 / 任一 fail → 永不 `done`；有 need_human → `blocked`（Task 7）。
- [ ] 出题人 ≠ 阅卷人：Pro 审查只读验收标准 + 真实产物，不读执行者自述（Task 4）。

**M2 完成后 →** `bobby-m3-hands.md`（提供真实工具证据与禁令执行上下文，把 `evidenceFor` 从模拟换成真实沙箱产物）。
