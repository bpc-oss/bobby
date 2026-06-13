# Bobby Eval-Harness + 能力抬升 实施计划（Codex 指令）

> **For agentic workers（Codex 必读）：** REQUIRED SUB-SKILL：`superpowers:subagent-driven-development` 或 `superpowers:executing-plans`。
> 总纲：`2026-06-04-bobby-v1-master-plan.md`；姊妹计划：`2026-06-13-bobby-deepseek-uplift-2.md`（function-calling/FIM/流式，能力通路）。
> 本计划解决的是另一件事：**用弱模型 + 外骨骼把"任务成功率"抬到强模型水平**——并且**先建评测闭环再抬，每个抬升杠杆都用数字验收，不许凭感觉**。

**核心命题（写进每个人脑子里）：** base model 的单次推理智力固定，改不了。我们能抬的是**任务成功率**，靠 **test-time compute + scaffolding**。抬升上限 ≈ **验证器质量 × 任务可验证性**。所以：
1. **先量后抬**：没有评测 harness，任何"抬升"都是自我安慰。Phase 0 必须最先做。
2. **验证器是天花板**：算力优先投在"加确定性 oracle / 提高验证器判别力"，而不是无脑加采样。
3. **守 L6（对自己也不撒谎）**：每个杠杆只有在 harness 上对基线有**可复现的、成本可接受的提升**才允许保留；没提升或提升靠噪声 → 回滚并记录。

---

## ⚠️ 铁规

1. **严格 TDD**：RED → 确认失败 → 最小实现 GREEN → 确认通过 → 重构 → 小提交（Conventional Commits）。函数 <50 行、文件 <800 行。
2. **harness 自身的单测用 `MockModelClient` / 注入式 transport，绝不打真实网络、不烧钱**；真实模型评测是**单独的、手动触发的、会计费的** live 模式（Phase 0 Task 0.5）。
3. **复用既有件，别造重复轮子**：难度分级 `model/deepseek/difficulty.ts`、升级 `escalation.ts`、预算 `routing.ts(BudgetGuard)`、反馈 `conscience/test-feedback.ts`、裁判 `conscience/oracles/{deterministic,coverage,pro-review}.ts`、证据/闸门 `conscience/{engine,gate}.ts`、宿主 `host/kernel-host.ts`、编排 `brain/orchestrator.ts`。
4. **不破坏 M2 防线**：任何抬升策略产出的"完成"仍须过完成闸门 + 三敌人回归集仍全绿。
5. **每个抬升杠杆 = 一个可开关的策略**，默认行为不变；开关打开才生效，且 harness 上要有 A/B 数据支撑。

---

## 已核实事实（直接采信）

- 模型：`deepseek-v4-flash`(runner) / `deepseek-v4-pro`(grader)，OpenAI 兼容 `https://api.deepseek.com`。
- `BudgetGuard` 已统计 Pro/Flash 调用数与累计 USD —— harness 的成本指标直接读它。
- `difficulty.ts` 已有 `estimateDifficulty → tier(simple/normal/difficult) → allocateBudget(maxTurns/maxRetries/reasoning_effort)`；`escalation.ts` 已有 Flash→Pro 升级。这些是"算力分配"杠杆的现成地基。
- `MockModelClient` 支持按角色喂脚本化输出（grader/runner），harness 的离线确定性测试靠它。

---

## Codex 派单顺序与验收门

```
Phase 0  评测 harness（先量；阻塞后续一切）
Phase 1  验证器质量（天花板杠杆；先于采样）
Phase 2  test-time compute 杠杆（Best-of-N / Reflexion / 自一致 / 算力分配）
Phase 3  flash+pro 合体编排（Plan→Draft×N→Verify→Repair / 投机草稿）
Phase 4  grounding（检索；可选蒸馏，verify-first）
```

**通用验收门（每 Phase 结束必须）：** `pnpm -r test` 全绿；`pnpm -r typecheck` 干净；`pnpm lint` 零警告；三敌人回归集全绿。
**抬升类 Task 额外门：** 必须在 Phase 0 的 harness 上跑出"开关 ON vs OFF"对比，**ON 的 pass@1/pass@k 有提升且成本在预算内**，把数字贴进提交说明；否则该 Task 标记为"无效杠杆"并回滚实现（保留测试与结论）。

---

# Phase 0 — 评测 harness（先量后抬）

**Goal:** 一个能对"任意 Bobby 配置"在"一组带 ground-truth 的任务"上跑出 `pass@1 / pass@k / 平均回合 / 平均 USD / 墙钟` 的离线可测、可 live 触发的评测系统。落新包 `packages/eval`（依赖 `@bobby/kernel`、`@bobby/shared`）。

## Task 0.1：任务用例 schema + 加载器（TDD）
**Files:** 建 `packages/eval/src/task-case.ts`、`packages/eval/fixtures/*`；测 `tests/task-case.test.ts`
- [ ] RED：断言加载器把一个 fixture 解析成 `TaskCase { id, prompt, workspaceSeed?: {path:content}[], oracle: OracleSpec, difficultyTag }`，并对缺字段/无 oracle 的用例报错（无验证器的任务**不允许**进套件，除非显式标 `unverifiable:true`）。
- [ ] 实现 + GREEN + 提交：`feat(eval): task-case schema and fixture loader`

## Task 0.2：RunConfig 抽象 + harness runner（TDD，Mock 驱动）
**Files:** 建 `packages/eval/src/run-config.ts`、`packages/eval/src/runner.ts`；测 `tests/runner.test.ts`
- [ ] RED：定义 `RunConfig { label, model:'flash'|'pro'|'ensemble', samples:N, retryBudget, reasoning_effort, strategy }`。用 `MockModelClient` + 临时 workspace 跑一个 `TaskCase`，断言 runner：① 用该配置构 `KernelHost`；② 跑完产出 `RunOutcome { taskId, passed, turns, usd, ms, finalStatus }`；③ `passed` 由该用例的 oracle 判定（不是模型自称）。
- [ ] 实现 + GREEN + 提交：`feat(eval): RunConfig + harness runner over KernelHost`

## Task 0.3：指标 + 计分卡（TDD）
**Files:** 建 `packages/eval/src/scorecard.ts`；测 `tests/scorecard.test.ts`
- [ ] RED：给一组 `RunOutcome[]`，断言聚合出 `pass@1`、`pass@k`（同一任务多次采样的并集通过率）、`mean turns`、`mean USD`、`mean ms`，并渲染成 markdown + JSON 双格式。
- [ ] 实现 + GREEN + 提交：`feat(eval): metrics and scorecard (pass@1/pass@k/cost/turns)`

## Task 0.4：配置矩阵 + 基线清单（TDD）
**Files:** 建 `packages/eval/src/matrix.ts`；测 `tests/matrix.test.ts`
- [ ] RED：断言矩阵能笛卡尔展开 `{flash裸, flash+scaffold, pro+scaffold, flash+pro合体}` × 套件，并对每个配置产出独立计分卡 + 一张对比表。
- [ ] 实现 + GREEN + 提交：`feat(eval): config matrix and baseline comparison table`

## Task 0.5：live 评测入口 + 初始套件（半自动，会计费）
**Files:** 建 `packages/eval/src/cli.ts`（`bobby-eval` bin 或 `pnpm --filter @bobby/eval bench`）；建 ≥20 条 fixture（覆盖 simple/normal/difficult，均带确定性 oracle：建文件/改代码过测试/跑命令退出码等）
- [ ] 实现：live 模式读 `~/.bobby/{key,capabilities}`，对矩阵跑真实模型，落计分卡到 `packages/eval/reports/<date>/`。**默认 dry-run/mock；`--live` 才打真实 API 且打印预计花费、需确认。**
- [ ] 手测：`--live` 跑一遍小套件，产出第一张四配置对比表（这就是回答"Flash 到没到 Sonnet 水平"的事实依据）。
- [ ] 提交：`feat(eval): live benchmark CLI + initial ground-truth task suite`

---

# Phase 1 — 验证器质量（天花板杠杆）

> 先把"尺子"做准。验证器烂，后面采样越多越自信地错。

## Task 1.1：扩充确定性 oracle 覆盖（TDD）
**Files:** 改 `packages/kernel/src/conscience/oracles/deterministic.ts`（+ 新 oracle）；各测
- [ ] RED/实现：补 T0–T2 判定（如：测试用例通过计数、lint/typecheck 退出码、文件内容精确/正则匹配、JSON schema 校验）。每个 oracle 给出可解释的判别理由。
- [ ] 提交：`feat(conscience): expand deterministic T0-T2 oracles`

## Task 1.2：验证器判别力指标（TDD）
**Files:** 建 `packages/eval/src/verifier-power.ts`；测对应
- [ ] RED/实现：对一批"已知对/已知错"的样本，量化 oracle 的真阳/假阳率（验证器把错的判成对 = 致命）。harness 报告里展示，低判别力的任务标红。
- [ ] 提交：`feat(eval): verifier discrimination metric (false-accept guard)`

---

# Phase 2 — test-time compute 杠杆（逐个挂上、逐个用 harness 验收）

## Task 2.1：Best-of-N 采样 + 选择（TDD）★
**Files:** 建 `packages/kernel/src/brain/sampling.ts`；测 `tests/sampling.test.ts`
- [ ] RED：用 MockModelClient 喂 N 个候选（部分过 oracle、部分不过）。断言 `bestOfN(runner, N, select)`：① 采 N 个；② 优先用确定性 oracle 选过的；③ oracle 无法区分时用 Pro 裁判（`ProReviewOracle`）打分选最高；④ 受 `BudgetGuard` 约束。
- [ ] 实现 + GREEN。**harness A/B：** N=1 vs N=4/8 的 pass@1 与 USD 曲线。
- [ ] 提交：`feat(brain): best-of-N sampling with oracle/Pro-judge selection`

## Task 2.2：Reflexion 式结构化重试（TDD）★
**Files:** 改/扩 `packages/kernel/src/conscience/test-feedback.ts` + `brain/orchestrator.ts`；测对应
- [ ] RED：失败的尝试 → 把 oracle 失败详情结构化成"批判"喂回下一轮 → 重试，受 `escalation`/`difficulty` 预算约束。断言"带结构化反馈的重试"比"裸重试"在 mock 场景下更快收敛。
- [ ] 实现 + GREEN。**harness A/B：** 反馈 ON vs OFF 的 pass@k / 平均回合。
- [ ] 提交：`feat(conscience): reflexion-style structured retry on oracle failure`

## Task 2.3：结构化输出自一致（TDD）
**Files:** 建 `packages/kernel/src/brain/self-consistency.ts`；测对应
- [ ] RED：对 plan/intent 这类 JSON 输出多采样 → 归一化后多数票/按 schema 合法性收敛。断言抖动样本被投票纠正。
- [ ] 实现 + GREEN。**harness A/B：** 计划阶段错误率。
- [ ] 提交：`feat(brain): self-consistency voting for structured outputs`

## Task 2.4：难度驱动的算力分配（TDD）
**Files:** 改 `packages/kernel/src/model/deepseek/difficulty.ts` + `escalation.ts`；测对应
- [ ] RED：扩 `allocateBudget(tier)` 输出 `{ samples, retries, reasoning_effort, useEnsemble }`；简单任务省、难任务才上 Best-of-N + Pro + 高 reasoning。断言分级映射正确且被 BudgetGuard 兜底。
- [ ] 实现 + GREEN。**harness A/B：** 固定算力 vs 难度自适应 的 pass@1/总成本（看性价比帕累托）。
- [ ] 提交：`feat(deepseek): difficulty-driven test-time-compute budgeting`

---

# Phase 3 — flash + pro 合体编排

## Task 3.1：Plan→Draft×N→Verify→Repair 策略（TDD）★
**Files:** 建 `packages/kernel/src/brain/strategies/plan-draft-verify-repair.ts`；测对应
- [ ] RED：Pro 出计划 → Flash 出 N 份草稿 → 确定性 oracle 验 → 失败的交 Pro 修复 → 再验，全程受预算约束、产证据进闸门。断言整条链产出与单模型路径等价的真实证据。
- [ ] 实现 + GREEN。**harness A/B：** 合体 vs Pro 独跑 vs Flash 独跑 的 pass@1 / USD（核心结论表）。
- [ ] 提交：`feat(brain): ensemble strategy plan->draft(N)->verify->repair`

## Task 3.2：投机草稿（Flash 草稿，Pro 仅在失败时修）（TDD）
**Files:** 扩上面策略或新 `speculative-draft.ts`；测对应
- [ ] RED/实现：先 Flash 一发，过 oracle 就收（省 Pro）；不过才升 Pro 修复。断言"易任务零 Pro 调用、难任务才触发 Pro"。
- [ ] 提交：`feat(brain): speculative draft-and-revise (Pro only on failure)`

---

# Phase 4 — grounding（可选，仍用 harness 验收）

## Task 4.1：仓库/文档检索工具（TDD）
**Files:** 建 `packages/kernel/src/hands/tools/retrieve.ts`；测对应
- [ ] RED/实现：把"按需检索代码/文档片段喂上下文"做成 hands 工具，产可追溯来源的上下文。**harness A/B：** 检索 ON vs OFF 在"需仓库知识"的任务上的 pass@1。
- [ ] 提交：`feat(hands): repo/doc retrieval tool for grounded context`

## Task 4.2：领域蒸馏（可选；verify-first）
**Files:** `docs/` 调研记录 + （若可行）`packages/eval` 训练/评估脚本
- [ ] **先核实** DeepSeek 是否开放微调/蒸馏接口与配额（`⚠️待核实`，官方文档为准）。
- [ ] 若可行：用 Pro/frontier 在你高频任务域的成功轨迹蒸馏 Flash，harness 上对比蒸馏前后。若不可行：记录结论，关闭本 Task。
- [ ] 提交：`docs(eval): domain distillation feasibility + (optional) pipeline`

---

## ✅ 全局验收标准（本计划完成定义）

- [ ] `packages/eval` 能离线（mock）跑通全套 + `--live` 真实评测，产四配置对比计分卡。
- [ ] 每个抬升杠杆（2.1–2.4、3.1–3.2、4.x）都有 harness 上的 **ON vs OFF A/B 数据**贴在提交里；无提升的杠杆被标记并回滚实现。
- [ ] 产出一份**事实结论**：在你的任务套件上，`flash+scaffold` 是否达到 `sonnet-4.6 裸跑` 水平、`pro+scaffold` 是否达到 `opus-4.8 裸跑`、`flash+pro 合体` 与 `fable-5 裸跑` 的差距与成本比——**用数字说话，不许 vibes**。
- [ ] `pnpm -r test` / `typecheck` / `lint` 全绿；三敌人回归集全绿；完成闸门未被任何新策略绕过。
- [ ] 守 L6：未核实项（如蒸馏接口）不当已核实写；无效杠杆诚实记录为无效。
