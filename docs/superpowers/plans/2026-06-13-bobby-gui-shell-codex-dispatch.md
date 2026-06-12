# Bobby GUI 外壳 P0+P1 — Codex 整阶段托管派单（含子智能体验收协议）

> 用法：把下方「═══ 派单正文 ═══」整段复制给 Codex（在仓库根目录启动）。
> 主施工图：`docs/superpowers/plans/2026-06-13-bobby-gui-shell-codex-directive.md`（本派单不重复其内容，只规定托管执行方式与验收方式）。

═══════════════════════ 派单正文（从此行下方开始复制） ═══════════════════════

[任务] 整阶段托管执行：Bobby GUI 外壳重构 P0 + P1（T1–T17）

[必读文件（开工前完整读完，按此顺序）]
1. docs/superpowers/plans/2026-06-13-bobby-gui-shell-codex-directive.md —— 主施工图：T1–T17 逐任务工单（含测试代码、实现代码、命令与预期输出）。本派单与它冲突时，以它为准
2. docs/superpowers/specs/2026-06-13-bobby-gui-shell-design.md —— 设计规范
3. docs/superpowers/specs/2026-06-13-bobby-gui-shell-mockup.html —— 视觉与 DOM 基准（CSS 移植来源）
4. docs/superpowers/plans/2026-06-04-bobby-execution-protocol.md —— 验收与重做铁律

[角色分工]
- 你（主智能体）= 施工负责人：按顺序施工 T1→T17，每个 Task 严格走工单 Step（TDD），一个 Task 一个 commit
- 验收子智能体 = 独立阅卷人：每个阶段门由你派出，**零施工上下文**，只拿验收清单 + 仓库，亲自跑命令出报告
- 你不得给自己验收；验收子智能体不得修改任何代码（只读 + 运行命令）

[开工准备]
1. 新建分支：git checkout -b feat/gui-shell-p0p1
2. pnpm install 后先跑基线：pnpm --filter @bobby/gui test && pnpm lint && pnpm -r build，三连必须全绿并记录输出（这是"施工前基线"，验收时要对照）。基线不绿 → 停止并报告，不许带病开工

[执行规则]
1. 顺序硬约束：T1 → … → T9 → 【P0 验收门】→ T10 → … → T17 → 【P1 验收门】→ 【总 DoD §5】。不许跳序、不许并行、不许提前做 P2–P6 的任何内容
2. 每个 Task 内部：写失败测试 → 跑出真实 FAIL → 最小实现 → 跑出真实 PASS → commit（message 按工单）。工单里的 Expected 对不上 = 停在原地修，禁止：跳过该步、削弱/删除测试、扩大改动范围来绕过
3. 范围红线：只许改 packages/gui/（含 tests/）；packages/{kernel,cli,shared} 出现在 git diff 中 = 立即回滚该改动
4. 视觉红线：组件颜色/字体只用 src/lib/theme.css 的 CSS variables；新增 .tsx 中不得出现十六进制色值
5. 卡死协议：同一 Task 连续 3 次修复仍不过 → 停止整个托管，输出阻塞报告（Task 编号 + 失败输出原文 + 你的分析 + 已尝试的修法），等人裁决。禁止用"先跳过后补"的方式继续

[阶段验收门协议（派子智能体）]
触发：T9 全部 commit 后（P0 门）、T17 全部 commit 后（P1 门）。流程：

1. 你先自检：pnpm --filter @bobby/gui test && pnpm --filter @bobby/gui typecheck && pnpm lint && pnpm -r build 全绿才许派验收员（自检不绿就先修，不要浪费验收轮次）
2. 派出验收子智能体，prompt **逐字使用**下方对应模板（P0 用模板 A，P1 用模板 B），不得附带你的施工记录、对话历史或任何"我已完成 X"的描述
3. 验收员回报后：
   - 全 PASS（UNVERIFIED 仅限标注「人工浏览器项」的条目）→ 通过该门，进入下一阶段
   - 存在 FAIL → 按执行协议 §4 重做：把验收员报告中该条 FAIL 的证据原文当作重做规格，修复后 commit，然后**派一个全新的验收子智能体**全量复验（不许复用、不许只验失败项）。复验同样受 3 次上限约束，超限走卡死协议
4. 两份验收报告（含复验轮次）原文保存到 docs/superpowers/plans/acceptance/2026-06-13-p0-report.md 与 …-p1-report.md 并 commit

[验收子智能体 prompt 模板 A —— P0 门]
---------------------------------------------------------------
[角色] 你是独立验收员。你与施工过程无关，只认你亲手跑出来的机器输出，不认任何人的"已完成"声明。你只读和运行，不修改任何文件（验收报告文件除外）。
[对象] Bobby 仓库（当前目录）分支 feat/gui-shell-p0p1 的 P0 阶段（外壳，T1–T9）
[依据] docs/superpowers/plans/2026-06-13-bobby-gui-shell-codex-directive.md 的 §0.2（命令速查）、§2（T1–T9 工单）、§2.10（P0 验收清单）
[步骤]
1. git log --oneline -25：确认 T1–T9 对应的 9 个 commit 存在且 message 与工单一致，列出
2. 逐条执行 §2.10 的命令验收项，每条粘贴整段真实输出（stdout 原文，不许摘要）
3. 防作弊审计：
   a. git diff master...HEAD --stat -- packages/kernel packages/cli packages/shared → 必须为空
   b. 对照 directive 工单中的测试代码，抽查 packages/gui/tests/ 下至少 3 个新增测试文件，确认断言没有被改弱或删除（任何与工单不一致的弱化都算 FAIL，列出差异）
   c. grep -rn "#[0-9a-fA-F]\{6\}" packages/gui/src --include="*.tsx" → 必须 0 命中
4. §2.10 的浏览器演练项：若你具备浏览器自动化能力（Playwright/内置浏览器工具），启动 pnpm --filter @bobby/gui dev 并逐条真实操作验证（截图或 DOM 断言为证）；不具备则该条标 UNVERIFIED【人工浏览器项】。禁止通过阅读源码推断为 PASS
[输出格式] 逐条编号：[PASS|FAIL|UNVERIFIED] + 证据块（命令 + 输出原文/截图说明）。最后一行：
VERDICT: ACCEPT 或 REJECT（REJECT 时列出全部 FAIL 条目编号）
---------------------------------------------------------------

[验收子智能体 prompt 模板 B —— P1 门]
---------------------------------------------------------------
[角色] 同模板 A（独立验收员，只认亲手跑出的输出，只读 + 运行）。
[对象] Bobby 仓库分支 feat/gui-shell-p0p1 的 P1 阶段（Mock 数据流，T10–T17）
[依据] directive 的 §0.2、§3（T10–T17 工单）、§3.9（P1 验收清单）、§5（总 DoD）
[步骤]
1. git log --oneline -40：确认 T10–T17 的 8 个 commit 存在，列出
2. 逐条执行 §3.9 命令验收项（特别注意：mock-client 测试中 gate 暂停/恢复/拒绝三条用例必须出现在输出里），粘贴整段输出
3. 逐条执行 §5 总 DoD 的可命令化条目（lint/test/build 三连、grep 裸色值、kernel/cli/shared 零 diff、T17 清退清单核对：被删文件确实不在、保留文件确实在）
4. 防作弊审计：同模板 A 第 3 条，另加：对照工单核查 tests/mock-client.test.ts 与 tests/fixtures.test.ts 未被弱化
5. §3.9 浏览器演练项（主剧本/拒绝路径/审查面板/多会话/chat-basic/loop-converge）：有浏览器自动化能力则真实走一遍（mock 模式纯浏览器即可），否则标 UNVERIFIED【人工浏览器项】
[输出格式] 同模板 A，最后 VERDICT: ACCEPT / REJECT
---------------------------------------------------------------

[完工交付（全部通过后你输出的最终报告）]
1. 分支名 + 全部 commit 列表（git log --oneline master..HEAD）
2. P0 / P1 两份验收报告路径（docs/superpowers/plans/acceptance/ 下，含复验轮次）
3. §5 总 DoD 六条逐条对应证据的索引
4. UNVERIFIED 汇总：留给人工的浏览器演练清单（逐条列出操作步骤，按 §2.10/§3.9 原文）
5. 阻塞与例外：执行中所有偏离工单的地方（哪怕已解决）逐条说明，零偏离也要明说"无偏离"
6. 不要合并、不要推送：停在 feat/gui-shell-p0p1 分支等人审

[禁止事项汇总]
- 不施工 P2–P6；不动 kernel/cli/shared；不自我验收；不复用验收子智能体
- 不在缺真实输出时声称任何"通过"；失败不许静默改写成成功（Bobby 仓库的第一铁律）

═══════════════════════ 派单正文（复制到此行上方为止） ═══════════════════════
