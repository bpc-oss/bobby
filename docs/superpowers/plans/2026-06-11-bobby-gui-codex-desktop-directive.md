# Bobby GUI → Codex 桌面版级 改造指令（D 系列）

> **For chief (GPT-5.5):** 按 `2026-06-04-bobby-execution-protocol.md` 派单/验收/重做。本指令基于 2026-06-11 对 `packages/gui` 的实地代码审计（证据见 §1），非臆测。
> 对标物：**OpenAI Codex 桌面版**的交互形态——项目为中心、多任务并行、diff 审查闭环、系统级桌面集成。
> 配套：Codex 执行期的英文工作版（含后续会话新增的 Session-Level UI Requirements）见 `2026-06-11-bobby-gui-directive-codex-edition.md`，两份并读。

## 0. 现状结论（一句话）
GUI 的"皮"已经不错（流式 chat、plan/gate 审批、DiffView、主题、mock 模式、组件 20+），**但它还是一个"单线程聊天窗"，不是"桌面 agent 工作台"**。差距全在架构层：无项目概念、单任务串行、设置是死的、会话不持久、零系统集成。

## 1. 缺口清单（对照 Codex 桌面版，全部有代码证据）
| # | Codex 桌面版有 | Bobby 现状（证据） | 严重度 |
|---|---|---|---|
| G1 | **打开项目/仓库**，最近项目列表，每个会话绑定一个工作目录 | `electron/main.ts:47` `new KernelHost(…, process.cwd(), true)` **写死启动目录**；全 GUI 无 `dialog.showOpenDialog`。用户无法选择"在哪干活" | 🔴 致命 |
| G2 | **设置真实生效**（模型/key/权限/审批模式） | `Settings.tsx` 全部只写 **localStorage**；主进程 `createHost` 用 `makeDeepSeekClientFromBobbyConfig()` 读 `~/.bobby`——**渲染层设置与主进程完全没接通**，改了等于没改 | 🔴 致命 |
| G3 | **多任务并行**：每任务独立 agent + 状态，任务列表 | 单 KernelHost + chat-store 单 `busy` 标志，一次只能跑一个任务；kernel 已有 worktree/subagent 能力但 GUI 未用 | 🔴 |
| G4 | **会话/任务持久化**：重启后历史还在，可回看 | `sessions` 在 zustand **内存**，重启全丢；kernel 的 TaskStore（`.bobby/tasks/<id>/contract|plan|report`）已落盘但 GUI 不读 | 🔴 |
| G5 | **Diff 审查→应用→撤销闭环**（文件树、Apply/Discard、commit） | 有 DiffView/ReviewPanel/ChangeInspector 组件，但无 Apply/Discard/undo 接线（kernel snapshot.restore 已存在未接） | 🟠 |
| G6 | **系统集成**：原生菜单、托盘、任务完成通知、窗口记忆 | `electron/main.ts` 零 `Menu/Tray/Notification`（grep 仅命中自绘 CSS 标题栏类名）；窗口固定 960×640 | 🟠 |
| G7 | 首启 onboarding（登录→选项目→开干） | 有 `Wizard.tsx` 屏但主流程未挂（main.tsx 路由无 wizard） | 🟡 |
| G8 | Automations 定时任务 | 有 `ScheduleTasks.tsx` 屏（疑为壳） | 🟡 后置 |

**Bobby 的底子其实够**：kernel 已有 per-task orchestrator、worktree 隔离 dispatch（PORT-G）、snapshot/undo（PORT-H）、TaskStore、permission ladder、BudgetGuard。**这次改造主要是"接线 + 壳升级"，不是从零造。**

## 2. 工单（D 系列，按依赖序）

### D0 基线收尾（先做，否则后面全乱）
- 当前分支 `codex/bobby-cli-parity` 有 70+ 未提交文件——先验证（`pnpm -r test` + `tsc`）后提交收尾。
- `.gitignore` 加 **`.bobby/`**（运行产物 `.bobby/tasks/*` 不许入库；当前已有 10 个泄进工作区）。
- 验收：工作区干净；`pnpm -r test` 全绿记录基线数。

### D1 项目为中心（Project-first，对标 Codex 首屏）🔴
- 主进程：`ipcMain.handle('project:open')` → `dialog.showOpenDialog({properties:['openDirectory']})`；最近项目持久化到 `app.getPath('userData')/projects.json`（路径、名称、最后打开时间）。
- **KernelHost 按项目实例化**：`createHost(projectDir)` 替换 `process.cwd()`；切项目=换 host（或 host 池，见 D3）。
- 渲染层：新 `ProjectHome` 首屏（无项目时显示：打开文件夹 + 最近项目卡片）；标题栏显示当前项目名；`chat-store` 的会话绑定 `projectDir`。
- 验收（测试 + 手测）：选目录后任务在该目录执行（用 `file_exists` 证据断言路径前缀）；重启后最近项目仍在；未选项目时不允许发任务。

### D2 设置接通主进程（让 Settings 活过来）🔴
- 定义 IPC `settings:get/set`（Zod 校验），主进程落盘 `userData/settings.json`；**API key 走 kernel keychain（已有 `config/keychain.ts`），绝不明文**。
- `createHost` 改为读这份设置（model/baseUrl/permission 默认档/budget/sandbox 开关），渲染层 Settings.tsx 改为读写 IPC（删 localStorage 路径）。
- 改 key/模型后提示"对新任务生效"并重建 host。
- 验收：改权限档 → 下一个任务的 gate 行为变化（集成测试）；key 不出现在任何 json/localStorage（断言）。

### D3 多任务并行 + 任务列表（对标 Codex 多 agent）🔴
- KernelHost 已按 task 路由事件（事件都带 taskId）——渲染层把 `busy` 全局标志改为 **per-task 状态机**：`chat-store` 重构为 `tasks: Map<taskId, TaskThread>`（blocks/status/cost 各自独立），侧栏 Sessions 区升级为**任务列表**（运行中⏵/done✅/failed❌/blocked⚠️ + 项目名）。
- 并行执行：允许同时 `startTask` 多个（不同会话线程）；**写文件类任务默认提示启用 worktree 隔离**（接 kernel `subagent/dispatch` 的 worktree 路径，产出补丁提案）。
- 验收：同时跑 2 个任务事件不串线（按 taskId 断言）；一个失败不影响另一个；worktree 任务的改动不落主目录、以提案形式出现。

### D4 会话/任务持久化（重启不丢）🔴
- 主进程暴露 `tasks:list/read`（读 `.bobby/tasks/<id>/{task,contract,plan,report}.json`）；`History.tsx` 改读真实 TaskStore；点开可回放 trace（`getTrace`）。
- 会话线程（blocks）增量落 `userData/sessions/<id>.json`，启动恢复。
- 验收：跑完一个任务→重启 app→History 能看到它并回放；会话恢复后 plan/verdict/evidence 完整。

### D5 Diff 审查→应用→撤销闭环 🟠
- ReviewPanel/ChangeInspector 接真实 `file_diff` 证据：按文件分组的树 + 逐文件 diff（已有 DiffView）。
- 动作接线：**Apply（worktree 提案→合并，必须过完成闸门+人确认）/ Discard / Undo（kernel `snapshot.restore`）**；可选 `git commit` 按钮（仅当项目是 git 仓库）。
- 验收：worktree 提案 Apply 后落盘且经过闸门事件；Undo 后文件内容还原（hash 断言）；非 git 项目不显示 commit。

### D6 系统集成（桌面公民）🟠
- 原生应用菜单（File: Open Project/New Task；Edit 标准；View: theme/zoom；Help）；托盘（运行中任务数角标，点击唤起）；任务 `final_result` 时若窗口未聚焦发系统 `Notification`（点击跳对应任务）。
- 窗口：记忆尺寸/位置（userData），`minWidth 1080 / minHeight 700`；外链一律 `shell.openExternal`。
- 验收：通知点击聚焦到正确任务线程；重启窗口尺寸恢复。

### D7 首启 onboarding + 打磨 🟡
- 把 `Wizard.tsx` 挂进主流程：无 key → Wizard（填 key→probe 验证→选项目→示例任务）；完成前禁入 chat。
- 快捷键：`Ctrl/Cmd+N` 新任务、`Ctrl/Cmd+Enter` 发送、`Ctrl/Cmd+K` 切项目、Esc 中断当前任务。
- 空状态/加载态/错误卡统一；i18n 补全（中英）。
- 验收：删配置冷启动→Wizard 全程可走通→落到 ProjectHome。

### D8 Automations（后置，最后做）🟡
- `ScheduleTasks.tsx` 接真实调度：主进程 cron（持久化 userData），到点对指定项目跑 headless 任务，结果进 History + 通知。
- 验收：建一个 1 分钟后触发的任务，验证执行+通知+History 落档。

## 3. 铁律护栏（GUI 也要守，违者打回）
1. **完成闸门仍是唯一权威**：GUI 不得把未过闸门的任务渲染成"完成"；worktree 提案 Apply 必须经闸门+人确认，**UI 上不准有"跳过验证"按钮**。
2. **证据可见性不许倒退**：多任务/新首屏改版后，每条完成仍可点开看证据（这是产品命根）。
3. **key 永不明文**（keychain only）；渲染进程拿不到 key 本体。
4. **所有 UI 异常→错误卡**，绝不白屏/裸崩；mock 模式只在无 backend 时兜底，不得污染真实路径。
5. **UI 零业务逻辑**：仍只消费 KernelHost 事件 + 发命令；新增 IPC 一律 Zod 校验。

## 4. 顺序与并行
```
D0 → D1 → D2 → (D3 ∥ D4) → D5 → D6 → D7 → D8
```
D3 与 D4 互不依赖可并行；D5 依赖 D3 的 worktree 提案；D6/D7 独立可穿插。

## 5. 阶段完成定义
- `pnpm -r test` 全绿（含每个 D 项新测试；GUI 用 @testing-library/react + 主进程逻辑抽纯函数测）。
- 真机手测脚本全过：开项目→并行跑 2 任务→一个出 diff 提案→审查→Apply→Undo→重启→History 回放→通知点击跳转。
- 对照 §1 表格逐条复查：G1–G7 全闭环（G8 可后置但要有壳→真实现）。
