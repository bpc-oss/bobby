# M0 骨架 Implementation Plan（Bobby v1）

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务逐步执行。步骤用复选框 `- [ ]` 跟踪。
> 总纲：`docs/superpowers/plans/2026-06-04-bobby-v1-master-plan.md`　设计稿：`docs/superpowers/specs/2026-06-04-bobby-deepseek-agent-design.md`

**Goal:** 建立 Bobby 的 monorepo 骨架，并在 `packages/shared` 里定义 + 测试**全产品赖以运行的核心契约**（意图契约、证据、裁决、Kernel API），再加一个能起停的最小内核与 CI。

**Architecture:** 先立"契约层"——用 Zod 把设计稿 §5.3/§6.2/§8.1 的数据结构变成运行时可校验的 schema 与 TS 类型。所有后续里程碑都 import 这一层，保证全栈类型一致、且"证据/契约"从第一天起就是结构化、可校验的（守 L1/L3）。

**Tech Stack:** TypeScript(ESM)、pnpm workspaces、Vitest、Zod、ESLint+Prettier、tsup。

---

## 文件结构（本里程碑创建）
- `package.json`（根，private，workspace 脚本）
- `pnpm-workspace.yaml`
- `tsconfig.base.json`（根 TS 配置）
- `.gitignore`、`.npmrc`、`LICENSE`（Apache-2.0）、`README.md`
- `.github/workflows/ci.yml`
- `packages/shared/`：`package.json`、`tsconfig.json`、`vitest.config.ts`、`src/`、`tests/`
  - `src/contracts/task-contract.ts` —— 意图契约（§5.3）
  - `src/contracts/evidence.ts` —— 证据 + 裁决（§6.2）
  - `src/contracts/plan.ts` —— 规划步骤
  - `src/api/kernel-api.ts` —— Kernel 命令 + 事件（§8.1）
  - `src/index.ts` —— 桶导出
- `packages/kernel/`：`package.json`、`tsconfig.json`、`vitest.config.ts`
  - `src/kernel.ts` —— 最小内核（起停 + 事件总线）

---

## Task 1: 初始化 monorepo 根

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.npmrc`, `LICENSE`, `README.md`

- [ ] **Step 1: 初始化 git 与 pnpm**

Run:
```bash
git init && corepack enable && pnpm -v
```
Expected: 打印 pnpm 版本（≥ 9）。若无 pnpm：`npm i -g pnpm`。

- [ ] **Step 2: 写 `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 3: 写根 `package.json`**

```json
{
  "name": "bobby",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "eslint . --max-warnings=0",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "eslint": "^9.0.0",
    "prettier": "^3.3.0",
    "tsup": "^8.0.0"
  }
}
```

- [ ] **Step 4: 写 `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 5: 写 `.gitignore` / `.npmrc` / `LICENSE` / `README.md`**

`.gitignore`:
```
node_modules
dist
.DS_Store
*.log
.env
```
`.npmrc`:
```
auto-install-peers=true
```
`LICENSE`: 放入标准 **Apache License 2.0** 全文（从 https://www.apache.org/licenses/LICENSE-2.0.txt 拷贝）。
`README.md`:
```markdown
# Bobby
DeepSeek V4 Flash/Pro 原生、结构性反说谎的通用编码 agent。License: Apache-2.0.
```

- [ ] **Step 6: 安装并提交**

Run:
```bash
pnpm install
git add -A && git commit -m "chore: init monorepo skeleton"
```
Expected: 安装成功；提交成功。

---

## Task 2: 搭建 `packages/shared`

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/vitest.config.ts`, `packages/shared/src/index.ts`

- [ ] **Step 1: 写 `packages/shared/package.json`**

```json
{
  "name": "@bobby/shared",
  "version": "0.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "test": "vitest run"
  },
  "dependencies": { "zod": "^3.23.0" }
}
```

- [ ] **Step 2: 写 `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "." },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: 写 `packages/shared/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
```

- [ ] **Step 4: 写占位 `packages/shared/src/index.ts`**

```ts
export const SHARED_PACKAGE = '@bobby/shared';
```

- [ ] **Step 5: 安装并提交**

Run:
```bash
pnpm install
git add -A && git commit -m "chore: scaffold @bobby/shared package"
```
Expected: 成功。

---

## Task 3: 意图契约 schema（§5.3）—— TDD

**Files:**
- Create: `packages/shared/src/contracts/task-contract.ts`
- Test: `packages/shared/tests/task-contract.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// packages/shared/tests/task-contract.test.ts
import { describe, it, expect } from 'vitest';
import { TaskContractSchema } from '../src/contracts/task-contract';

const valid = {
  goal: '把 100 个 PDF 按年份重命名',
  acceptanceCriteria: [{ id: 'AC1', desc: '全部 100 个文件已重命名', oracleHint: 'file' }],
  constraints: [{ id: 'C1', desc: '禁止删除原文件', check: 'diff 中不得出现删除操作' }],
  inputs: ['./pdfs'],
  outOfScope: ['修改文件内容'],
};

describe('TaskContractSchema', () => {
  it('接受合法契约', () => {
    expect(() => TaskContractSchema.parse(valid)).not.toThrow();
  });
  it('拒绝没有验收标准的契约（守完成闸门 L4）', () => {
    expect(() => TaskContractSchema.parse({ ...valid, acceptanceCriteria: [] })).toThrow();
  });
  it('拒绝非法 oracleHint', () => {
    const bad = { ...valid, acceptanceCriteria: [{ id: 'AC1', desc: 'x', oracleHint: 'magic' }] };
    expect(() => TaskContractSchema.parse(bad)).toThrow();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @bobby/shared test`
Expected: FAIL（`task-contract` 模块不存在）。

- [ ] **Step 3: 写最小实现**

```ts
// packages/shared/src/contracts/task-contract.ts
import { z } from 'zod';

export const OracleHint = z.enum(['test', 'run', 'file', 'schema', 'review', 'human']);
export type OracleHint = z.infer<typeof OracleHint>;

export const AcceptanceCriterionSchema = z.object({
  id: z.string().min(1),
  desc: z.string().min(1),
  oracleHint: OracleHint,
});
export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;

export const ConstraintSchema = z.object({
  id: z.string().min(1),
  desc: z.string().min(1),
  check: z.string().min(1), // 如何机器检测违规
});
export type Constraint = z.infer<typeof ConstraintSchema>;

export const TaskContractSchema = z.object({
  goal: z.string().min(1),
  acceptanceCriteria: z.array(AcceptanceCriterionSchema).min(1), // ≥1，守 L4/完成闸门
  constraints: z.array(ConstraintSchema).default([]),
  inputs: z.array(z.string()).default([]),
  outOfScope: z.array(z.string()).default([]),
});
export type TaskContract = z.infer<typeof TaskContractSchema>;
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @bobby/shared test`
Expected: PASS（3 passed）。

- [ ] **Step 5: 提交**

```bash
git add -A && git commit -m "feat(shared): add TaskContract schema with acceptance/constraints"
```

---

## Task 4: 证据 + 裁决 schema（§6.2）—— TDD

**Files:**
- Create: `packages/shared/src/contracts/evidence.ts`
- Test: `packages/shared/tests/evidence.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// packages/shared/tests/evidence.test.ts
import { describe, it, expect } from 'vitest';
import { EvidenceSchema, VerdictSchema } from '../src/contracts/evidence';

describe('Evidence/Verdict', () => {
  it('接受合法证据', () => {
    const ev = {
      claimId: 'cl1', acId: 'AC1', evidenceType: 'command_output',
      payload: { cmd: 'ls', exitCode: 0, stdout: 'a\nb' }, producedBy: 'tool',
    };
    expect(() => EvidenceSchema.parse(ev)).not.toThrow();
  });
  it('拒绝由模型直接“代笔”的证据来源外的非法值', () => {
    const ev = { claimId: 'cl1', acId: 'AC1', evidenceType: 'command_output', payload: {}, producedBy: 'santa' };
    expect(() => EvidenceSchema.parse(ev)).toThrow();
  });
  it('裁决必须带 oracleTier 与 result', () => {
    const v = { claimId: 'cl1', acId: 'AC1', result: 'fail', oracleTier: 'T2', detail: 'Pro 发现 2 处缺陷' };
    expect(() => VerdictSchema.parse(v)).not.toThrow();
    expect(() => VerdictSchema.parse({ ...v, result: 'maybe' })).toThrow();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @bobby/shared test`
Expected: FAIL（`evidence` 模块不存在）。

- [ ] **Step 3: 写最小实现**

```ts
// packages/shared/src/contracts/evidence.ts
import { z } from 'zod';

export const EvidenceType = z.enum([
  'test_run', 'command_output', 'file_diff', 'file_exists',
  'schema_valid', 'symbol_exists', 'quote_with_location', 'pro_review', 'human_ack',
]);
export type EvidenceType = z.infer<typeof EvidenceType>;

export const EvidenceSchema = z.object({
  claimId: z.string().min(1),
  acId: z.string().min(1),
  evidenceType: EvidenceType,
  payload: z.record(z.unknown()), // 工具/沙箱直出的真实物证
  producedBy: z.enum(['tool', 'flash', 'pro', 'human']),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const OracleTier = z.enum(['T0', 'T1', 'T2', 'T3', 'T4']);
export type OracleTier = z.infer<typeof OracleTier>;

export const VerdictSchema = z.object({
  claimId: z.string().min(1),
  acId: z.string().min(1),
  result: z.enum(['pass', 'fail', 'need_human']),
  oracleTier: OracleTier,
  detail: z.string().optional(),
});
export type Verdict = z.infer<typeof VerdictSchema>;
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @bobby/shared test`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add -A && git commit -m "feat(shared): add Evidence and Verdict schemas"
```

---

## Task 5: 规划步骤 schema —— TDD

**Files:**
- Create: `packages/shared/src/contracts/plan.ts`
- Test: `packages/shared/tests/plan.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// packages/shared/tests/plan.test.ts
import { describe, it, expect } from 'vitest';
import { PlanStepSchema } from '../src/contracts/plan';

describe('PlanStep', () => {
  it('每步必须绑定它满足哪条验收标准', () => {
    const step = { id: 'S1', desc: '遍历目录并重命名', satisfiesAcIds: ['AC1'], dependsOn: [] };
    expect(() => PlanStepSchema.parse(step)).not.toThrow();
  });
  it('拒绝没有 satisfiesAcIds 的步骤', () => {
    expect(() => PlanStepSchema.parse({ id: 'S1', desc: 'x', satisfiesAcIds: [], dependsOn: [] })).toThrow();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @bobby/shared test`
Expected: FAIL。

- [ ] **Step 3: 写最小实现**

```ts
// packages/shared/src/contracts/plan.ts
import { z } from 'zod';

export const PlanStepSchema = z.object({
  id: z.string().min(1),
  desc: z.string().min(1),
  satisfiesAcIds: z.array(z.string()).min(1), // 每步都要回指验收标准，守 L4
  dependsOn: z.array(z.string()).default([]),
});
export type PlanStep = z.infer<typeof PlanStepSchema>;
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @bobby/shared test`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add -A && git commit -m "feat(shared): add PlanStep schema"
```

---

## Task 6: Kernel API 契约（§8.1）—— TDD

**Files:**
- Create: `packages/shared/src/api/kernel-api.ts`
- Modify: `packages/shared/src/index.ts`（桶导出全部契约）
- Test: `packages/shared/tests/kernel-api.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// packages/shared/tests/kernel-api.test.ts
import { describe, it, expect } from 'vitest';
import { KernelCommandSchema, KernelEventSchema } from '../src/api/kernel-api';

describe('Kernel API', () => {
  it('startTask 命令合法', () => {
    expect(() => KernelCommandSchema.parse({ type: 'startTask', input: '帮我整理下载文件夹' })).not.toThrow();
  });
  it('gate_request 事件合法', () => {
    const e = { type: 'gate_request', taskId: 't1', gateId: 'g1', reason: '它想联网下载工具' };
    expect(() => KernelEventSchema.parse(e)).not.toThrow();
  });
  it('拒绝未知命令类型', () => {
    expect(() => KernelCommandSchema.parse({ type: 'nuke' })).toThrow();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @bobby/shared test`
Expected: FAIL。

- [ ] **Step 3: 写最小实现**

```ts
// packages/shared/src/api/kernel-api.ts
import { z } from 'zod';
import { TaskContractSchema } from '../contracts/task-contract';
import { PlanStepSchema } from '../contracts/plan';
import { EvidenceSchema, VerdictSchema } from '../contracts/evidence';

export const KernelCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('startTask'), input: z.string().min(1) }),
  z.object({ type: z.literal('answer'), taskId: z.string(), reply: z.string() }),
  z.object({ type: z.literal('approveGate'), gateId: z.string(), decision: z.enum(['allow', 'deny']) }),
  z.object({ type: z.literal('abort'), taskId: z.string() }),
  z.object({ type: z.literal('getTrace'), taskId: z.string() }),
]);
export type KernelCommand = z.infer<typeof KernelCommandSchema>;

export const KernelEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('intent_proposed'), taskId: z.string(), contract: TaskContractSchema }),
  z.object({ type: z.literal('plan_ready'), taskId: z.string(), steps: z.array(PlanStepSchema) }),
  z.object({ type: z.literal('step_started'), taskId: z.string(), stepId: z.string() }),
  z.object({ type: z.literal('tool_called'), taskId: z.string(), stepId: z.string(), tool: z.string() }),
  z.object({ type: z.literal('evidence_produced'), taskId: z.string(), evidence: EvidenceSchema }),
  z.object({ type: z.literal('verdict'), taskId: z.string(), verdict: VerdictSchema }),
  z.object({ type: z.literal('gate_request'), taskId: z.string(), gateId: z.string(), reason: z.string() }),
  z.object({ type: z.literal('final_result'), taskId: z.string(), status: z.enum(['done', 'failed', 'blocked']) }),
  z.object({ type: z.literal('error'), taskId: z.string(), message: z.string() }),
]);
export type KernelEvent = z.infer<typeof KernelEventSchema>;
```

- [ ] **Step 4: 更新桶导出 `packages/shared/src/index.ts`**

```ts
export * from './contracts/task-contract';
export * from './contracts/evidence';
export * from './contracts/plan';
export * from './api/kernel-api';
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm --filter @bobby/shared test`
Expected: PASS（全部用例通过）。

- [ ] **Step 6: 提交**

```bash
git add -A && git commit -m "feat(shared): add Kernel API command/event contracts + barrel export"
```

---

## Task 7: 最小内核（起停 + 类型化事件总线）—— TDD

**Files:**
- Create: `packages/kernel/package.json`, `packages/kernel/tsconfig.json`, `packages/kernel/vitest.config.ts`, `packages/kernel/src/kernel.ts`
- Test: `packages/kernel/tests/kernel.test.ts`

- [ ] **Step 1: 搭建 kernel 包配置**

`packages/kernel/package.json`:
```json
{
  "name": "@bobby/kernel",
  "version": "0.0.0",
  "type": "module",
  "main": "dist/kernel.js",
  "types": "dist/kernel.d.ts",
  "scripts": { "build": "tsup src/kernel.ts --format esm --dts", "test": "vitest run" },
  "dependencies": { "@bobby/shared": "workspace:*", "zod": "^3.23.0" }
}
```
`packages/kernel/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "outDir": "dist", "rootDir": "." }, "include": ["src", "tests"] }
```
`packages/kernel/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
  // 让 kernel 测试直接跑 shared 源码，避免依赖先 build dist
  resolve: { alias: { '@bobby/shared': resolve(__dirname, '../shared/src/index.ts') } },
});
```
Run: `pnpm install`

- [ ] **Step 2: 写失败测试**

```ts
// packages/kernel/tests/kernel.test.ts
import { describe, it, expect } from 'vitest';
import { Kernel } from '../src/kernel';

describe('Kernel', () => {
  it('能起停，状态正确', async () => {
    const k = new Kernel();
    expect(k.isRunning).toBe(false);
    await k.start();
    expect(k.isRunning).toBe(true);
    await k.stop();
    expect(k.isRunning).toBe(false);
  });

  it('订阅者收到发布的事件', async () => {
    const k = new Kernel();
    await k.start();
    const seen: string[] = [];
    k.on((e) => seen.push(e.type));
    k.emit({ type: 'error', taskId: 't1', message: 'boom' });
    expect(seen).toEqual(['error']);
    await k.stop();
  });

  it('拒绝未起动时发布事件', () => {
    const k = new Kernel();
    expect(() => k.emit({ type: 'error', taskId: 't1', message: 'x' })).toThrow();
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm --filter @bobby/kernel test`
Expected: FAIL（`Kernel` 不存在）。

- [ ] **Step 4: 写最小实现**

```ts
// packages/kernel/src/kernel.ts
import { KernelEventSchema, type KernelEvent } from '@bobby/shared';

type Listener = (e: KernelEvent) => void;

export class Kernel {
  private running = false;
  private listeners = new Set<Listener>();

  get isRunning() { return this.running; }

  async start(): Promise<void> { this.running = true; }
  async stop(): Promise<void> { this.running = false; this.listeners.clear(); }

  on(fn: Listener): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  emit(e: KernelEvent): void {
    if (!this.running) throw new Error('Kernel not running');
    const parsed = KernelEventSchema.parse(e); // 出口也校验，杜绝非法事件
    for (const fn of this.listeners) fn(parsed);
  }
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm --filter @bobby/kernel test`
Expected: PASS（3 passed）。

- [ ] **Step 6: 提交**

```bash
git add -A && git commit -m "feat(kernel): minimal kernel with typed event bus + lifecycle"
```

---

## Task 8: CI（GitHub Actions）+ lint/format 配置

**Files:**
- Create: `.github/workflows/ci.yml`, `eslint.config.js`, `.prettierrc.json`

- [ ] **Step 1: 写 ESLint + Prettier 配置**

`eslint.config.js`:
```js
import tseslint from 'typescript-eslint';
export default tseslint.config(...tseslint.configs.recommended, {
  rules: { 'max-lines-per-function': ['warn', 50] },
});
```
`.prettierrc.json`:
```json
{ "singleQuote": true, "semi": true, "printWidth": 100 }
```
Run: `pnpm add -Dw typescript-eslint`

- [ ] **Step 2: 写 CI 工作流**

```yaml
# .github/workflows/ci.yml
name: ci
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm -r build
      - run: pnpm test
```

- [ ] **Step 3: 本地验证整条链路**

Run:
```bash
pnpm install && pnpm lint && pnpm -r build && pnpm test
```
Expected: lint 0 错误；两个包 build 出 `dist/`；测试全绿。

- [ ] **Step 4: 提交**

```bash
git add -A && git commit -m "ci: add lint/format config and GitHub Actions verify workflow"
```

---

## ✅ M0 验收标准（机器可验，守 L6）
- [ ] `pnpm install` 成功，工作区识别 `@bobby/shared` 与 `@bobby/kernel`。
- [ ] `pnpm test` 全绿：Task 3–7 的所有 Vitest 用例通过。
- [ ] `pnpm -r build` 在两个包下产出 `dist/`（含 `.d.ts`）。
- [ ] `pnpm lint` 0 错误。
- [ ] `@bobby/shared` 导出可被 import：`TaskContract / Evidence / Verdict / PlanStep / KernelCommand / KernelEvent` 类型与 schema 均可用。
- [ ] `Kernel` 可起停，事件总线在"出口"对事件做 Zod 校验（非法事件抛错）。
- [ ] CI 在 push 后变绿。

**M0 完成后 →** 进入 `bobby-m1-brain.md`（大脑最小闭环：把这些契约接上 DeepSeek，跑出"意图→规划→执行→轨迹"）。
