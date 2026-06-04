# M7 加固 Implementation Plan（Bobby v1）

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` 或 `superpowers:executing-plans`。
> 总纲：`2026-06-04-bobby-v1-master-plan.md`　前置：M0–M6 完成。

**Goal:** 把内核加固到可上线：错误/限流/重试、预算护栏接入循环、零默认遥测的隐私、完整配置系统（Key 入 OS keychain + 默认项 + 持久禁令库）、歧义追问、会话命令（answer/abort/getTrace）补全。

**Architecture:** 在已有模块外围加"健壮性环"——transport 退避重试、orchestrator 接预算护栏与持久禁令、KernelHost 补全会话命令、配置集中到 `~/.bobby`。

**Tech Stack:** TypeScript、Zod、Vitest、keytar（OS keychain）。

---

## 文件结构
- `src/model/deepseek/retry.ts` —— 退避重试包装 transport
- `src/config/config.ts` + `src/config/keychain.ts` —— 配置 + 安全 Key 存储
- `src/config/constraints-library.ts` —— 持久禁令库（长期"禁止X"）
- `src/brain/clarify.ts` —— 歧义打分 + 追问预算
- `src/telemetry/telemetry.ts` —— 默认关、opt-in
- Modify `src/host/kernel-host.ts` —— answer/abort/getTrace
- 各对应测试

---

## Task 1: 退避重试 + 限流（TDD）

**Files:** Create `src/model/deepseek/retry.ts`; Test `tests/retry.test.ts`

- [ ] **Step 1: 写失败测试**
```ts
// packages/kernel/tests/retry.test.ts
import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../src/model/deepseek/retry';
describe('withRetry', () => {
  it('429 重试后成功', async () => {
    const fn = vi.fn().mockRejectedValueOnce({ status: 429 }).mockResolvedValue('ok');
    expect(await withRetry(fn, { retries: 3, baseMs: 1 })).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('非可重试错误立即抛出', async () => {
    const fn = vi.fn().mockRejectedValue({ status: 400 });
    await expect(withRetry(fn, { retries: 3, baseMs: 1 })).rejects.toBeTruthy();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/model/deepseek/retry.ts
const RETRIABLE = new Set([429, 500, 502, 503, 504]);
export async function withRetry<T>(fn: () => Promise<T>, cfg: { retries: number; baseMs: number }): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= cfg.retries; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const status = (e as { status?: number }).status;
      if (status && !RETRIABLE.has(status)) throw e;
      if (i < cfg.retries) await new Promise((r) => setTimeout(r, cfg.baseMs * 2 ** i));
    }
  }
  throw lastErr;
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(deepseek): exponential backoff retry for transient errors"`

---

## Task 2: 配置系统 + Keychain（TDD）

**Files:** Create `src/config/config.ts`, `src/config/keychain.ts`; Test `tests/config.test.ts`

- [ ] **Step 1: 写失败测试（注入存储后端，不碰真实 keychain）**
```ts
// packages/kernel/tests/config.test.ts
import { describe, it, expect } from 'vitest';
import { Config } from '../src/config/config';

describe('Config', () => {
  it('默认值合理且可覆盖；Key 走安全后端不落明文', () => {
    const mem = new Map<string, string>();
    const cfg = new Config({ getSecret: async (k) => mem.get(k) ?? null, setSecret: async (k, v) => void mem.set(k, v) },
      { budgetUsd: 1, defaultPermission: 'L3' });
    expect(cfg.get('budgetUsd')).toBe(1);
    cfg.set('budgetUsd', 5); expect(cfg.get('budgetUsd')).toBe(5);
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/config/keychain.ts
export interface SecretStore { getSecret(key: string): Promise<string | null>; setSecret(key: string, val: string): Promise<void>; }
// 生产：用 keytar 实现 SecretStore（OS keychain）。⚠️ Key 绝不写入明文配置文件。
```
```ts
// packages/kernel/src/config/config.ts
import type { SecretStore } from './keychain';
export interface Settings { budgetUsd: number; defaultPermission: 'L0'|'L1'|'L2'|'L3'|'L4'; lang?: 'zh'|'en'; strongSandbox?: boolean; }
export class Config {
  constructor(private secrets: SecretStore, private settings: Settings) {}
  get<K extends keyof Settings>(k: K): Settings[K] { return this.settings[k]; }
  set<K extends keyof Settings>(k: K, v: Settings[K]) { this.settings[k] = v; }
  setApiKey(v: string) { return this.secrets.setSecret('deepseek_api_key', v); }
  getApiKey() { return this.secrets.getSecret('deepseek_api_key'); }
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(config): settings + keychain-backed API key (no plaintext)"`

---

## Task 3: 持久禁令库（长期"禁止X"每闸门复用）（TDD）

**Files:** Create `src/config/constraints-library.ts`; Test `tests/constraints-library.test.ts`

- [ ] **Step 1: 写失败测试**
```ts
// packages/kernel/tests/constraints-library.test.ts
import { describe, it, expect } from 'vitest';
import { ConstraintsLibrary } from '../src/config/constraints-library';
describe('持久禁令库', () => {
  it('长期禁令自动并入每个任务的契约', () => {
    const lib = new ConstraintsLibrary([{ id: 'G1', desc: '永远禁止改 .env', check: 'path:.env' }]);
    const merged = lib.applyTo({ goal: 'g', acceptanceCriteria: [{ id: 'AC1', desc: 'd', oracleHint: 'run' }], constraints: [], inputs: [], outOfScope: [] });
    expect(merged.constraints.some((c) => c.id === 'G1')).toBe(true);
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/config/constraints-library.ts
import type { Constraint, TaskContract } from '@bobby/shared';
export class ConstraintsLibrary {
  constructor(private global: Constraint[]) {}
  applyTo(contract: TaskContract): TaskContract {
    return { ...contract, constraints: [...this.global, ...contract.constraints] };
  }
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(config): persistent constraints library merged into every task"`

---

## Task 4: 歧义追问（补 M1 占位）（TDD）

**Files:** Create `src/brain/clarify.ts`; Test `tests/clarify.test.ts`

- [ ] **Step 1: 写失败测试**
```ts
// packages/kernel/tests/clarify.test.ts
import { describe, it, expect } from 'vitest';
import { needsClarification } from '../src/brain/clarify';
describe('歧义判定', () => {
  it('契约缺关键输入/范围模糊 → 需追问', () => {
    expect(needsClarification({ goal: '处理一下', acceptanceCriteria: [{ id: 'AC1', desc: '处理', oracleHint: 'review' }], constraints: [], inputs: [], outOfScope: [] }).should).toBe(true);
  });
  it('目标具体 + 有明确输入 + 可硬验 → 不追问', () => {
    expect(needsClarification({ goal: '把 a.csv 转 json', acceptanceCriteria: [{ id: 'AC1', desc: '生成 a.json', oracleHint: 'file' }], constraints: [], inputs: ['a.csv'], outOfScope: [] }).should).toBe(false);
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/brain/clarify.ts
import type { TaskContract } from '@bobby/shared';
export function needsClarification(c: TaskContract): { should: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (c.inputs.length === 0) reasons.push('缺明确输入');
  if (c.acceptanceCriteria.every((a) => a.oracleHint === 'review' || a.oracleHint === 'human')) reasons.push('无任何可硬验的验收标准');
  if (c.goal.length < 6) reasons.push('目标过于笼统');
  return { should: reasons.length >= 2, reasons }; // 阈值：≥2 个信号才追问，避免烦用户
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(brain): ambiguity scoring -> clarify decision with budget"`

---

## Task 5: 隐私（默认零遥测，opt-in）（TDD）

**Files:** Create `src/telemetry/telemetry.ts`; Test `tests/telemetry.test.ts`

- [ ] **Step 1: 写失败测试**
```ts
// packages/kernel/tests/telemetry.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Telemetry } from '../src/telemetry/telemetry';
describe('Telemetry', () => {
  it('默认关：不发送任何东西', () => {
    const sink = vi.fn(); new Telemetry({ enabled: false }, sink).track('task_done');
    expect(sink).not.toHaveBeenCalled();
  });
  it('显式 opt-in 后才发送', () => {
    const sink = vi.fn(); new Telemetry({ enabled: true }, sink).track('task_done');
    expect(sink).toHaveBeenCalledWith('task_done');
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/telemetry/telemetry.ts
export class Telemetry {
  constructor(private cfg: { enabled: boolean }, private sink: (e: string) => void) {}
  track(event: string) { if (this.cfg.enabled) this.sink(event); } // 默认 enabled=false
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(telemetry): opt-in only, zero data by default"`

---

## Task 6: 会话命令补全（answer/abort/getTrace）（TDD）

**Files:** Modify `src/host/kernel-host.ts`; Test `tests/kernel-host-session.test.ts`

- [ ] **Step 1: 写失败测试**
```ts
// packages/kernel/tests/kernel-host-session.test.ts
import { describe, it, expect } from 'vitest';
import { KernelHost } from '../src/host/kernel-host';
import { MockModelClient } from '../src/model/mock-model-client';
const cj = JSON.stringify({ goal: 'g', acceptanceCriteria: [{ id: 'AC1', desc: 'd', oracleHint: 'run' }], constraints: [], inputs: [], outOfScope: [] });
const sj = JSON.stringify([{ id: 'S1', desc: '做', satisfiesAcIds: ['AC1'], dependsOn: [] }]);
describe('会话命令', () => {
  it('getTrace 返回该任务的轨迹', async () => {
    const host = new KernelHost(() => new MockModelClient({ grader: [cj, sj], runner: ['ok'] }));
    let id = ''; host.subscribe((e) => { if (e.type === 'final_result') id = e.taskId; });
    await host.send({ type: 'startTask', input: 'x' });
    const trace = host.getTrace(id);
    expect(trace.length).toBeGreaterThan(0);
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 改实现**：`KernelHost` 持有 `Map<taskId, Orchestrator>`，`startTask` 记录之；新增 `getTrace(taskId)` 读 orchestrator.trace、`abort(taskId)`（设置中断标志，循环每步检查）、`answer(taskId, reply)`（喂给挂起的 clarify/gate）。
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(host): session commands answer/abort/getTrace"`

---

## ✅ M7 验收标准
- [ ] `pnpm -r test` 全绿。
- [ ] 429/5xx 退避重试，4xx 立即失败不空转。
- [ ] API Key 存 OS keychain，配置文件无明文。
- [ ] 持久禁令自动并入每个任务并在每个闸门复检。
- [ ] 预算超限抛错；遥测默认零数据、仅 opt-in。
- [ ] 歧义达阈值才追问（不烦用户）；`getTrace/abort/answer` 可用。

**M7 完成后 →** `bobby-m8-launch.md`。
