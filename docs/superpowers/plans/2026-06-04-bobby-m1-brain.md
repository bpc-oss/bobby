# M1 大脑最小闭环 Implementation Plan（Bobby v1）

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` 或 `superpowers:executing-plans`。步骤用 `- [ ]` 跟踪。
> 总纲：`2026-06-04-bobby-v1-master-plan.md`　前置：M0 已完成。

**Goal:** 在 M0 契约之上，跑通"用户输入 → 意图捕获(《意图契约》) → Pro 规划(步骤 DAG) → Flash 执行 → 轨迹"的最小闭环，全程发 Kernel 事件。

**Architecture:** 引入**provider 中立的 `ModelClient` 抽象**（runner=Flash / grader=Pro 两个角色），用 `MockModelClient` 做 TDD，与真实 DeepSeek 解耦（真实接入在 M6）。本里程碑**不做验证**（M2 接入完成闸门），步骤执行后先发 Claim 占位。

**Tech Stack:** TypeScript、Zod、Vitest；`@bobby/kernel` 内新增模块。

---

## 文件结构（本里程碑创建）
- `packages/kernel/src/model/model-client.ts` —— ModelClient 接口 + 角色 + 消息/响应类型
- `packages/kernel/src/model/mock-model-client.ts` —— 测试用可编程 mock
- `packages/kernel/src/brain/intent.ts` —— 意图捕获 → TaskContract
- `packages/kernel/src/brain/planner.ts` —— TaskContract → PlanStep[]
- `packages/kernel/src/brain/executor.ts` —— 执行一步 → Claim
- `packages/kernel/src/brain/orchestrator.ts` —— 状态机 + 事件发射 + 轨迹
- `packages/kernel/src/trace/trace-store.ts` —— append-only 轨迹
- 各对应 `tests/*.test.ts`

---

## Task 1: ModelClient 抽象 + Mock（TDD）

**Files:** Create `src/model/model-client.ts`, `src/model/mock-model-client.ts`; Test `tests/mock-model-client.test.ts`

- [ ] **Step 1: 写失败测试**
```ts
// packages/kernel/tests/mock-model-client.test.ts
import { describe, it, expect } from 'vitest';
import { MockModelClient } from '../src/model/mock-model-client';

describe('MockModelClient', () => {
  it('按角色返回预设响应', async () => {
    const m = new MockModelClient({ grader: ['{"ok":true}'], runner: ['done'] });
    expect((await m.complete('grader', [{ role: 'user', content: 'hi' }])).content).toBe('{"ok":true}');
    expect((await m.complete('runner', [{ role: 'user', content: 'go' }])).content).toBe('done');
  });
  it('用尽预设后抛错，避免测试静默通过', async () => {
    const m = new MockModelClient({ grader: [], runner: [] });
    await expect(m.complete('grader', [])).rejects.toThrow();
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — `pnpm --filter @bobby/kernel test` → FAIL（模块不存在）
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/model/model-client.ts
export type ModelRole = 'runner' | 'grader'; // Flash | Pro
export interface ModelMessage { role: 'system' | 'user' | 'assistant'; content: string; }
export interface ModelResponse { content: string; raw?: unknown; }
export interface ModelClient {
  complete(role: ModelRole, messages: ModelMessage[], opts?: { json?: boolean }): Promise<ModelResponse>;
}
```
```ts
// packages/kernel/src/model/mock-model-client.ts
import type { ModelClient, ModelMessage, ModelRole, ModelResponse } from './model-client';
export class MockModelClient implements ModelClient {
  constructor(private queues: Record<ModelRole, string[]>) {}
  async complete(role: ModelRole, _m: ModelMessage[]): Promise<ModelResponse> {
    const q = this.queues[role];
    if (!q || q.length === 0) throw new Error(`MockModelClient: no queued response for role ${role}`);
    return { content: q.shift()! };
  }
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(kernel): add ModelClient abstraction + MockModelClient"`

---

## Task 2: 意图捕获 → TaskContract（TDD）

**Files:** Create `src/brain/intent.ts`; Test `tests/intent.test.ts`

- [ ] **Step 1: 写失败测试**
```ts
// packages/kernel/tests/intent.test.ts
import { describe, it, expect } from 'vitest';
import { captureIntent } from '../src/brain/intent';
import { MockModelClient } from '../src/model/mock-model-client';

const contractJson = JSON.stringify({
  goal: '整理下载文件夹', acceptanceCriteria: [{ id: 'AC1', desc: '按类型分好子目录', oracleHint: 'file' }],
  constraints: [], inputs: ['~/Downloads'], outOfScope: [],
});

describe('captureIntent', () => {
  it('把人话解析成合法 TaskContract（grader=Pro 出结构化）', async () => {
    const m = new MockModelClient({ grader: [contractJson], runner: [] });
    const c = await captureIntent(m, '帮我把下载文件夹整理一下');
    expect(c.goal).toBe('整理下载文件夹');
    expect(c.acceptanceCriteria).toHaveLength(1);
  });
  it('模型输出非法 JSON 时抛错（不放行脏契约，守 L1）', async () => {
    const m = new MockModelClient({ grader: ['不是json'], runner: [] });
    await expect(captureIntent(m, 'x')).rejects.toThrow();
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/brain/intent.ts
import { TaskContractSchema, type TaskContract } from '@bobby/shared';
import type { ModelClient } from '../model/model-client';

const SYS = `你是意图捕获器。把用户的人话转成 JSON 形式的《意图契约》：
{goal, acceptanceCriteria:[{id,desc,oracleHint}], constraints:[{id,desc,check}], inputs, outOfScope}。
oracleHint ∈ test|run|file|schema|review|human。每条验收标准必须可机器核验。只输出 JSON。`;

export async function captureIntent(model: ModelClient, userInput: string): Promise<TaskContract> {
  const res = await model.complete('grader', [
    { role: 'system', content: SYS },
    { role: 'user', content: userInput },
  ], { json: true });
  let parsed: unknown;
  try { parsed = JSON.parse(res.content); } catch { throw new Error('intent: model did not return valid JSON'); }
  return TaskContractSchema.parse(parsed); // Zod 兜底，脏数据不放行
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(brain): captureIntent -> validated TaskContract"`

> 备注（歧义追问）：本里程碑做"一发命中"路径；歧义打分 + 追问预算在 M7 配置系统接入后补一个 `clarify()`，此处预留接口注释，不留 TODO 占位逻辑。

---

## Task 3: 规划器 → PlanStep[]（TDD）

**Files:** Create `src/brain/planner.ts`; Test `tests/planner.test.ts`

- [ ] **Step 1: 写失败测试**
```ts
// packages/kernel/tests/planner.test.ts
import { describe, it, expect } from 'vitest';
import { planTask } from '../src/brain/planner';
import { MockModelClient } from '../src/model/mock-model-client';
import type { TaskContract } from '@bobby/shared';

const contract: TaskContract = {
  goal: 'g', acceptanceCriteria: [{ id: 'AC1', desc: 'd', oracleHint: 'file' }],
  constraints: [], inputs: [], outOfScope: [],
};
const stepsJson = JSON.stringify([{ id: 'S1', desc: '扫描目录', satisfiesAcIds: ['AC1'], dependsOn: [] }]);

describe('planTask', () => {
  it('用 grader 产出绑定验收标准的步骤', async () => {
    const m = new MockModelClient({ grader: [stepsJson], runner: [] });
    const steps = await planTask(m, contract);
    expect(steps[0].satisfiesAcIds).toContain('AC1');
  });
  it('拒绝引用了不存在验收标准的步骤', async () => {
    const bad = JSON.stringify([{ id: 'S1', desc: 'x', satisfiesAcIds: ['AC9'], dependsOn: [] }]);
    const m = new MockModelClient({ grader: [bad], runner: [] });
    await expect(planTask(m, contract)).rejects.toThrow();
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/brain/planner.ts
import { PlanStepSchema, type PlanStep, type TaskContract } from '@bobby/shared';
import { z } from 'zod';
import type { ModelClient } from '../model/model-client';

const SYS = `你是规划器。把《意图契约》拆成最小可验证步骤数组 [{id,desc,satisfiesAcIds,dependsOn}]。
每步必须回指它满足的验收标准 id。只输出 JSON 数组。`;

export async function planTask(model: ModelClient, contract: TaskContract): Promise<PlanStep[]> {
  const res = await model.complete('grader', [
    { role: 'system', content: SYS },
    { role: 'user', content: JSON.stringify(contract) },
  ], { json: true });
  const steps = z.array(PlanStepSchema).parse(JSON.parse(res.content));
  const acIds = new Set(contract.acceptanceCriteria.map((a) => a.id));
  for (const s of steps) for (const id of s.satisfiesAcIds)
    if (!acIds.has(id)) throw new Error(`planner: step ${s.id} references unknown AC ${id}`);
  return steps;
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(brain): planTask -> validated PlanStep[] bound to ACs"`

---

## Task 4: 执行器（一步 → Claim）（TDD）

**Files:** Create `src/brain/executor.ts`; Test `tests/executor.test.ts`

- [ ] **Step 1: 写失败测试**
```ts
// packages/kernel/tests/executor.test.ts
import { describe, it, expect } from 'vitest';
import { executeStep } from '../src/brain/executor';
import { MockModelClient } from '../src/model/mock-model-client';
import type { PlanStep } from '@bobby/shared';

const step: PlanStep = { id: 'S1', desc: '扫描目录', satisfiesAcIds: ['AC1'], dependsOn: [] };

describe('executeStep', () => {
  it('用 runner=Flash 执行并产出回指验收标准的 Claim', async () => {
    const m = new MockModelClient({ grader: [], runner: ['扫描完成，共 12 个文件'] });
    const claim = await executeStep(m, step);
    expect(claim.stepId).toBe('S1');
    expect(claim.acIds).toContain('AC1');
    expect(claim.summary).toContain('扫描');
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/brain/executor.ts
import type { PlanStep } from '@bobby/shared';
import type { ModelClient } from '../model/model-client';

export interface Claim { stepId: string; acIds: string[]; summary: string; }

const SYS = `你是执行器(Flash)。执行给定步骤，简述你做了什么。M1 阶段先不调真实工具。`;

export async function executeStep(model: ModelClient, step: PlanStep): Promise<Claim> {
  const res = await model.complete('runner', [
    { role: 'system', content: SYS },
    { role: 'user', content: step.desc },
  ]);
  // M1：Claim 仅承载"声称"，证据/裁决在 M2 接入；此处不得自评通过。
  return { stepId: step.id, acIds: step.satisfiesAcIds, summary: res.content };
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(brain): executeStep produces Claim (no self-verdict)"`

---

## Task 5: 轨迹存储（append-only）（TDD）

**Files:** Create `src/trace/trace-store.ts`; Test `tests/trace-store.test.ts`

- [ ] **Step 1: 写失败测试**
```ts
// packages/kernel/tests/trace-store.test.ts
import { describe, it, expect } from 'vitest';
import { TraceStore } from '../src/trace/trace-store';

describe('TraceStore', () => {
  it('按任务追加且返回冻结副本', () => {
    const t = new TraceStore();
    t.append('t1', { type: 'step_started', taskId: 't1', stepId: 'S1' });
    t.append('t1', { type: 'final_result', taskId: 't1', status: 'failed' });
    const trace = t.get('t1');
    expect(trace.map((e) => e.type)).toEqual(['step_started', 'final_result']);
    expect(Object.isFrozen(trace)).toBe(true); // 不可被外部改写
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/trace/trace-store.ts
import type { KernelEvent } from '@bobby/shared';
export class TraceStore {
  private map = new Map<string, KernelEvent[]>();
  append(taskId: string, e: KernelEvent): void {
    const arr = this.map.get(taskId) ?? [];
    arr.push(e); this.map.set(taskId, arr);
  }
  get(taskId: string): readonly KernelEvent[] { return Object.freeze([...(this.map.get(taskId) ?? [])]); }
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(trace): append-only TraceStore returning frozen copies"`

---

## Task 6: 编排器（状态机 + 事件 + 轨迹）（TDD）

**Files:** Create `src/brain/orchestrator.ts`; Test `tests/orchestrator.test.ts`

- [ ] **Step 1: 写失败测试**
```ts
// packages/kernel/tests/orchestrator.test.ts
import { describe, it, expect } from 'vitest';
import { Orchestrator } from '../src/brain/orchestrator';
import { MockModelClient } from '../src/model/mock-model-client';

const contractJson = JSON.stringify({
  goal: 'g', acceptanceCriteria: [{ id: 'AC1', desc: 'd', oracleHint: 'file' }],
  constraints: [], inputs: [], outOfScope: [],
});
const stepsJson = JSON.stringify([{ id: 'S1', desc: '做事', satisfiesAcIds: ['AC1'], dependsOn: [] }]);

describe('Orchestrator', () => {
  it('跑出 intent→plan→step→final 事件序列并落轨迹', async () => {
    const model = new MockModelClient({ grader: [contractJson, stepsJson], runner: ['做完了'] });
    const o = new Orchestrator(model);
    const seen: string[] = [];
    o.on((e) => seen.push(e.type));
    const taskId = await o.startTask('帮我做事');
    expect(seen).toEqual(['intent_proposed', 'plan_ready', 'step_started', 'final_result']);
    expect(o.trace.get(taskId).length).toBe(4);
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/brain/orchestrator.ts
import { randomUUID } from 'node:crypto';
import type { KernelEvent } from '@bobby/shared';
import type { ModelClient } from '../model/model-client';
import { captureIntent } from './intent';
import { planTask } from './planner';
import { executeStep } from './executor';
import { TraceStore } from '../trace/trace-store';

type Listener = (e: KernelEvent) => void;

export class Orchestrator {
  readonly trace = new TraceStore();
  private listeners = new Set<Listener>();
  constructor(private model: ModelClient) {}
  on(fn: Listener) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit(taskId: string, e: KernelEvent) { this.trace.append(taskId, e); for (const fn of this.listeners) fn(e); }

  async startTask(input: string): Promise<string> {
    const taskId = randomUUID();
    const contract = await captureIntent(this.model, input);
    this.emit(taskId, { type: 'intent_proposed', taskId, contract });
    const steps = await planTask(this.model, contract);
    this.emit(taskId, { type: 'plan_ready', taskId, steps });
    for (const step of steps) {
      this.emit(taskId, { type: 'step_started', taskId, stepId: step.id });
      await executeStep(this.model, step);
      // M1：尚无验证。M2 将在此处插入"证据→裁决→完成闸门"，未过闸门不得 final done。
    }
    this.emit(taskId, { type: 'final_result', taskId, status: 'failed' }); // M1 默认 failed：未验证不许称 done（守 L1/L7）
    return taskId;
  }
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(brain): Orchestrator wires intent->plan->exec with trace + events"`

> 关键设计：M1 的 `final_result` 硬编码为 `failed`——**没有验证就不许声称 done**。M2 会把"完成闸门"插进循环末尾，只有全部验收通过才允许 `done`。这保证了"反蒙混"从架构第一天就成立。

---

## ✅ M1 验收标准
- [ ] `pnpm --filter @bobby/kernel test` 全绿（Task 1–6）。
- [ ] 用 `MockModelClient` 能跑出 `intent_proposed → plan_ready → step_started → final_result` 事件序列。
- [ ] 轨迹按任务 append-only、返回冻结副本。
- [ ] 脏契约 / 越界步骤 / 非法 JSON 一律抛错不放行。
- [ ] 未接验证前，`final_result` 恒为非 `done`（架构层面杜绝自评通过）。

**M1 完成后 →** `bobby-m2-conscience.md`（把完成闸门与裁判引擎插进循环末尾）。
