# Bobby — 双桌面版对齐指令（E 系列：全面达到 Codex Desktop + Claude Code Desktop 水平）

> **For chief (GPT-5.5):** 按 `2026-06-04-bobby-execution-protocol.md` 派单/验收/重做。
> 本指令基于 2026-06-11 晚对"全清事故恢复后"工作区的实地审计（git log / 全量测试 / 关键 grep），非臆测。
> 前序：`2026-06-11-bobby-gui-codex-desktop-directive.md`（D 系列，部分完成）+ `2026-06-11-bobby-gui-directive-codex-edition.md`（含十面板需求）。

## 0. 恢复成色审计结论（2026-06-11）
- 提交历史完好（最后 commit `22b157d`）；恢复成果 **32 文件 +2925/−628 全部悬在工作区未提交** ——上次"全清"事故的根源就是不提交，现在仍在裸奔。
- 全量测试 **523/525 过，2 个失败**：`packages/gui/tests/setup-ipc.test.ts` 的 ① "reports onboarding status from the local Bobby files" ② "rebuilds the kernel host from settings baseUrl and stored secret"（D2 设置→createHost 接线 bug）。
- D 系列状态：D1 项目✅ / D2 设置⚠️(2 failing) / D3 并行❌未做 / D4 半成(tasks:list/read 有、会话落盘无) / D5 闭环待接 / D6 系统集成✅ / D7 onboarding 有测试 / D8 壳+测试。
- `SessionToolDock` 十面板（mission/plan/review/diff/terminal/files/browser/sidechat/preview/tasks）**壳全在**，但 Terminal/Browser/Preview 实现是 `buildPrompt` 把输入转发给 agent——**不是真终端/真文件树/真预览**。

## 1. 双对标差距表（全部有代码证据）
| 能力域 | Codex Desktop | Claude Code Desktop | Bobby 现状 | 工单 |
|---|---|---|---|---|
| 项目为中心 | ✅ | ✅ | ✅ 已做（main.ts showOpenDialog/projects.json） | — |
| 设置真实生效 | ✅ | ✅ | ⚠️ 代码在但 **2 测试失败** | E0 |
| **多任务/会话并行** | ✅ worktree 隔离 | ✅ 多会话 | ❌ chat-store 仍单 `busy`，无 per-task Map | E1 |
| 会话持久化 + Resume | ✅ | ✅ resume/continue | ⚠️ tasks:list/read IPC 有；**会话线程落盘无** | E2 |
| Diff 审查→Apply→Undo | ✅ Apply/PR | ✅ | ⚠️ 面板在、闭环未接（kernel snapshot 未连 UI） | E3 |
| **Checkpoint/Rewind 时间线** | — | ✅ 核心卖点 | ❌ kernel snapshot 只一次性，无时间线 UI | E3 |
| **富输入 Composer**（@文件/图片/slash 菜单） | ✅ | ✅ | ❌ 纯文本框 | E4 |
| 会话级权限/模式切换器 | ✅ 审批模式 | ✅ plan/accept-edits/bypass | ⚠️ 仅全局 Settings，会话级无 | E5 |
| **MCP 管理界面** | ✅ | ✅ 核心卖点 | ⚠️ kernel `mcp-client.ts` 有，GUI Plugins 是壳 | E6 |
| Subagents + 后台任务 | — | ✅ | ⚠️ kernel `subagent/dispatch` 有，GUI 未暴露 | E7 |
| **真实工具面板**（终端/文件/预览） | ✅ | ✅ | ⚠️ 壳在但是 prompt 转发 | E8 |
| Skills / 自定义命令 | ✅ | ✅ slash commands | ❌ | E9 |
| Automations | ✅ | — | ⚠️ 壳+测试 | E10 |
| 系统集成（菜单/托盘/通知） | ✅ | ✅ | ✅ 已做 | — |
| Hooks | — | ✅ | ❌ **后置不做**（v1 范围外，记录于此） | — |
| Best-of-N | ✅ | — | ❌ **后置不做**（贵，TTC 早前已裁） | — |
| 云端任务 | ✅ | — | **不对标**（Bobby 定位本地+自带 Key） | — |

## 2. 工单（E 系列）

### E0 基线锁定与防丢（最高优先，今天就做）🔴
1. **修 2 个失败测试**（`setup-ipc.test.ts`）：先读测试期望，修主进程接线（onboarding 状态读取 + settings/secret → `makeDeepSeekClient(baseUrl, …)` 重建 host），不许改测试凑绿。
2. 全绿后**立即提交全部工作区改动**（32 文件）并 **push 远程**。
3. **防丢纪律固化**：每个工单完成（=总工程师验收过）即 commit+push；每天收工打 `wip-YYYYMMDD` tag；`git push` 失败必须当场上报，不许攒。
- 验收：`vitest run` 525/525 全绿输出；`git status` 干净；远程可见最新 commit。

### E1 多任务并行工作台（Codex 核心）🔴
- `chat-store` 重构：全局 `busy/blocks/status` → `threads: Record<threadId, {taskId, blocks, status, costUsd, projectDir}>`；事件按 `taskId` 路由进所属线程。
- 侧栏 Sessions → 任务列表（⏵运行/✅done/❌failed/⚠️blocked + 项目名）；运行中可新开线程并行 `startTask`。
- 写文件类任务默认提示 worktree 隔离（接 kernel `subagent/dispatch`，产补丁提案）。
- 验收：并行 2 任务事件不串线（按 taskId 断言）；一败不影响另一；worktree 任务改动不落主目录。

### E2 会话持久化 + Resume（Claude Code 体验）🔴
- 线程 blocks 增量落 `userData/sessions/<id>.json`；启动恢复列表；点开即 resume（含 plan/verdict/evidence 完整回放）。
- History 屏与 `tasks:list/read` 已有基础上：点历史任务→"继续这个任务"（新线程带上下文）。
- 验收：跑任务→重启→列表在→点开回放完整→可继续追问。

### E3 Diff 闭环 + Checkpoint 时间线（Codex Apply + Claude Code Rewind 合体）🔴
- Apply（worktree 提案合并，**必须过完成闸门+人确认**）/ Discard / `git commit`（仅 git 项目）。
- kernel `snapshot` 升级为**多 checkpoint**：每步执行前自动快照，GUI 任务时间线列出各 checkpoint，"回到这一步"=restore 该快照（恢复前确认弹窗）。
- 验收：Apply 经过 gate 事件序列；rewind 到中间 checkpoint 后文件 hash 与该时点一致；时间线与 trace 步骤对应。

### E4 富输入 Composer 🟠
- `@` 触发项目文件 fuzzy 引用（注入相对路径+片段进 prompt）；`/` 触发命令菜单（先内置：/plan /undo /status /cost）；多行、↑历史。
- 图片粘贴：**先跑 probe 核实 DeepSeek 视觉支持** ⚠️；支持→走多模态消息；不支持→降级为"保存到工作区+路径引用"，UI 明示降级原因。
- 验收：@ 能搜到并注入真实文件；slash 菜单可键盘选择；图片路径降级路径可用。

### E5 会话级权限/模式切换器 🟠
- Composer 旁切换器：`观察(plan-only) / 标准 / 增强 / 完全`，映射 kernel L0–L3 + 计划模式（plan-only=只产计划不执行，对标 Claude Code plan mode）。
- 会话级覆盖全局默认；切到更高权限弹确认；当前模式常显。
- 验收：plan-only 下任务只出 plan_ready 不出 tool 执行；切档后 gate 行为变化（集成测试）。

### E6 MCP/插件管理真实化（Claude Code 核心卖点）🟠
- Plugins 屏接真实：添加 MCP server（stdio 命令 / URL）、启停、健康状态、工具清单（名称+权限档）、移除；配置落 `userData` 或 `~/.bobby`。
- 挂载的 MCP 工具自动套权限阶梯 + 证据契约（kernel `mcp-client.ts` 已有适配器）。
- 验收：接一个真实 MCP server（如 filesystem 示例）→工具出现在清单→任务中可被调用并产证据；停用后不可调用。

### E7 Subagents + Background Tasks 真实化 🟠
- `.bobby/agents/*.md` 的 GUI 编辑器（frontmatter 表单+正文）；Background Tasks 面板接真实 dispatch 状态（worktree 路径、diff 提案、merge 闸门状态）。
- 验收：GUI 建一个 agent→派发→面板显示进度→产提案→经 E3 流程 Apply。

### E8 真实工具面板（替换 prompt 转发壳）🟠
- **Terminal**：展示任务真实 `command_output` 流（按时间），并提供受权限闸门保护的手动命令输入（走 ExecTool，产证据）。
- **Files**：真实项目目录树（IPC 读目录，懒加载），点文件看内容/与 diff 关联。
- **Preview**：检测 web 项目→一键起 dev server（受闸门）→iframe 预览 + 端口管理。
- Browser/SideChat 保持轻实现。
- 验收：Terminal 显示真实退出码与输出；Files 树与磁盘一致；Preview 能打开本地 dev server 页面。

### E9 Skills/自定义命令 🟡
- `.bobby/commands/*.md`（name/description/prompt 模板）→ E4 的 `/` 菜单自动收录；GUI 管理列表（增删改）。
- 验收：建自定义命令→菜单出现→执行注入模板。

### E10 Automations 真实化（D8 收尾）🟡
- ScheduleTasks 接主进程 cron 持久化；到点对指定项目跑 headless 任务→结果进 History+通知；失败可见。
- 验收：1 分钟后触发的自动化执行+通知+History 落档；automations.test 与真实实现一致。

## 3. 铁律护栏（沿用 + 新增）
1. 完成闸门唯一权威；Apply/rewind/自动化都不得绕过；UI 不准有"跳过验证"。
2. 证据可见性不许倒退：每条完成可点开证据。
3. key 永不明文（safeStorage/keychain）；渲染层只见 `hasApiKey`。
4. UI 异常→错误卡；新 IPC 一律 Zod 校验；UI 零业务逻辑。
5. **每工单完成即 commit+push**（E0 固化的防丢纪律——这次事故的直接教训）。
6. DeepSeek 能力（视觉/流式）先 probe 再实现，严禁臆测。

## 4. 顺序
```
E0(今天) → E1 → (E2 ∥ E3) → (E4 ∥ E5) → (E6 ∥ E7) → E8 → (E9 ∥ E10)
```

## 5. 阶段完成定义（= 双桌面版对齐验收）
- `pnpm -r test` 全绿（每工单新测试 + 既有回归 + M2/M6 对抗集）。
- 真机手测脚本：开项目→并行 2 任务（1 个 worktree）→@引用文件→plan-only 模式跑一个→diff 提案审查→Apply→rewind 到中间 checkpoint→重启 resume→MCP 工具调用→自定义命令→自动化触发→通知跳转。全程通过。
- §1 差距表逐行复核：除标注"后置不做/不对标"外全部 ✅。
