# Bobby — CLI 交互按 Claude Code 重做指令（独立线）

> **For agentic workers (GPT-5.5 总工程师 → 5.3-codex-spark 工人):** 按 `2026-06-04-bobby-execution-protocol.md` 执行：一项一单、严格 TDD、总工程师亲验。
> 与 `*-deepcode-port-directive.md` **并行的独立任务**。

## 0. 目标与范围
- **问题**：现 `packages/cli/src/interactive.ts` 是裸 `readline` 的 `bobby> ` 循环——无流式、无工具调用展示、无内联权限、无计划模式、无 slash、无中断、无状态行，离 Claude Code「天差地别」。
- **目标**：把 CLI 交互重做成 **Claude Code 那种手感**。
- **关键事实（省一半工）**：`KernelHost` **已经在发完整事件流**（`intent_proposed/plan_ready/step_started/tool_called/evidence_produced/verdict/gate_request/final_result/error`）。**这条主要是"富渲染 + 输入处理"，几乎不动内核逻辑**——CLI 只消费事件 + 回发命令（`startTask/answer/approveGate/abort`）。

## 铁律护栏
- ❌ **不照抄 Deep Code 的 TUI/Ink 组件**；用 **Ink（React for terminal）自建最小组件**，只学 **Claude Code 的交互模型**。
- **零业务逻辑入 UI**：CLI 仅 `事件→视图状态→渲染` + `输入→KernelHost 命令`（与 GUI 共用同一事件契约，守 DRY）。
- **不许把护城河藏起来**：证据 ✅/⚠️ 与 `verdict`、`final_result(done/failed/blocked + 原因)` **必须可见**，漂亮 UI 不得粉饰失败。
- **保留无头模式**：`bobby run "<task>"`（headless）继续可用、退出码反映状态。

## 技术栈
- `ink` ^5、`ink-text-input`、`ink-spinner`、`react`；测试 `ink-testing-library` + Vitest。
- 新增 `packages/cli/src/ui/`：`App.tsx`(root) + 组件（`MessageStream/InputBox/StatusLine/ToolCallLine/PermissionPrompt/PlanView/EvidenceLine`）+ 扩展现有 `ui/view-model.ts`。
- `interactive.ts` 改为挂载 Ink App（保留 `--no-tty` 回退到现有简易行模式）。

---

## CLI-1：Ink 外壳 + 事件→视图模型 + 常驻输入框
- 用 `render(<App/>)` 取代 `bobby> ` 裸循环；`App` 订阅 `KernelHost` 事件 → reduce 进视图状态 → 渲染消息流；底部 `InputBox`（ink-text-input）常驻、支持多行与提交。
- 扩展 `view-model.ts`：把每类事件折叠成可渲染行（含 ✅/⚠️ verdict 行、`final_result` 醒目状态）。
- **验收**（ink-testing-library）：喂一串事件 → `lastFrame()` 含意图/计划/步骤/`done|failed` 行；输入提交触发 `startTask`。

## CLI-2：工具调用内联展示（Claude Code 风）
- `tool_called` → 行内显示 `● <tool>(<关键参数>)`；`evidence_produced` → 紧随其后显示**可折叠**的真实结果（退出码/stdout 摘要/文件路径），✅ 成功 / ⚠️ 失败标色。
- **验收**：`tool_called` + `evidence_produced(command_output exitCode!=0)` → 帧含工具名且标红；exitCode=0 → 标绿。

## CLI-3：内联权限弹窗（对接 gate_request）
- `gate_request` → 渲染 `PermissionPrompt`：大白话原因 + `[a]llow once / [A]lways / [d]eny`；按键 → 回发 `approveGate`。
- **验收**：注入 `gate_request{reason:'联网下载'}` → 帧含原因与选项；按 `a` → 调用 `approveGate(gateId,'allow')`。

## CLI-4：计划模式（对接 plan_ready）
- `plan_ready` → `PlanView` 列出步骤 DAG；提供 `批准 / 编辑 / 拒绝`；批准才继续执行，拒绝 → `abort`。
- **验收**：注入 `plan_ready{steps:[...]}` → 帧逐条列步骤；拒绝 → 调用 `abort`。

## CLI-5：Slash 命令 + 输入历史 + Esc 中断
- Slash：`/help /clear /status /cost /undo /agents /resume /exit`（`/undo`→PORT-H 的 `restore`；`/agents`→PORT-G 列子agent；`/cost`→BudgetGuard 用量）。
- 输入历史（↑/↓）；**Esc 中断正在跑的任务**（→ `abort`），Ctrl+C 两次退出。
- **验收**：输入 `/help` 显示命令表且**不**触发 `startTask`；运行中按 Esc → 调用 `abort`；↑ 取回上一条输入。

## CLI-6：实时状态行
- 底部状态行：`ink-spinner` + 当前活动（thinking/工具名）+ **token/费用计**（读 `BudgetGuard.spentUsd/proCalls/flashCalls`）+ 上下文占用。
- **验收**：运行中帧含 spinner 与费用数字；空闲显示就绪态。

## CLI-7：流式输出（依赖 DeepSeek SSE，优雅降级）
- 若 DeepSeek 支持流式（⚠️ 由 `probe` 核实）：给 `ModelClient`/`deepseek/client.ts` 加 `stream` 能力，逐块渲染助手输出与（可折叠的）reasoning。
- **不支持或未启用时**：按**事件粒度**渲染（step/tool/verdict 实时出现）已足够有"在动"的手感——**本项不阻塞 CLI-1~6**。
- **验收**：流式可用时逐块刷新；不可用时回退事件粒度，无报错。

---

## 派发顺序
```
CLI-1（外壳+输入，基座）
  ├─ CLI-2（工具展示）
  ├─ CLI-3（权限弹窗）
  ├─ CLI-4（计划模式）
  ├─ CLI-5（slash+历史+Esc）
  └─ CLI-6（状态行）
CLI-7（流式，最后，且可降级）
```
CLI-1 先行；2~6 可并行；7 压轴且非阻塞。

## 全局验收
- [ ] `pnpm --filter @bobby/cli test` 全绿（view-model + 各组件 ink-testing-library 断言）。
- [ ] 交互覆盖 Claude Code 关键模型：流式/事件实时、工具内联、内联权限、计划模式、slash、Esc 中断、状态行。
- [ ] **护城河可见**：证据与 `done/failed/blocked + 原因`清晰呈现，失败不粉饰。
- [ ] `bobby run`（headless）仍可用，退出码反映状态。
- [ ] 未引入 Deep Code 的 TUI 代码；UI 不含业务逻辑（只消费 KernelHost 事件 + 回发命令）。
