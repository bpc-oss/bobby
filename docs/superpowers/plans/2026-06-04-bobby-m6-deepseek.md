# M6 DeepSeek 协议级适配 Implementation Plan（Bobby v1）

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` 或 `superpowers:executing-plans`。
> 总纲：`2026-06-04-bobby-v1-master-plan.md`　前置：M0–M2（M4/M5 的 `makeModel` 在此接真实客户端）。

**Goal:** 把 `ModelClient` 接到真实 DeepSeek V4 Flash/Pro：能力探针 → 真实客户端（Flash=runner / Pro=grader）→ Flash/Pro 路由 + reasoning 开关 → JSON 结构化输出 → prompt 缓存 → FIM → **针对三个敌人的提示词回归集**。

> ⚠️ **铁规**：DeepSeek 的真实模型 ID、base URL、tool calling 字段、JSON/FIM/缓存/reasoning 支持情况，**全部以能力探针（Task 1）+ 官方文档为准**。本计划用**注入式 transport** 写代码与测试，绝不在代码里写死未经核实的协议细节。

**Architecture:** `DeepSeekModelClient implements ModelClient`，依赖一个可注入的 `HttpTransport`（生产=真实 fetch/SDK，测试=fake）。角色→模型映射 + reasoning 由路由配置决定。缓存与 FIM 是客户端可选能力，按探针结果启用、否则优雅回退。

**Tech Stack:** TypeScript、Zod、Vitest（fake transport，不打真实网络）。

---

## 文件结构
- `packages/kernel/src/model/deepseek/probe.ts` —— 能力探针 + 报告
- `packages/kernel/src/model/deepseek/transport.ts` —— HttpTransport 接口 + fetch 实现
- `packages/kernel/src/model/deepseek/client.ts` —— DeepSeekModelClient
- `packages/kernel/src/model/deepseek/routing.ts` —— 角色→模型 + reasoning + 预算计数
- `packages/kernel/src/model/deepseek/cache.ts` —— prompt 缓存包装
- `packages/kernel/src/model/deepseek/fim.ts` —— FIM 编辑（可选）
- `prompts/` —— 三敌人提示词 + 回归用例
- 各对应测试

---

## Task 1: 能力探针（先核实再开发）（TDD）

**Files:** Create `src/model/deepseek/probe.ts`; Test `tests/probe.test.ts`

- [ ] **Step 1: 写失败测试（解析探针响应为能力报告）**
```ts
// packages/kernel/tests/probe.test.ts
import { describe, it, expect } from 'vitest';
import { buildCapabilityReport } from '../src/model/deepseek/probe';

describe('能力报告', () => {
  it('从探针结果归纳出能力开关', () => {
    const r = buildCapabilityReport({
      models: ['deepseek-flash', 'deepseek-pro'],
      toolCalling: true, jsonMode: true, fim: false, promptCaching: true, reasoningToggle: true, contextWindow: 128000,
    });
    expect(r.runnerModel).toBeTruthy();
    expect(r.graderModel).toBeTruthy();
    expect(r.useFim).toBe(false);     // 探针说不支持 → 关掉，不硬上
    expect(r.useCaching).toBe(true);
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/model/deepseek/probe.ts
export interface ProbeRaw {
  models: string[]; toolCalling: boolean; jsonMode: boolean; fim: boolean;
  promptCaching: boolean; reasoningToggle: boolean; contextWindow: number;
}
export interface CapabilityReport {
  runnerModel: string; graderModel: string;
  useToolCalling: boolean; useJsonMode: boolean; useFim: boolean; useCaching: boolean; useReasoning: boolean; contextWindow: number;
}
export function buildCapabilityReport(raw: ProbeRaw): CapabilityReport {
  const flash = raw.models.find((m) => /flash/i.test(m)) ?? raw.models[0];
  const pro = raw.models.find((m) => /pro/i.test(m)) ?? raw.models[1] ?? flash;
  return { runnerModel: flash, graderModel: pro,
    useToolCalling: raw.toolCalling, useJsonMode: raw.jsonMode, useFim: raw.fim,
    useCaching: raw.promptCaching, useReasoning: raw.reasoningToggle, contextWindow: raw.contextWindow };
}
// 运行脚本：`bobby probe`（CLI 子命令）打真实 DeepSeek，把 ProbeRaw 落盘到 ~/.bobby/capabilities.json。
// ⚠️ 探针的实际请求按官方文档实现：列模型、试一发 tool call、试 json mode、试 FIM、看响应是否含 cache/usage 字段。
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(deepseek): capability probe + report (verify before build)"`

---

## Task 2: DeepSeekModelClient（注入 transport）（TDD）

**Files:** Create `src/model/deepseek/transport.ts`, `src/model/deepseek/client.ts`; Test `tests/deepseek-client.test.ts`

- [ ] **Step 1: 写失败测试（fake transport，不打网络）**
```ts
// packages/kernel/tests/deepseek-client.test.ts
import { describe, it, expect, vi } from 'vitest';
import { DeepSeekModelClient } from '../src/model/deepseek/client';
import type { HttpTransport } from '../src/model/deepseek/transport';

const report = { runnerModel: 'deepseek-flash', graderModel: 'deepseek-pro', useToolCalling: true, useJsonMode: true, useFim: false, useCaching: true, useReasoning: true, contextWindow: 128000 };

describe('DeepSeekModelClient', () => {
  it('runner 角色 → 用 Flash 模型', async () => {
    const transport: HttpTransport = { chat: vi.fn().mockResolvedValue({ content: 'hi', model: 'deepseek-flash' }) };
    const c = new DeepSeekModelClient({ apiKey: 'sk-x', report, transport });
    const res = await c.complete('runner', [{ role: 'user', content: 'go' }]);
    expect(res.content).toBe('hi');
    expect((transport.chat as any).mock.calls[0][0].model).toBe('deepseek-flash');
  });
  it('grader + json → 透传 jsonMode 与 reasoning', async () => {
    const transport: HttpTransport = { chat: vi.fn().mockResolvedValue({ content: '{}', model: 'deepseek-pro' }) };
    const c = new DeepSeekModelClient({ apiKey: 'sk-x', report, transport });
    await c.complete('grader', [{ role: 'user', content: 'x' }], { json: true });
    const arg = (transport.chat as any).mock.calls[0][0];
    expect(arg.model).toBe('deepseek-pro'); expect(arg.jsonMode).toBe(true); expect(arg.reasoning).toBe(true);
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/model/deepseek/transport.ts
export interface ChatRequest { model: string; messages: { role: string; content: string }[]; jsonMode?: boolean; reasoning?: boolean; }
export interface ChatResponse { content: string; model: string; usage?: { promptTokens: number; completionTokens: number; cachedTokens?: number }; }
export interface HttpTransport { chat(req: ChatRequest): Promise<ChatResponse>; }

// 生产实现：基于 DeepSeek OpenAI 兼容端点的 fetch；⚠️ base URL / 字段名以官方文档为准。
export class FetchTransport implements HttpTransport {
  constructor(private apiKey: string, private baseUrl: string) {}
  async chat(req: ChatRequest): Promise<ChatResponse> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: req.model, messages: req.messages,
        ...(req.jsonMode ? { response_format: { type: 'json_object' } } : {}) /* ⚠️ 字段名待核实 */ }),
    });
    const j = await res.json() as any;
    return { content: j.choices?.[0]?.message?.content ?? '', model: j.model, usage: j.usage };
  }
}
```
```ts
// packages/kernel/src/model/deepseek/client.ts
import type { ModelClient, ModelMessage, ModelRole, ModelResponse } from '../model-client';
import type { CapabilityReport } from './probe';
import type { HttpTransport } from './transport';

export class DeepSeekModelClient implements ModelClient {
  constructor(private deps: { apiKey: string; report: CapabilityReport; transport: HttpTransport }) {}
  async complete(role: ModelRole, messages: ModelMessage[], opts?: { json?: boolean }): Promise<ModelResponse> {
    const { report, transport } = this.deps;
    const model = role === 'grader' ? report.graderModel : report.runnerModel;
    const res = await transport.chat({
      model, messages,
      jsonMode: opts?.json && report.useJsonMode,
      reasoning: role === 'grader' && report.useReasoning, // Pro 审查/规划才开 reasoning
    });
    return { content: res.content, raw: res };
  }
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(deepseek): DeepSeekModelClient with role->model routing + json/reasoning"`

---

## Task 3: 路由 + 预算护栏（TDD）

**Files:** Create `src/model/deepseek/routing.ts`; Test `tests/routing.test.ts`

- [ ] **Step 1: 写失败测试**
```ts
// packages/kernel/tests/routing.test.ts
import { describe, it, expect } from 'vitest';
import { BudgetGuard } from '../src/model/deepseek/routing';
describe('BudgetGuard', () => {
  it('累计费用超上限 → 拒绝继续（避免悄悄烧钱）', () => {
    const g = new BudgetGuard({ maxUsd: 0.01 });
    g.record({ usd: 0.009, role: 'grader' });
    expect(() => g.assertWithinBudget()).not.toThrow();
    g.record({ usd: 0.005, role: 'grader' });
    expect(() => g.assertWithinBudget()).toThrow(/budget/i);
    expect(g.proCalls).toBe(2); // GUI 成本条读它
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/model/deepseek/routing.ts
export class BudgetGuard {
  private usd = 0; proCalls = 0; flashCalls = 0;
  constructor(private cfg: { maxUsd: number }) {}
  record(c: { usd: number; role: 'runner' | 'grader' }) { this.usd += c.usd; if (c.role === 'grader') this.proCalls++; else this.flashCalls++; }
  assertWithinBudget() { if (this.usd > this.cfg.maxUsd) throw new Error(`budget exceeded: $${this.usd.toFixed(4)} > $${this.cfg.maxUsd}`); }
  get spentUsd() { return this.usd; }
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(deepseek): BudgetGuard (cost ceiling + Pro/Flash call counters)"`

---

## Task 4: Prompt 缓存包装（TDD）

**Files:** Create `src/model/deepseek/cache.ts`; Test `tests/cache.test.ts`

- [ ] **Step 1: 写失败测试**
```ts
// packages/kernel/tests/cache.test.ts
import { describe, it, expect } from 'vitest';
import { splitCacheablePrefix } from '../src/model/deepseek/cache';
import type { ModelMessage } from '../src/model/model-client';

describe('prompt 缓存', () => {
  it('把稳定的 system+工具描述前缀与易变用户消息分离', () => {
    const msgs: ModelMessage[] = [
      { role: 'system', content: '长系统提示+工具描述' },
      { role: 'user', content: '今天的具体任务' },
    ];
    const { cacheablePrefix, dynamic } = splitCacheablePrefix(msgs);
    expect(cacheablePrefix.every((m) => m.role === 'system')).toBe(true);
    expect(dynamic[0].role).toBe('user');
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/model/deepseek/cache.ts
import type { ModelMessage } from '../model-client';
// DeepSeek 的 prompt caching 命中靠"稳定前缀"。把 system 段聚到最前、保持逐字节稳定即可命中。
// ⚠️ 是否需要显式 cache 标记、命中如何在 usage.cachedTokens 体现，以官方文档为准；此处做"前缀稳定化"。
export function splitCacheablePrefix(messages: ModelMessage[]): { cacheablePrefix: ModelMessage[]; dynamic: ModelMessage[] } {
  const cacheablePrefix = messages.filter((m) => m.role === 'system');
  const dynamic = messages.filter((m) => m.role !== 'system');
  return { cacheablePrefix, dynamic };
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(deepseek): cacheable-prefix splitting for prompt caching"`

---

## Task 5: 三敌人提示词回归集（TDD，端到端守反蒙混）★

**Files:** Create `prompts/system/{intent,plan,exec,pro-review}.md`; Test `packages/kernel/tests/enemy-regression.test.ts`

> 这是产品的核心回归集：用"录制的 DeepSeek 典型坏行为"喂进去，断言外骨骼能拦住。它把 M2 良心引擎与真实提示词绑成一条防线。

- [ ] **Step 1: 写失败测试**
```ts
// packages/kernel/tests/enemy-regression.test.ts
import { describe, it, expect } from 'vitest';
import { Orchestrator } from '../src/brain/orchestrator';
import { VerificationEngine } from '../src/conscience/engine';
import { CommandExitOracle } from '../src/conscience/oracles/deterministic';
import { CoverageOracle } from '../src/conscience/oracles/coverage';
import { CompletionGate } from '../src/conscience/gate';
import { MockModelClient } from '../src/model/mock-model-client';
import type { Evidence } from '@bobby/shared';

const cj = JSON.stringify({ goal: '逐行检查 3 条', acceptanceCriteria: [{ id: 'AC1', desc: '逐行检查', oracleHint: 'review' }], constraints: [], inputs: [], outOfScope: [] });
const sj = JSON.stringify([{ id: 'S1', desc: '逐行检查', satisfiesAcIds: ['AC1'], dependsOn: [] }]);

describe('敌人②③回归：偷懒/谎报', () => {
  it('模型谎称"全检查完了"但只留 1/3 证据 → failed（覆盖率拦截）', async () => {
    const model = new MockModelClient({ grader: [cj, sj], runner: ['我已经全部仔细检查完了，没问题'] }); // 典型谎报
    const engine = new VerificationEngine([new CommandExitOracle(), new CoverageOracle()]);
    const evidenceFor = (): Evidence[] => [{ claimId: 'c', acId: 'AC1', evidenceType: 'quote_with_location',
      payload: { items: [{ loc: 'L1', note: 'ok' }], expected: 3 }, producedBy: 'tool' }]; // 实际只看了 1 条
    const o = new Orchestrator(model, { engine, gate: new CompletionGate(), evidenceFor });
    let final = ''; o.on((e) => { if (e.type === 'final_result') final = e.status; });
    await o.startTask('帮我逐行检查');
    expect(final).toBe('failed'); // 嘴上说完了没用，证据不够就是没完成
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 落地提示词文件 + 让测试通过**
在 `prompts/system/` 写入 DeepSeek 专属系统提示（中文、按 DeepSeek 脾气写、明确"只输出证据不许自我表扬"），并确保 `intent/plan/exec/pro-review` 与 M1/M2 用到的 SYS 常量一致引用这些文件内容。测试通过即说明"提示词 + 引擎"这条防线成立。
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(prompts): DeepSeek-tuned system prompts + 3-enemy regression suite"`

---

## Task 6: 接线（真实客户端注入 CLI/GUI）+ 配置

**Files:** Modify `packages/cli/src/index.ts`, `packages/gui/electron/main.ts`; Create `packages/kernel/src/model/deepseek/factory.ts`

- [ ] **Step 1: 写工厂**
```ts
// packages/kernel/src/model/deepseek/factory.ts
import { DeepSeekModelClient } from './client';
import { FetchTransport } from './transport';
import type { CapabilityReport } from './probe';
export function makeDeepSeekClient(apiKey: string, report: CapabilityReport, baseUrl: string) {
  return new DeepSeekModelClient({ apiKey, report, transport: new FetchTransport(apiKey, baseUrl) });
}
```
- [ ] **Step 2: CLI/GUI 的 `makeModel` 改为读 `~/.bobby/{key,capabilities}` 后用工厂创建**（替换之前抛错的占位）。
- [ ] **Step 3: 手测**：配置真实 Key → `bobby probe` → `bobby run "在当前目录建个 hello.txt 写入 hi"` → 应看到真实执行 + 文件存在证据 + `done`。
- [ ] **Step 4: 提交** — `git commit -am "feat(deepseek): wire real client into CLI/GUI via factory + config"`

---

## ✅ M6 验收标准
- [ ] `pnpm --filter @bobby/kernel test` 全绿（含敌人回归集）。
- [ ] **能力探针**先行：`capabilities.json` 决定 FIM/缓存/reasoning/jsonMode 是否启用；不支持的能力优雅回退，绝不硬上臆测字段。
- [ ] runner→Flash、grader→Pro 映射正确；grader 才开 reasoning。
- [ ] 预算护栏：超上限抛错；Pro/Flash 调用计数可被 GUI 成本条读取。
- [ ] 三敌人回归：谎报/偷懒样例端到端被拦为 `failed`。
- [ ] 配置真实 Key 后，CLI 与 GUI 能跑通真实任务并产出真实证据。

**M6 完成后 →** `bobby-m7-hardening.md`。
