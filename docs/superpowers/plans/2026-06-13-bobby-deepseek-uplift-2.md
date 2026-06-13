# Bobby DeepSeek Uplift-2 实施计划（function-calling / FIM / 流式）

> **For agentic workers（Codex 必读）：** REQUIRED SUB-SKILL：`superpowers:subagent-driven-development` 或 `superpowers:executing-plans`。
> 总纲：`2026-06-04-bobby-v1-master-plan.md`；前置里程碑：M6（`2026-06-04-bobby-m6-deepseek.md`）已落地——真实 `/models` 探针 + V4 路由 + JSON 文本协议已上线并端到端冒烟通过（commit `0b7ed7c`）。
> 本计划补 M6 列出但未做的三项增强：**原生 function-calling、FIM、流式**。三者都是**可选能力**，按能力探针结果启用，不支持就优雅回退到现有路径，绝不破坏 M2 良心引擎/完成闸门这条防线。

**Goal:** 在不动现有"模型吐 JSON → executor 解析 → hands 执行 → 证据 → 闸门"主干的前提下，新增三条可选能力通路，每条都：能力探针先行核实 → 注入式 transport 写测试（不打真实网络）→ 能力位为真才启用 → 证据仍然真实、闸门仍然有效。

---

## ⚠️ 铁规（与 M6 一致，Codex 不得违反）

1. **协议细节以"能力探针 + 官方文档"为准**：tool calling 的字段名（`tools`/`tool_choice`/`tool_calls`/`function.arguments`/`role:"tool"`/`tool_call_id`）、FIM 的端点与字段（`/beta/completions` 的 `prompt`/`suffix`？）、流式 SSE 的 chunk 结构（`choices[0].delta.content`、reasoning 模型的 `delta.reasoning_content`、`[DONE]` 哨兵）——**先核实再写死**。本文中凡标 `⚠️待核实` 的字段都必须在实现前用真实 API 或官方文档确认。
2. **测试不打真实网络**：所有单测用注入式 `HttpTransport` / fake fetch / fake SSE 流，沿用 `transport.ts` 既有的 `FetchFn` / 依赖注入风格。
3. **严格 TDD**：每个 Task 先写失败测试（RED）→ 跑确认失败 → 最小实现（GREEN）→ 跑确认通过 → 重构 → 提交。函数 < 50 行、文件 < 800 行、Conventional Commits。
4. **能力位为真才启用**：`useToolCalling` / `useFim` / `useStreaming`（`CapabilityReport`）为 false 时，代码必须走现有回退路径，不得硬上臆测字段。
5. **不得绕过证据/闸门**：原生 tool calling 执行的工具结果，必须和现在一样进 `ToolEvidenceProvider`，由完成闸门裁决。反说谎外骨骼是产品灵魂，新通路不能在它背后偷偷"完成"。

---

## 本会话已实测核实的事实（Codex 直接采信，勿重新臆测）

- **真实模型 ID**（live `GET https://api.deepseek.com/models` 200 实测）：`deepseek-v4-flash`（runner）、`deepseek-v4-pro`（grader）。DeepSeek V4 是真实产品，**不要再改成 `deepseek-chat/deepseek-reasoner`**（那是更早的命名，作为离线 fallback 的别名兼容即可）。
- **Base URL / 端点**：`https://api.deepseek.com`，OpenAI 兼容；聊天 `POST /chat/completions`，模型列表 `GET /models`。
- **现有 transport 既成字段**（`packages/kernel/src/model/deepseek/transport.ts`）：请求体已发 `model`/`messages`/`stream:false`/`response_format:{type:'json_object'}`（json 模式）/`thinking:{type:'enabled'|'disabled'}` + `reasoning_effort`。**复用这套，不要另起炉灶。**
- **现有主干协议**：`packages/kernel/src/brain/executor.ts` 调 `model.complete(role, messages, opts)` 拿到 `content`，`JSON.parse` 成结构化计划/动作。这是 function-calling 的"回退路径"，必须保留。
- **能力探针现状**（`probe.ts`）：能力位（toolCalling/jsonMode/fim/promptCaching/reasoning/streaming）目前是**文档常量**（`DOCUMENTED_CAPABILITY_FLAGS`），只有模型 ID 是 live 探的。本计划每个里程碑的 Task 1 都要把对应能力位升级为**真实探测**。
- **key/配置**：`~/.bobby/key` + `~/.bobby/capabilities.json`；环境变量 `DEEPSEEK_API_KEY`；`bobby login --from-env` 同步。

---

## Codex 派单顺序与验收门（whole-phase dispatch）

```
Phase A：原生 function-calling   （最大、最有价值；先做）
   A1 探针验证 toolCalling → A2 工具 schema 导出 → A3 transport 透传 tools/tool_calls
   → A4 executor 原生工具循环（保留 JSON 回退）→ A5 接线 + 证据/闸门贯通
Phase B：流式                     （中等；依赖 A 无强耦合，可并行）
   B1 探针验证 streaming → B2 transport 流式方法 → B3 ModelClient onToken → B4 CLI/GUI 渲染接线
Phase C：FIM                      （最小且最不确定；最后做，可能结论是"V4 不支持→保持关闭"）
   C1 探针验证 fim（端点+字段）→ C2 transport fim 方法（若支持）→ C3 infill 工具接线（若支持）
```

**每个 Phase 的验收门（必须全绿才进下一 Phase）：**
- `pnpm --filter @bobby/kernel test` 全绿；`pnpm --filter @bobby/cli test` 全绿。
- `pnpm -r typecheck` 干净；`pnpm lint` 零警告。
- 该 Phase 的能力位在探针为真时启用、为假时回退，二者都有测试覆盖。
- 端到端：配真实 key 后 `bobby run` 仍 `done` 且证据真实（人工或脚本冒烟一次）。

---

# Phase A — 原生 function-calling

**Goal:** 当 `useToolCalling=true` 时，把 hands 的工具以 OpenAI 兼容 `tools` schema 发给模型，模型回 `tool_calls`，executor 执行后以 `role:"tool"` 回灌，多轮直到收敛；工具结果照旧进 `ToolEvidenceProvider`。`useToolCalling=false` 时走现有 JSON 文本协议。

**Architecture:** 扩 `ChatRequest`/`ChatResponse`（transport 层）承载 `tools` 与 `tool_calls`；新增 `tool-schema.ts` 从 `ToolRegistry` 生成函数 schema；executor 增加"原生工具循环"分支，与现有 JSON 分支并存，由能力位选择。

## Task A1：探针真实验证 tool calling（TDD）
**Files:** 改 `packages/kernel/src/model/deepseek/probe.ts`；测 `tests/probe.test.ts`
- [ ] RED：写测试——给定一个 fake transport，对最小 `tools` 请求返回带 `tool_calls` 的响应 → 探针把 `useToolCalling` 置 true；返回 400/不支持 → 置 false。
- [ ] 实现：新增 `probeToolCalling(deps: DeepSeekProbeHttpDeps): Promise<boolean>`，发一发极小的 tool-call 试探请求（model=runner），看响应是否含 `choices[0].message.tool_calls`。把结果并入 `probeDeepSeek` 的能力位（覆盖文档常量）。`⚠️待核实`：试探请求体字段名。
- [ ] GREEN + 提交：`feat(deepseek): probe real tool-calling capability`

## Task A2：从 ToolRegistry 导出函数 schema（TDD）
**Files:** 建 `packages/kernel/src/model/deepseek/tool-schema.ts`；测 `tests/tool-schema.test.ts`
- [ ] RED：断言 `toToolSchemas(registry)` 把每个注册工具映射成 `{ type:'function', function:{ name, description, parameters /* JSON Schema */ } }`。先确认 hands 工具（`exec`/`write_file`/`file_exists` 等）是否已暴露 name/description/参数 schema；若未暴露，本 Task 先给 `Tool` 接口补一个 `describe(): ToolSchema` 或参数 JSON Schema 字段（这本身要 TDD）。
- [ ] 实现 + GREEN + 提交：`feat(deepseek): export tool registry as OpenAI-compatible function schemas`

## Task A3：transport 透传 tools / tool_calls（TDD）
**Files:** 改 `transport.ts`、`client.ts`；测 `tests/deepseek-transport.test.ts`、`tests/deepseek-client.test.ts`
- [ ] RED：
  - transport：`ChatRequest` 增 `tools?: ToolSchema[]`、`toolChoice?`；请求体在有 tools 时透传 `tools`（`⚠️待核实` 是否要 `tool_choice:'auto'`）。`ChatResponse` 增 `toolCalls?: Array<{ id, name, arguments /* string */ }>`，从 `choices[0].message.tool_calls` 解析。
  - client：`ModelCallOptions` 增 `tools?`；`complete` 把 tools 透传，把 `toolCalls` 带回 `ModelResponse`（`ModelResponse` 增 `toolCalls?`）。
- [ ] 实现 + GREEN + 提交：`feat(deepseek): pass tools and surface tool_calls through transport+client`

## Task A4：executor 原生工具循环（保留 JSON 回退）（TDD）★
**Files:** 改 `packages/kernel/src/brain/executor.ts`（或抽 `brain/tool-loop.ts`）；测 `tests/executor.test.ts`（+ 新 `tests/tool-loop.test.ts`）
- [ ] RED：用 MockModelClient 模拟"先回一个 tool_call → 收到 tool 结果后回最终 content"两轮。断言：
  1. 第一轮的 `tool_calls` 被逐个交给 `ToolRegistry` 执行；
  2. 执行结果以 `role:"tool"`、带 `tool_call_id` 追加进 messages 再次 `complete`；
  3. 循环受 `maxTurns`（来自 difficulty/escalation 预算）约束；
  4. **每个工具执行都产出与现在等价的 Evidence，进 `ToolEvidenceProvider`**；
  5. `useToolCalling=false` 时走原 JSON 解析分支（原测试不回归）。
- [ ] 实现：新增"原生工具循环"，与现有 JSON 分支二选一（按 `report.useToolCalling`）。`⚠️待核实`：`role:"tool"` 回灌的确切结构。
- [ ] GREEN + 提交：`feat(brain): native tool-call loop with evidence parity (fallback to JSON protocol)`

## Task A5：接线 + 证据/闸门贯通 + 端到端（TDD + 手测）
**Files:** 改 `packages/kernel/src/host/kernel-host.ts` / 接线处；测 `tests/kernel-host.test.ts`
- [ ] RED：host 在能力位为真时把 tool schema 注入编排链；断言完成闸门对"原生工具产出的证据"裁决与 JSON 路径一致（谎报/偷懒样例仍被拦 `failed`）。
- [ ] 实现 + GREEN。
- [ ] 手测：真实 key + `bobby run "建 hello.txt 写 hi 并 cmd /c type 验证"` → 仍 `done`、证据真实。
- [ ] 提交：`feat(deepseek): wire native tool-calling end-to-end behind capability flag`

---

# Phase B — 流式（streaming）

**Goal:** `useStreaming=true` 时，runner 的执行/叙述输出可逐 token 流到 CLI/GUI；**结构化 JSON 输出（intent/plan/grader）不流式**（需要完整 parse），或"流式展示 + 缓冲完整体再 parse"。`useStreaming=false` 走现有非流式。

**Architecture:** transport 增流式方法（SSE 解析）；ModelClient 增 `onToken` 回调或 `completeStream` 异步迭代；CLI（Ink `MessageStream`）/GUI（已有消息流组件）消费增量。

## Task B1：探针真实验证 streaming（TDD）
**Files:** 改 `probe.ts`；测 `tests/probe.test.ts`
- [ ] RED/实现：`probeStreaming` 发一发 `stream:true` 的极小请求，确认能拿到 SSE chunk → 置 `useStreaming`。`⚠️待核实`：V4 流式 chunk 字段。提交：`feat(deepseek): probe real streaming capability`

## Task B2：transport 流式方法（TDD）
**Files:** 改 `transport.ts`；测 `tests/deepseek-transport.test.ts`
- [ ] RED：注入一个 fake SSE 流（`data: {...}\n\n` 多块 + `data: [DONE]`），断言 `chatStream(req)` 产出有序的 `{ deltaContent }`（reasoning 模型的 `delta.reasoning_content` 单独标记或忽略），末块组装出与非流式等价的完整 content。
- [ ] 实现：`chatStream(req): AsyncIterable<ChatDelta>`，请求体 `stream:true`；SSE 解析（按行 `data:` 切、跳过 `[DONE]`）。`⚠️待核实`：确切 chunk 结构。
- [ ] GREEN + 提交：`feat(deepseek): SSE streaming transport`

## Task B3：ModelClient 流式 API（TDD）
**Files:** 改 `client.ts`、`model-client.ts`；测 `tests/deepseek-client.test.ts`
- [ ] RED：`complete(role, messages, { onToken })` 在 `useStreaming` 时走 `chatStream`，每 token 回调 `onToken`，返回的 `ModelResponse.content` 仍是完整文本（向后兼容）。
- [ ] 实现 + GREEN + 提交：`feat(deepseek): streaming-aware ModelClient.complete with onToken`

## Task B4：CLI/GUI 渲染接线（TDD）
**Files:** 改 `packages/cli/src/ui/MessageStream.tsx` + view-model；GUI `ChatStream` 组件；各测
- [ ] RED：断言 onToken 增量驱动消息流逐步渲染；非流式时一次性渲染（原行为）。
- [ ] 实现 + GREEN + 提交：`feat(cli,gui): incremental streaming render behind useStreaming`

---

# Phase C — FIM（Fill-in-the-Middle，最不确定）

> **重要：先验证 V4 是否支持 FIM。** 现状 `useFim=false`。如果探针/官方文档确认 V4-flash/pro **不支持** FIM，本 Phase 的正确结论就是：**保持关闭 + 在文档/注释里写明"已核实不支持"**，不强行实现。别为不存在的能力造代码。

**Architecture（仅当支持）:** DeepSeek FIM 走 Beta Completions 端点（`⚠️待核实`：`POST /beta/completions`，字段 `model`/`prompt`/`suffix`/`max_tokens`？）。作为 hands 的可选 "infill" 能力，供编辑类工具调用。

## Task C1：探针真实验证 FIM（TDD）
**Files:** 改 `probe.ts`；测 `tests/probe.test.ts`
- [ ] RED/实现：`probeFim` 发一发最小 FIM 试探（prefix+suffix），看是否返回补全 → 置 `useFim`。若 404/不支持 → false。提交：`feat(deepseek): probe real FIM capability (may resolve to unsupported)`
- [ ] **决策点**：探针为 false → 停在此 Task，文档记录"V4 当前不支持 FIM"，Phase C 收尾。

## Task C2：transport FIM 方法（仅当 C1 为真）（TDD）
**Files:** 改 `transport.ts`；测 `tests/deepseek-transport.test.ts`
- [ ] RED：fake transport 对 `fim({prefix, suffix})` 返回 infill 文本；断言请求打 FIM 端点、字段正确。
- [ ] 实现 + GREEN + 提交：`feat(deepseek): FIM (fill-in-the-middle) transport method`

## Task C3：infill 工具接线（仅当 C1 为真）（TDD）
**Files:** 建 `packages/kernel/src/hands/tools/infill.ts`；测对应
- [ ] RED/实现：把 FIM 暴露为一个 hands 工具，产出 file_diff 证据，纳入工具集与权限阶梯。
- [ ] 提交：`feat(hands): code-infill tool backed by DeepSeek FIM`

---

## ✅ 全局验收标准（Uplift-2 完成定义）

- [ ] 三个能力位（`useToolCalling`/`useStreaming`/`useFim`）均由**真实探针**决定，不再是写死常量；不支持优雅回退且有测试。
- [ ] 原生 function-calling：能力为真时端到端跑通，且**完成闸门对其证据的裁决与 JSON 路径等价**（三敌人回归集仍全绿）。
- [ ] 流式：能力为真时 CLI/GUI 逐 token 渲染；结构化 JSON 输出不被流式破坏（仍能正确 parse）。
- [ ] FIM：要么落地为受能力位保护的 infill 工具，要么明确记录"V4 不支持、保持关闭"。
- [ ] `pnpm -r test` / `pnpm -r typecheck` / `pnpm lint` 全绿；每步小提交（Conventional Commits）。
- [ ] 对自己也不撒谎（守 L6）：未核实的协议字段不许当成已核实写进代码，`⚠️待核实` 项必须先验证。
