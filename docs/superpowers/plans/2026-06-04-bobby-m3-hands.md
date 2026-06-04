# M3 双手 / 沙箱 / 插件 Implementation Plan（Bobby v1）

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` 或 `superpowers:executing-plans`。步骤用 `- [ ]` 跟踪。
> 总纲：`2026-06-04-bobby-v1-master-plan.md`　前置：M0、M1、M2 已完成。

**Goal:** 实现隔离工作区、权限阶梯、多语言执行、产出真实证据的工具集、插件/MCP 扩展、可选强沙箱；并把 M2 的 `evidenceFor` / 禁令 `ExecContext` 从模拟换成**真实沙箱产物**。

**Architecture:** 所有工具默认锁在隔离工作区内；危险动作经权限阶梯弹 `gate_request`。每个工具产出 M0 的结构化 `Evidence`（工具直出，非模型转述，守 L1/L3）。轻量隔离 = 工作目录限定 + 权限闸口；强沙箱 = 容器/微 VM 真隔离（默认关，可一键开）。

**Tech Stack:** TypeScript、Node `child_process`、Zod、Vitest；`@bobby/kernel` 内新增 `hands/`、`plugins/`。

---

## 文件结构
- `src/hands/workspace.ts` —— 隔离工作区路径管控
- `src/hands/permission.ts` —— 权限阶梯 + 闸口判定
- `src/hands/tool.ts` —— Tool 接口 + ToolRegistry
- `src/hands/tools/exec.ts` —— 沙箱子进程执行（产 command_output 证据）
- `src/hands/tools/fs.ts` —— 读/写/列（产 file_exists / file_diff 证据）
- `src/hands/runners.ts` —— 多语言运行器探测
- `src/hands/sandbox.ts` —— 可选强沙箱开关
- `src/plugins/plugin.ts` + `src/plugins/loader.ts` + `src/plugins/mcp-client.ts`
- `src/hands/evidence-provider.ts` —— 给 M2 编排器的真实证据/上下文桥
- 各对应 `tests/*.test.ts`

---

## Task 1: 隔离工作区（路径管控）（TDD）

**Files:** Create `src/hands/workspace.ts`; Test `tests/workspace.test.ts`

- [ ] **Step 1: 写失败测试**
```ts
// packages/kernel/tests/workspace.test.ts
import { describe, it, expect } from 'vitest';
import { Workspace } from '../src/hands/workspace';

describe('Workspace', () => {
  const ws = new Workspace('/work/proj');
  it('工作区内路径放行', () => {
    expect(ws.resolveInside('a/b.txt')).toBe('/work/proj/a/b.txt');
  });
  it('越界路径抛错（默认不信任，守 L5）', () => {
    expect(() => ws.resolveInside('../../etc/passwd')).toThrow(/outside workspace/i);
    expect(() => ws.resolveInside('/etc/passwd')).toThrow(/outside workspace/i);
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/hands/workspace.ts
import { resolve, relative, isAbsolute } from 'node:path';
export class Workspace {
  constructor(readonly root: string) {}
  resolveInside(p: string): string {
    const abs = isAbsolute(p) ? resolve(p) : resolve(this.root, p);
    const rel = relative(this.root, abs);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`path outside workspace: ${p}`);
    return abs;
  }
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(hands): Workspace path containment"`

---

## Task 2: 权限阶梯 + 闸口（TDD）

**Files:** Create `src/hands/permission.ts`; Test `tests/permission.test.ts`

- [ ] **Step 1: 写失败测试**
```ts
// packages/kernel/tests/permission.test.ts
import { describe, it, expect } from 'vitest';
import { classifyAction, requiresGate } from '../src/hands/permission';

describe('权限阶梯', () => {
  it('工作区内读 = L0，自动放行', () => {
    expect(classifyAction({ kind: 'read', insideWorkspace: true })).toBe('L0');
    expect(requiresGate('L0')).toBe(false);
  });
  it('联网 = L4，必须弹窗', () => {
    expect(classifyAction({ kind: 'network' })).toBe('L4');
    expect(requiresGate('L4')).toBe(true);
  });
  it('装包 = L3，必须弹窗', () => {
    expect(requiresGate(classifyAction({ kind: 'install' }))).toBe(true);
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/hands/permission.ts
export type Tier = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
export type Action =
  | { kind: 'read'; insideWorkspace: boolean }
  | { kind: 'write'; insideWorkspace: boolean }
  | { kind: 'exec' }
  | { kind: 'delete' } | { kind: 'install' } | { kind: 'network' } | { kind: 'global' };

export function classifyAction(a: Action): Tier {
  switch (a.kind) {
    case 'read': return a.insideWorkspace ? 'L0' : 'L4';
    case 'write': return a.insideWorkspace ? 'L1' : 'L3';
    case 'exec': return 'L2';
    case 'delete': case 'install': return 'L3';
    case 'network': case 'global': return 'L4';
  }
}
export function requiresGate(t: Tier): boolean { return t === 'L3' || t === 'L4'; }
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(hands): permission ladder + gate classification"`

---

## Task 3: Tool 接口 + 注册表（TDD）

**Files:** Create `src/hands/tool.ts`; Test `tests/tool-registry.test.ts`

- [ ] **Step 1: 写失败测试**
```ts
// packages/kernel/tests/tool-registry.test.ts
import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../src/hands/tool';

describe('ToolRegistry', () => {
  it('注册并按名取用', () => {
    const r = new ToolRegistry();
    r.register({ name: 'noop', permissionTier: 'L0', async run() { return { evidence: [], result: 'ok' }; } });
    expect(r.get('noop').name).toBe('noop');
  });
  it('取未知工具抛错', () => {
    expect(() => new ToolRegistry().get('ghost')).toThrow(/unknown tool/i);
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/hands/tool.ts
import type { Evidence } from '@bobby/shared';
import type { Tier } from './permission';
export interface ToolResult { evidence: Evidence[]; result: unknown; }
export interface Tool {
  name: string;
  permissionTier: Tier;
  run(input: Record<string, unknown>, ctx: { acId: string; claimId: string }): Promise<ToolResult>;
}
export class ToolRegistry {
  private map = new Map<string, Tool>();
  register(t: Tool) { this.map.set(t.name, t); }
  get(name: string): Tool { const t = this.map.get(name); if (!t) throw new Error(`unknown tool: ${name}`); return t; }
  list(): Tool[] { return [...this.map.values()]; }
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(hands): Tool interface + ToolRegistry"`

---

## Task 4: 沙箱执行工具（真实证据）（TDD）

**Files:** Create `src/hands/tools/exec.ts`; Test `tests/exec-tool.test.ts`

- [ ] **Step 1: 写失败测试（用 node 自身跑，跨平台稳定）**
```ts
// packages/kernel/tests/exec-tool.test.ts
import { describe, it, expect } from 'vitest';
import { ExecTool } from '../src/hands/tools/exec';

describe('ExecTool', () => {
  const tool = new ExecTool('/');
  it('捕获真实退出码与 stdout，产 command_output 证据', async () => {
    const r = await tool.run(
      { cmd: process.execPath, args: ['-e', 'process.stdout.write("hi");process.exit(0)'] },
      { acId: 'AC1', claimId: 'c' },
    );
    const ev = r.evidence[0];
    expect(ev.evidenceType).toBe('command_output');
    expect((ev.payload as { exitCode: number }).exitCode).toBe(0);
    expect((ev.payload as { stdout: string }).stdout).toContain('hi');
    expect(ev.producedBy).toBe('tool'); // 工具直出，非模型转述
  });
  it('超时被杀，退出码非 0', async () => {
    const r = await tool.run(
      { cmd: process.execPath, args: ['-e', 'setTimeout(()=>{}, 10000)'], timeoutMs: 200 },
      { acId: 'AC1', claimId: 'c' },
    );
    expect((r.evidence[0].payload as { exitCode: number }).exitCode).not.toBe(0);
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/hands/tools/exec.ts
import { spawn } from 'node:child_process';
import type { Evidence } from '@bobby/shared';
import type { Tool, ToolResult } from '../tool';

export class ExecTool implements Tool {
  readonly name = 'exec'; readonly permissionTier = 'L2' as const;
  constructor(private cwd: string) {}
  run(input: Record<string, unknown>, ctx: { acId: string; claimId: string }): Promise<ToolResult> {
    const cmd = String(input.cmd); const args = (input.args as string[]) ?? []; const timeoutMs = (input.timeoutMs as number) ?? 60_000;
    return new Promise((resolveP) => {
      // 轻量隔离：限定 cwd；网络默认靠权限闸口拦（真隔离见 sandbox.ts）。
      const child = spawn(cmd, args, { cwd: this.cwd, timeout: timeoutMs });
      let stdout = '', stderr = '';
      child.stdout.on('data', (d) => (stdout += d)); child.stderr.on('data', (d) => (stderr += d));
      child.on('close', (code, signal) => {
        const exitCode = code ?? (signal ? 124 : 1);
        const ev: Evidence = { claimId: ctx.claimId, acId: ctx.acId, evidenceType: 'command_output',
          payload: { cmd, args, exitCode, stdout, stderr, signal }, producedBy: 'tool' };
        resolveP({ evidence: [ev], result: { exitCode } });
      });
    });
  }
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(hands): ExecTool sandboxed subprocess -> command_output evidence"`

---

## Task 5: 文件工具（读/写/列，真实证据）（TDD）

**Files:** Create `src/hands/tools/fs.ts`; Test `tests/fs-tool.test.ts`

- [ ] **Step 1: 写失败测试（用临时目录）**
```ts
// packages/kernel/tests/fs-tool.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Workspace } from '../src/hands/workspace';
import { WriteFileTool, FileExistsTool } from '../src/hands/tools/fs';

describe('fs 工具', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bobby-'));
  const ws = new Workspace(dir);
  it('写文件后存在性证据为 true', async () => {
    await new WriteFileTool(ws).run({ path: 'a.txt', content: 'hi' }, { acId: 'AC1', claimId: 'c' });
    const r = await new FileExistsTool(ws).run({ path: 'a.txt' }, { acId: 'AC1', claimId: 'c' });
    expect((r.evidence[0].payload as { exists: boolean }).exists).toBe(true);
  });
  it('越界写被工作区拦下', async () => {
    await expect(new WriteFileTool(ws).run({ path: '../escape.txt', content: 'x' }, { acId: 'AC1', claimId: 'c' }))
      .rejects.toThrow(/outside workspace/i);
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/hands/tools/fs.ts
import { writeFileSync, existsSync } from 'node:fs';
import type { Evidence } from '@bobby/shared';
import type { Tool, ToolResult } from '../tool';
import type { Workspace } from '../workspace';

export class WriteFileTool implements Tool {
  readonly name = 'write_file'; readonly permissionTier = 'L1' as const;
  constructor(private ws: Workspace) {}
  async run(input: Record<string, unknown>, ctx: { acId: string; claimId: string }): Promise<ToolResult> {
    const abs = this.ws.resolveInside(String(input.path));
    writeFileSync(abs, String(input.content), 'utf8');
    const ev: Evidence = { claimId: ctx.claimId, acId: ctx.acId, evidenceType: 'file_diff',
      payload: { path: abs, bytes: String(input.content).length }, producedBy: 'tool' };
    return { evidence: [ev], result: { path: abs } };
  }
}
export class FileExistsTool implements Tool {
  readonly name = 'file_exists'; readonly permissionTier = 'L0' as const;
  constructor(private ws: Workspace) {}
  async run(input: Record<string, unknown>, ctx: { acId: string; claimId: string }): Promise<ToolResult> {
    const abs = this.ws.resolveInside(String(input.path));
    const ev: Evidence = { claimId: ctx.claimId, acId: ctx.acId, evidenceType: 'file_exists',
      payload: { path: abs, exists: existsSync(abs) }, producedBy: 'tool' };
    return { evidence: [ev], result: { exists: existsSync(abs) } };
  }
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(hands): fs tools (write/exists) with workspace guard + evidence"`

---

## Task 6: 多语言运行器探测 + 插件/MCP（TDD）

**Files:** Create `src/hands/runners.ts`, `src/plugins/plugin.ts`, `src/plugins/loader.ts`, `src/plugins/mcp-client.ts`; Test `tests/runners.test.ts`, `tests/plugin-loader.test.ts`

- [ ] **Step 1: 写失败测试**
```ts
// packages/kernel/tests/runners.test.ts
import { describe, it, expect } from 'vitest';
import { detectRunners } from '../src/hands/runners';
describe('detectRunners', () => {
  it('至少探测到 node（当前进程就是 node）', async () => {
    const r = await detectRunners();
    expect(r.find((x) => x.lang === 'node')?.available).toBe(true);
  });
});
```
```ts
// packages/kernel/tests/plugin-loader.test.ts
import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../src/hands/tool';
import { loadPlugin } from '../src/plugins/loader';

describe('插件加载', () => {
  it('插件工具注册后与内置工具同样能用且必须产证据', async () => {
    const reg = new ToolRegistry();
    loadPlugin(reg, {
      name: 'echo-plugin',
      tools: [{ name: 'echo', permissionTier: 'L0', async run(input, ctx) {
        return { evidence: [{ claimId: ctx.claimId, acId: ctx.acId, evidenceType: 'command_output', payload: { stdout: input.text }, producedBy: 'tool' }], result: input.text };
      } }],
    });
    const r = await reg.get('echo').run({ text: 'hi' }, { acId: 'AC1', claimId: 'c' });
    expect(r.evidence).toHaveLength(1); // 插件不得绕过证据契约（守 L3）
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/hands/runners.ts
import { spawnSync } from 'node:child_process';
export interface Runner { lang: 'node' | 'python' | 'bash'; cmd: string; available: boolean; }
const CANDIDATES: { lang: Runner['lang']; cmd: string }[] = [
  { lang: 'node', cmd: process.execPath }, { lang: 'python', cmd: 'python3' }, { lang: 'bash', cmd: 'bash' },
];
export async function detectRunners(): Promise<Runner[]> {
  return CANDIDATES.map(({ lang, cmd }) => {
    const ok = spawnSync(cmd, ['--version'], { timeout: 3000 }).status === 0 || lang === 'node';
    return { lang, cmd, available: ok };
  });
}
```
```ts
// packages/kernel/src/plugins/plugin.ts
import type { Tool } from '../hands/tool';
export interface BobbyPlugin { name: string; tools: Tool[]; }
```
```ts
// packages/kernel/src/plugins/loader.ts
import type { ToolRegistry } from '../hands/tool';
import type { BobbyPlugin } from './plugin';
export function loadPlugin(registry: ToolRegistry, plugin: BobbyPlugin): void {
  for (const t of plugin.tools) registry.register(t); // 插件工具走同一注册表 → 同样套用权限阶梯 + 证据契约
}
```
```ts
// packages/kernel/src/plugins/mcp-client.ts
// 最小 MCP 客户端：把外部 MCP server 暴露的工具适配成 Bobby Tool（产 command_output 证据）。
// ⚠️ 具体 MCP 传输/协议细节实现时对照 MCP 规范；此处给出适配骨架。
import type { Tool, ToolResult } from '../hands/tool';
export interface McpTransport { call(tool: string, args: unknown): Promise<{ stdout: string; isError: boolean }>; }
export function mcpToolToBobbyTool(name: string, transport: McpTransport): Tool {
  return {
    name: `mcp:${name}`, permissionTier: 'L3', // 外部来源默认偏保守
    async run(input, ctx): Promise<ToolResult> {
      const res = await transport.call(name, input);
      return { evidence: [{ claimId: ctx.claimId, acId: ctx.acId, evidenceType: 'command_output',
        payload: { stdout: res.stdout, exitCode: res.isError ? 1 : 0 }, producedBy: 'tool' }], result: res };
    },
  };
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(hands+plugins): runner detection, plugin loader, MCP tool adapter"`

---

## Task 7: 可选强沙箱开关（TDD）

**Files:** Create `src/hands/sandbox.ts`; Test `tests/sandbox.test.ts`

- [ ] **Step 1: 写失败测试（注入探测函数，不依赖真实容器）**
```ts
// packages/kernel/tests/sandbox.test.ts
import { describe, it, expect } from 'vitest';
import { resolveSandbox } from '../src/hands/sandbox';

describe('强沙箱开关', () => {
  it('默认关 → 用轻量隔离', () => {
    expect(resolveSandbox({ enabled: false }, () => true).mode).toBe('lightweight');
  });
  it('开 + 检测到容器 → 强沙箱', () => {
    expect(resolveSandbox({ enabled: true }, () => true).mode).toBe('strong');
  });
  it('开 + 无容器 → 报错提示装容器（不静默降级骗用户）', () => {
    expect(() => resolveSandbox({ enabled: true }, () => false)).toThrow(/container runtime/i);
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/hands/sandbox.ts
export interface SandboxConfig { enabled: boolean; }
export interface SandboxPlan { mode: 'lightweight' | 'strong'; }
export function resolveSandbox(cfg: SandboxConfig, hasContainerRuntime: () => boolean): SandboxPlan {
  if (!cfg.enabled) return { mode: 'lightweight' };
  if (!hasContainerRuntime()) throw new Error('strong sandbox enabled but no container runtime found; install one or disable');
  return { mode: 'strong' };
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(hands): optional strong sandbox toggle (no silent downgrade)"`

---

## Task 8: 真实证据桥（接回 M2 编排器）（TDD）

**Files:** Create `src/hands/evidence-provider.ts`; Test `tests/evidence-provider.test.ts`

- [ ] **Step 1: 写失败测试**
```ts
// packages/kernel/tests/evidence-provider.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Workspace } from '../src/hands/workspace';
import { ToolRegistry } from '../src/hands/tool';
import { WriteFileTool, FileExistsTool } from '../src/hands/tools/fs';
import { ToolEvidenceProvider } from '../src/hands/evidence-provider';

describe('ToolEvidenceProvider', () => {
  it('按计划执行工具，汇总真实证据 + 触碰路径（喂 M2 闸门/禁令）', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bobby-'));
    const ws = new Workspace(dir);
    const reg = new ToolRegistry(); reg.register(new WriteFileTool(ws)); reg.register(new FileExistsTool(ws));
    const prov = new ToolEvidenceProvider(reg);
    prov.plan('S1', [
      { tool: 'write_file', input: { path: 'a.txt', content: 'hi' } },
      { tool: 'file_exists', input: { path: 'a.txt' } },
    ]);
    const ev = await prov.evidenceFor('S1', ['AC1']);
    expect(ev.some((e) => e.evidenceType === 'file_exists')).toBe(true);
    expect(prov.context().touchedPaths.some((p) => p.endsWith('a.txt'))).toBe(true);
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 写实现**
```ts
// packages/kernel/src/hands/evidence-provider.ts
import type { Evidence } from '@bobby/shared';
import type { ToolRegistry } from './tool';
import type { ExecContext } from '../conscience/constraints';

interface PlannedCall { tool: string; input: Record<string, unknown>; }

export class ToolEvidenceProvider {
  private plans = new Map<string, PlannedCall[]>();
  private touched: string[] = [];
  constructor(private registry: ToolRegistry) {}
  plan(stepId: string, calls: PlannedCall[]) { this.plans.set(stepId, calls); }

  async evidenceFor(stepId: string, acIds: string[]): Promise<Evidence[]> {
    const calls = this.plans.get(stepId) ?? [];
    const out: Evidence[] = [];
    for (const c of calls) {
      const res = await this.registry.get(c.tool).run(c.input, { acId: acIds[0], claimId: stepId });
      for (const e of res.evidence) {
        out.push(e);
        const p = (e.payload as { path?: string }).path;
        if (p) this.touched.push(p);
      }
    }
    return out;
  }
  context(): ExecContext { return { touchedPaths: [...this.touched] }; }
}
```
- [ ] **Step 4: 跑测试确认通过** — PASS
- [ ] **Step 5: 提交** — `git commit -am "feat(hands): ToolEvidenceProvider bridges real evidence + ExecContext to conscience"`

> 接线说明：M2 编排器构造时传入的 `evidenceFor` 用 `ToolEvidenceProvider.evidenceFor`；`gate.evaluate(contract, verdicts, enforceConstraints(contract.constraints, provider.context(), checkers))` 接真实禁令上下文。规划器在 M6 升级为同时产出每步的工具调用计划（`PlannedCall[]`）。

---

## ✅ M3 验收标准
- [ ] `pnpm --filter @bobby/kernel test` 全绿。
- [ ] 越界路径（`../` / 绝对路径）被工作区拦下。
- [ ] L3/L4 动作 `requiresGate` 为真（联网/装包/删除/越界写/全盘）。
- [ ] ExecTool 捕获**真实**退出码/stdout/超时，证据 `producedBy='tool'`。
- [ ] 插件工具经注册表后与内置工具同权同责，**必须产证据**。
- [ ] 强沙箱：开但无容器 → 报错，绝不静默降级。
- [ ] `ToolEvidenceProvider` 能把真实证据 + 触碰路径喂给 M2 闸门与禁令校验（端到端：真实写文件 → 文件存在证据 → 闸门 done）。

**M3 完成后 →** `bobby-m4-cli.md`。
