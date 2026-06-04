# Bobby v1 — 实现总纲（Master Plan / Index）

> **For agentic workers:** 这是 Bobby v1 的施工总纲。**逐项可执行任务在各里程碑子计划里**（见下表）。每本子计划用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务执行；步骤用 `- [ ]` 复选框跟踪。
> 配套设计稿：`docs/superpowers/specs/2026-06-04-bobby-deepseek-agent-design.md`

**Goal:** 把 Bobby（DeepSeek V4 Flash/Pro 原生、结构性反说谎的通用编码 agent）从零建到开源上线，覆盖四层（大脑/良心/双手/脸面）+ 双前端（CLI + 完整 GUI），全部 v1。

**Architecture:** 一个 UI 无关的内核（库 + 本地 daemon）暴露统一 Kernel API；CLI 与 Electron GUI 都是它的瘦客户端。Flash 当运动员（执行）、Pro 当阅卷人（规划/对抗审查）。每一步执行都产出结构化证据，必须过"完成闸门"才允许声称完成。

**Tech Stack:** TypeScript / Node 20+、pnpm workspaces、Vitest、Zod、ESLint+Prettier、Ink（CLI）、Electron+Vite+React（GUI）、DeepSeek（OpenAI 兼容接口）。

---

## 🚫 无 v2 声明（与设计稿一致）
本总纲覆盖设计稿的**全部能力**。拆成 M0–M8 是**构建顺序**（后面的里程碑依赖前面的产物），**不是裁剪范围**。每个里程碑都独立产出**可运行、可测试**的软件。八本子计划全部会被写出并执行，一个不少。

## 全局约定（所有子计划遵守）
- **语言/运行时**：TypeScript，Node ≥ 20，ESM。
- **Monorepo**：pnpm workspaces + TS project references。
- **测试**：Vitest，严格 TDD——先写失败测试（RED）→ 最小实现（GREEN）→ 重构。覆盖率目标 ≥ 80%。
- **运行时校验**：Zod。意图契约 / 证据 / 裁决 / 结构化模型输出一律先过 Zod。
- **质量**：ESLint + Prettier；函数 < 50 行、文件 < 800 行、不可变优先。
- **提交**：Conventional Commits（`feat: / fix: / test: / chore: …`），频繁小步提交。
- **License**：Apache-2.0。
- **⚠️ DeepSeek 协议细节**：凡涉及 Flash/Pro 模型 ID、tool calling 格式、FIM、缓存、reasoning 开关——实现前先跑 M6 的"能力探针"对照官方文档确认，不臆测。

## 仓库结构（M0 建立，后续填充）
```
bobby/
├─ package.json / pnpm-workspace.yaml / tsconfig.base.json
├─ packages/
│  ├─ shared/   # 类型、Zod schema、Kernel API 契约（M0）
│  ├─ kernel/   # 大脑+良心+双手+provider（M1-M3,M6,M7）
│  ├─ cli/      # Ink CLI 前端（M4）
│  └─ gui/      # Electron+React GUI 前端（M5）
├─ prompts/     # DeepSeek 专属提示词 + 回归用例（M6）
├─ .github/workflows/ci.yml
└─ docs/
```

## 里程碑、子计划、依赖与产出
| 里程碑 | 子计划文件（`docs/superpowers/plans/`） | 依赖 | 核心产出 | 设计稿映射 | 状态 |
|---|---|---|---|---|---|
| **M0 骨架** | `2026-06-04-bobby-m0-skeleton.md` | — | monorepo + 核心类型/Zod schema + Kernel API 契约 + 内核起停 + CI | §4.2, §5.3, §6.2, §8.1, §11.1 | ✅ 已产出 |
| **M1 大脑最小闭环** | `bobby-m1-brain.md` | M0 | 意图捕获→《意图契约》→ 规划 DAG → 执行循环 → 轨迹 | §5 | ✅ 已产出 |
| **M2 良心引擎 ★** | `bobby-m2-conscience.md` | M1 | 证据契约 + 裁判分级 T0–T4 + 完成闸门 + 反偷懒/反幻觉/禁令 | §6 | ✅ 已产出 |
| **M3 双手/沙箱/插件** | `bobby-m3-hands.md` | M1 | 隔离工作区 + 权限阶梯 + 多语言执行 + 工具集 + 插件/MCP + 强沙箱 | §7 | ✅ 已产出 |
| **M4 CLI 前端** | `bobby-m4-cli.md` | M1–M3 | 完整 Ink CLI（流式/计划模式/权限弹窗/历史/无头模式） | §8.2 | ✅ 已产出 |
| **M5 GUI 前端** | `bobby-m5-gui.md` | M1–M3 | 完整 Electron 界面（§8.6 全套：首启向导/工作区/历史/设置/插件管理/成本/主题/i18n）+ 证据可视化 | §8.3–§8.6 | ✅ 已产出 |
| **M6 DeepSeek 适配** | `bobby-m6-deepseek.md` | M1–M2 | 能力探针 + Flash/Pro 路由 + tool calling + 结构化输出 + 缓存 + FIM + 专属提示词回归集 | §9 | ✅ 已产出 |
| **M7 加固** | `bobby-m7-hardening.md` | M1–M6 | 错误/限流/重试 + 预算护栏 + 隐私(零默认遥测) + 配置系统 | §10, §13 | ✅ 已产出 |
| **M8 开源上线** | `bobby-m8-launch.md` | 全部 | 打包分发(npm+安装包) + 自动更新 + 文档 + LICENSE + CI 绿 | §11, §12 | ✅ 已产出 |

★ **M2 是灵魂里程碑**：它没通过前，其余都是辅助。

## 推荐执行顺序
```
M0 → M1 → M2（灵魂，优先打透）
        ↘ M3、M6 可在 M1 之后部分并行
M2/M3 就绪 → M4 ∥ M5（双前端，共用内核）
→ M7 加固 → M8 上线
```

## 组装根与跨里程碑接线点（Codex 必读）
> 各里程碑产物如何拼成一个真正能跑的系统。这里**显式列出几个增量开发容易漏接的点**。

### 组装根 Composition Root（落 `packages/kernel/src/host/create-host.ts`，M4 起、M6/M7 补全）
```ts
export function createHost(cfg: { apiKey: string; report: CapabilityReport; baseUrl: string; workspaceRoot: string }) {
  const model = makeDeepSeekClient(cfg.apiKey, cfg.report, cfg.baseUrl);       // M6
  const ws = new Workspace(cfg.workspaceRoot);                                  // M3
  const tools = new ToolRegistry();                                            // M3
  tools.register(new ExecTool(cfg.workspaceRoot));
  tools.register(new WriteFileTool(ws)); tools.register(new FileExistsTool(ws));
  const provider = new ToolEvidenceProvider(tools);                            // M3
  const engine = new VerificationEngine([                                      // M2
    new CommandExitOracle(), new FileExistsOracle(), new CoverageOracle(), new ProReviewOracle(model),
  ]);
  return new KernelHost(() => model, {                                         // M4 + conscience
    engine, gate: new CompletionGate(), evidenceProvider: provider,
    constraintCheckers: [new NoForbiddenPathChecker()],                        // M2
  });
}
```

### 接线点①：编排器真正执行禁令校验（扩展 M2 Task 8）
M2 的 `Orchestrator` 末尾把 `gate.evaluate(contract, verdicts, [])` 第三参写死成 `[]`。落地时给 `ConscienceDeps` 增加 `evidenceProvider` 与 `constraintCheckers`，并改为：
```ts
import { enforceConstraints } from '../conscience/constraints';
const constraintResults = enforceConstraints(contract.constraints, this.conscience.evidenceProvider.context(), this.conscience.constraintCheckers);
status = this.conscience.gate.evaluate(contract, verdicts, constraintResults).status;
```
（`evidenceFor` 同时换成 `this.conscience.evidenceProvider.evidenceFor`。）

### 接线点②：KernelHost 带上 conscience（扩展 M4 Task 1）
`KernelHost` 构造里 `new Orchestrator(this.makeModel())` → `new Orchestrator(model, this.conscienceDeps)`，由 `createHost` 注入。M4 的最小版（无 conscience、final 恒 `failed`）只用于早期 brain-only 冒烟测试。

### 接线点③：持久禁令与歧义追问（M7 接入编排链）
`ConstraintsLibrary.applyTo(contract)` 在 `captureIntent` 之后、`planTask` 之前并入全局禁令；`needsClarification` 在意图确认阶段触发追问（达阈值才问）。

## 每个里程碑的"完成"定义（守 L6：对自己也要可验收）
每本子计划末尾都带一组**机器可验收标准**（测试全绿 + 关键行为的断言）。里程碑未达验收标准，不得标记完成——我们造的是"不撒谎工具"，对自己的进度也不许撒谎。
