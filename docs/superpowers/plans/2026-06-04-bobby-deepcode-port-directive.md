# Bobby — Deep Code「DeepSeek 增益」移植指令（A–H）

> **For agentic workers (GPT-5.5 总工程师 → 5.3-codex-spark 工人):** 按 `2026-06-04-bobby-execution-protocol.md` 执行：一个工作项一单、严格 TDD、总工程师**亲自跑测试**验收、不行重做。
> 参考源（只读、用于学习，**不照抄**）：`E:\Deep Code Develop\src\runtime\...`
> Bobby 设计稿：`docs/superpowers/specs/2026-06-04-bobby-deepseek-agent-design.md`

## 0. 范围与铁律护栏（最重要，先读）
- ✅ **只移植"提升 DeepSeek 推理/代码能力 + 解决用户需求/便利性"的东西**。
- ❌ **不碰 Deep Code 的 TUI/Ink 组件**（CLI 交互见另一份 `*-cli-claude-code-directive.md`）。
- ❌ 不移植：并行 TTC（self-consistency/S\*）、完整记忆学习库、think 状态机、检索/embeddings/treesitter/LSP。
- **适配而非复制**：Deep Code 是 JS，Bobby 是 TS + Zod + Vitest + monorepo；移植=理解其思想，用 Bobby 的架构与铁律重写。
- **绝不削弱良心层**：升级/自查/分流/快照只改"谁做、做多少、先自查、可回滚"，**完成闸门（出题人≠阅卷人）永远是判定 `done` 的唯一权威**；任何"分数/摘要/自评"都不得替代闸门裁决。

---

## PORT-0（前置修复｜moat 漏洞）：接上禁令校验
**现状 bug**：`packages/kernel/src/brain/orchestrator.ts` 第 85 行 `gate.evaluate(contract, verdicts, [])`——`constraints` 恒为空，**用户禁令完全没生效**。这违背设计稿 §6.8。
- **改**：`ConscienceDeps` 增加 `constraintCheckers` 与对 `ExecContext`（触碰路径等）的获取；`evidenceFor` 改用 `ToolEvidenceProvider` 并暴露 `context()`；闸门前调用 `enforceConstraints(contract.constraints, ctx, checkers)` 把结果传入 `gate.evaluate(...)`。
- **验收**：新增 orchestrator 测试——契约带 `禁止改 path:src/legacy/`，步骤触碰该路径 → `final_result=failed`（禁令命中）；不触碰 → 正常。

---

## PORT-A：分模型「编码行为」提示词（DeepSeek 推理/代码增益 #1）
- **参考**：`runtime/prompts/coding-flash.js`、`coding-pro.js`。
- **改**：`packages/kernel/src/brain/system-prompts.ts` 新增 `FLASH_CODING_PROMPT`、`PRO_ARCHITECT_PROMPT`（中文、按 DeepSeek 脾气）；在 `executor.ts`（role=runner）拼接 Flash 规则，在 `intent.ts`/`planner.ts`（role=grader）拼接 Pro 架构规则。**保留**现有 JSON-only/反自夸约束。
- **要点（Flash 规则）**：先读后改、grep 精确定位、先读测试、>200 字先 `<thinking>`、**最小编辑禁止整文件重写**、改签名先查调用者、改完即验、省钱（offset/limit）。
- **要点（Pro 规则）**：模块边界图 + 不变量陈述 + 变更传播图、**逐条 file:line 证据链编辑（无证据不改）**、reasoning_effort、精确优先于范围。
- **铁律**：这些是行为约束，**不替代闸门**；保留"不许把'完成'当证据"。
- **验收**：单测断言——拼装后的 runner 系统消息含"先读后改/最小编辑"关键句；grader 系统消息含"证据链/不变量"关键句；现有 intent/plan/exec/pro-review 测试仍全绿。

## PORT-B：Flash→Pro 升级链（objective-first｜DeepSeek 解题增益 #2）
- **参考**：`runtime/escalation.js`。
- **改**：新增 `packages/kernel/src/model/deepseek/escalation.ts`（`buildEscalationPlan(tier, failCount)` → {model, reasoning_effort, maxTurns}）；`orchestrator.ts` 的每步循环**加入"验证失败→重试→升级"**：同一步验证 fail，先原级重试（≤2），仍失败则 runner→grader 并抬高 reasoning_effort；`deepseek/client.ts` 支持按调用传 `model` 覆盖与 `reasoning_effort`。
- **关键适配（铁律对齐）**：升级**主要由客观裁决失败驱动**，不依赖模型自报。Deep Code 的 `<<<NEEDS_PRO>>>` 自升级**可作为次要提示**（运行器 JSON 里加可选 `needsPro:true`），但**绝不能成为唯一依据**——我们不信任模型的自我判断。
- **铁律**：升级只改"谁做/多大算力"；闸门不变；升级有上限 → 触顶则 `blocked` + 上报，**绝不伪造 done**。
- **验收**：测试——某步证据连续 fail，编排器先重试、再升级到 grader（含更高 reasoning_effort）；始终失败 → 终态 `blocked/failed`（绝不 done）；重试后通过 → `done`。

## PORT-C：DeepSeek V4 前缀缓存纪律（省钱/提速）
- **参考**：`runtime/prefix-cache.js`。
- **改**：扩展 `packages/kernel/src/model/deepseek/cache.ts`——稳定 `<2K` 系统前缀构造、`getProSessionId()`（60 分钟窗口）、**Pro 专用精简工具表（仅 read_file/grep/replace_text 等 4 个，vs Flash 全量）**；`client.ts`/`transport.ts` 发送稳定前缀 + 会话标识。
- **铁律**：缓存只影响成本/延迟，不改变语义与裁决。
- **验收**：测试——同上下文两次 Pro 调用前缀哈希一致；Pro 工具数 ≤ 上限；会话 id 在 60 分钟内稳定。

## PORT-D：难度→预算分级（控成本 + 给难任务空间）
- **参考**：`runtime/ttc/budget-allocator.js`（**只取难度→预算映射，不要并行 S\* 模式**）。
- **改**：新增 `packages/kernel/src/model/deepseek/difficulty.ts`（`estimateDifficulty(contract)→score`、`scoreToTier`、`allocateBudget→{maxTurns,maxRetries,reasoning_effort}`）；接入 PORT-B 的重试上限与 `BudgetGuard`。
- **铁律**：预算只控"做多少/多深"，不放宽验收。
- **验收**：测试——分数→tier→预算映射正确；更难 tier → 更多 retries + 更高 reasoning_effort；与 BudgetGuard 上限协同（超限抛错）。

## PORT-E：测试失败结构化回灌（DeepSeek 解题增益 #3）
- **参考**：`runtime/testParser.js`。
- **改**：新增 `packages/kernel/src/conscience/test-feedback.ts`（`parseTestOutput(text)→{passCount,failCount,failures,files,errorMessages}`、`formatTestFailureContext`），适配 Vitest/node 输出格式；在 PORT-B 的重试路径里，若失败证据含 `command_output/test_run`，解析后把**结构化失败上下文**注入下一次 runner 提示。
- **铁律**：解析摘要**只喂重做**；判定 `done` 仍由闸门**独立重跑**测试，摘要不当裁决。
- **验收**：给定样例失败输出 → 解析出失败用例/涉及文件/错误消息；重做提示包含该结构化上下文。

## PORT-F：意图分流（便利性 + 省钱，直接改善"手感"）
- **参考**：`runtime/intent.js`（`classifyIntent`）。
- **改**：新增 `packages/kernel/src/brain/triage.ts`（用 runner/Flash、`max_tokens` 极小、带离线正则兜底，返回 `GREETING|QUESTION|TASK|COMMAND`）；在 `kernel-host.ts`/编排器**最前端**分流：`GREETING/QUESTION` → 廉价直答（不进 intent→plan→verify）；`TASK` → 完整重型循环；`COMMAND` → 命令处理。
- **关键适配（铁律对齐）**：**模棱两可默认 `TASK`**（与 Deep Code 默认 GREETING 相反——宁可多干，不可把真需求当寒暄丢掉）；**任何会改文件的请求绝不能走快路绕过闸门**——分流只决定"是否进重型循环"，自身绝不产出文件改动。
- **验收**：`"你好"/"?"` → GREETING 秒回、无 plan/verify 事件；`"帮我建 hello.txt"` → TASK → 完整循环；含糊输入 → TASK。

## PORT-G：声明式子 agent + 隔离 worktree + 补丁提案（解决用户需求/可扩展）
- **参考**：`runtime/subagent.js`（`loadAgents`/`dispatchTaskSubagents`）、`worktree.js`、`patches.js`。
- **改**：新增 `packages/kernel/src/subagent/{agent-loader.ts, dispatch.ts}`。
  - `agent-loader`：解析 `.bobby/agents/*.md` frontmatter（`name/description/model/tools/triggers/systemPrompt`，**与 Claude Code 子 agent 格式一致**）。
  - `dispatch`：每个子 agent 在**独立 git worktree** 执行 → 产出 diff → 存为**补丁提案（不自动应用）** → **必须过良心闸门 + Pro 复核 + 人类确认后才合并**。
- **铁律**：子 agent 产出永远是**提案**；**不能自批**；合并前必过闸门。隔离 = worktree（= 设计稿"隔离工作区"）。这与你 GPT-5.5 总工程师/spark 工人的分工同构。
- **范围（大道至简）**：本轮只做"声明式加载 + 单个隔离派发 + 补丁提案 + 闸门后合并"；并行 fan-out 留后。
- **验收**：加载样例 `.bobby/agents/foo.md`；派发一个琐碎任务 → 在提案目录生成 patch、**主工作区无改动**；只有调用合并（经闸门 + 确认）后才落地。

## PORT-H：工作区快照 + 一键回滚（解决用户需求/安全感）
- **参考**：`runtime/snapshot.js`。
- **改**：新增 `packages/kernel/src/hands/snapshot.ts`（`createSnapshot/listSnapshots/restoreSnapshot`，拷贝工作区 text-like 文件到 `.bobby/snapshots/<id>` + manifest，排除 `node_modules/.git/.bobby`）；编排器在任务**首个会改文件的步骤前自动快照**；`kernel-host.ts` 暴露 `restore` 命令，CLI/GUI 提供入口。
- **铁律**：快照是"撤销"便利，**不替代闸门**；改动前自动快照，让 `failed/blocked` 任务可秒回滚。
- **验收**：快照 → 改文件 → restore → 内容还原；快照不含 `node_modules/.git/.bobby`。

---

## 派发顺序（总工程师参考）
```
PORT-0（修禁令）→ PORT-A（提示词，纯文本，最快见效）
   ├─ PORT-B（升级链，依赖 client 支持 reasoning_effort/model 覆盖）
   │     └─ PORT-D（难度预算，接 B 的重试上限）
   │     └─ PORT-E（测试回灌，接 B 的重试路径）
   ├─ PORT-C（前缀缓存，独立）
   ├─ PORT-F（意图分流，独立，前端口）
   ├─ PORT-H（快照，独立）
   └─ PORT-G（子agent，较大，可最后做）
```
A/C/F/H 之间互不依赖，可并行派发；B→(D,E) 有序；G 独立但最大，建议压轴。

## 全局验收（守 L6）
- [ ] `pnpm -r test` 全绿（含每个 PORT 的新测试）。
- [ ] **回归不破**：现有 M0–M7 测试仍绿，尤其 M2 良心引擎与 M6 三敌人回归集。
- [ ] **铁律未被削弱**：升级/分流/快照/自查都不能让任务在未过闸门时显示 `done`；新增对抗测试——构造"模型自报完成但证据不足/触犯禁令" → 仍 `failed/blocked`。
- [ ] 真实端到端：配 DeepSeek Key 后，寒暄秒回、任务进重型循环并产真实证据、失败能升级、改动可回滚。
