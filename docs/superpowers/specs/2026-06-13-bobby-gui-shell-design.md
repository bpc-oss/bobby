# Bobby GUI 外壳（Shell）设计方案 — UI-First 路线

> 日期：2026-06-13
> 状态：待用户评审
> 配套草图：[2026-06-13-bobby-gui-shell-mockup.html](./2026-06-13-bobby-gui-shell-mockup.html)（浏览器打开，可点击切换）

## 0. 设计哲学

**UI-First，Mock 驱动。** 先把整个 GUI 框架（导航、布局、所有模块入口）搭出来，大量模块只有图标和占位页，背后没有后端。用假数据完整模拟用户的真实使用场景，验证信息架构是否顺手，再逐个模块接通真实功能。

这条路线能成立的**唯一技术前提**：UI 永远面向 `KernelClient` 接口编程，而不是面向 kernel 实现。当前 [contract.ts](../../../packages/gui/src/ipc/contract.ts) 只有 `startTask / approveGate / onEvent` 三个方法 —— 我们把它扩展成完整接口，然后提供两个实现：

- `IpcKernelClient` —— 真实走 Electron IPC（现状）
- `MockKernelClient` —— 返回固定剧本数据（fixtures），驱动整个 UI 演练

启动参数 / 环境变量切换（如 `BOBBY_MOCK=1` 或 `?mock=1`），任何模块从 mock 切到真实实现时 UI 代码**零改动**。

参考来源约定（下文用缩写）：

| 缩写 | 来源 | 借鉴点 |
|---|---|---|
| CC | Claude Code desktop | 左侧双入口、Projects、权限模式 |
| CX | Codex | 会话列表、摘要栏、右侧面板（审查/终端/网页/SideChat）、composer |
| DS | DeepSeek GUI | Write 模式、cache 命中率、token/人民币计费显示 |

---

## 1. 整体布局（设计草图）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Bobby            [项目: bobby ▾]   [🔍 Ctrl+K]              ⏻ ─ □ ✕        │ ① 标题栏
├────┬───────────────────┬─────────────────────────────────┬──────────────────┤
│ ②  │ ③ SIDEBAR         │ ④ WORKSPACE                     │ ⑤ 右侧面板        │
│    │                   │ ┌─────────────────────────────┐ │ ┌──┬──┬──┬──┐    │
│ 💬 │  ＋ New Chat      │ │ 会话标题 · ⎇main   [摘要栏▾]│ │ │审│终│网│SC│    │
│Chat│  🔍 搜索          │ ├─────────────────────────────┤ │ ├──┴──┴──┴──┤    │
│    │  ✍  Write        │ │                             │ │ │            │    │
│ ⌨  │  📁 Projects      │ │  对话流                     │ │ │ 文件变更    │    │
│Code│ ───────────────── │ │  · 用户消息                 │ │ │ diff 视图   │    │
│    │  📌 置顶          │ │  · 助手消息                 │ │ │ 证据链      │    │
│    │   · 条目…         │ │  · 工具调用卡片             │ │ │            │    │
│    │  📂 项目          │ │  · 闸口审批卡片 [允许][拒绝] │ │ │            │    │
│    │   · 条目…         │ │  · 证据卡片 ✓               │ │ │            │    │
│    │  🕘 对话记录      │ ├─────────────────────────────┤ │ │            │    │
│    │   · 条目…(状态点) │ │ ┌─────────────────────────┐ │ │ │            │    │
│    │                   │ │ │ composer  @文件 /命令    │ │ │ │            │    │
│ ⚙  │                   │ │ │ [模型▾][权限▾][思考] ⏎  │ │ │ │            │    │
│Set │                   │ │ └─────────────────────────┘ │ │ └────────────┘    │
│ 👤 │                   │ │ cache 92%·12.3k tok·¥0.18  │ │                  │
├────┴───────────────────┴─┴─────────────────────────────┴─┴──────────────────┤
│ ⑥ 状态栏  kernel ● 已连接 · DeepSeek ● Flash · 上下文 34% · v0.1.0 · ⬆更新   │
└─────────────────────────────────────────────────────────────────────────────┘
```

六个区域，每个都是独立组件，互相只通过全局 store 通信：

| # | 区域 | 职责 |
|---|---|---|
| ① | 标题栏 | 项目切换器、全局搜索入口（Ctrl+K 命令面板）、窗口控制 |
| ② | 活动栏 ActivityBar | 两个入口：Chat / Code（CC）；底部：Settings、账号 |
| ③ | 侧边栏 Sidebar | 随入口切换内容；上半固定功能项，下半列表（置顶/项目/记录，CX） |
| ④ | 工作区 Workspace | 顶部会话标题+摘要栏（CX）、中部对话流、底部 composer + 计费条（DS） |
| ⑤ | 右侧面板 | 可折叠 tabs：审查 / 终端 / 网页 / SideChat（CX） |
| ⑥ | 状态栏 | kernel 连接、模型、上下文占用、版本、更新提示 |

---

## 2. 信息架构（完整导航树）

```
Bobby
├─ 💬 Chat 模式
│   ├─ ＋ New Chat
│   ├─ 🔍 搜索（历史全文检索，亦可 Ctrl+K 唤起）
│   ├─ ✍  Write          （DS：写作模式，文档型输出，左编辑右预览）
│   ├─ 📁 Projects        （CC：项目=共享上下文+自定义指令+知识文件）
│   └─ 列表区
│       ├─ 📌 置顶条目
│       ├─ 📂 项目分组（归属某 Project 的对话）
│       └─ 🕘 对话记录（按时间分组：今天/昨天/本周/更早）
│
├─ ⌨ Code 模式
│   ├─ ＋ New Session     （选仓库/目录 → 开会话；支持 worktree 隔离）
│   ├─ ⏰ Routines        （定时任务/自动化：cron + 自然语言排程）
│   ├─ 🔁 Loop Engineering（循环工程：目标+验收器+预算 的迭代收敛任务）★
│   ├─ 👥 Team            （多智能体团队流水线：角色编排 DAG）★
│   └─ 列表区
│       ├─ 📌 置顶条目
│       ├─ 📂 项目分组（按仓库分组）
│       └─ 🕘 会话记录（每条带状态点：●运行中 ◐待审批 ✓完成 ✗失败）
│
├─ ⚙ Settings（活动栏底部，CC+CX）
│   ├─ 通用（语言/主题/快捷键/通知）
│   ├─ 模型与密钥（DeepSeek key、Flash/Pro 默认分工、probe 能力报告）
│   ├─ 权限与闸口（默认权限模式、白名单命令、闸口策略）
│   ├─ MCP / 插件（迁移现有 Plugins 页）
│   ├─ 用量统计（日/月 token、缓存命中率、人民币累计，DS）
│   ├─ 数据与隐私（会话存储位置、零遥测声明、导出/清除）
│   └─ 关于与更新（版本、electron-updater）
│
└─ 右侧面板（Code 模式全部可用；Chat 模式仅 SideChat/网页）
    ├─ 🔍 审查 Review（文件变更列表 + diff + 证据链 EvidencePanel）
    ├─ ＞ 终端 Terminal（会话执行的真实命令流，只读→可交互分阶段）
    ├─ 🌐 网页 Browser（内嵌预览，开发服务器/文档）
    └─ 💭 SideChat（旁路提问，不污染主会话上下文，CX）
```

### 2.1 你遗漏的重要部分（本方案补上）

按重要性排序，前 5 个直接关系到 Bobby 的产品立身之本：

1. **闸口审批 UI（GateDialog 升级）** —— Bobby 的核心是"不撒谎+闸口"。审批不能只是弹窗：
   - 对话流内联审批卡片（显示命令/diff 预览 + 允许/拒绝/总是允许）；
   - 全局"待审批"徽标：其他会话有 pending gate 时，活动栏和会话列表条目上显示 ◐ 角标，点击直达。
2. **证据链视图** —— "任务完成必须有证据"是 README 的第一承诺。右侧"审查"tab 里除了 diff，还要有证据时间线（`command_output` / `file_exists` / `file_diff`），每条可展开原始输出。这是 Bobby 区别于所有竞品的界面级卖点，应该做成视觉上最讲究的部分。
3. **模型/权限/思考选择器（composer 内）** —— Flash/Pro 切换（执行/复核分离的用户感知层）、权限模式（只读 plan / 询问 / 自动接受编辑，CC）、思考深度开关。
4. **上下文占用指示** —— 状态栏显示 context window 百分比，接近阈值提示 compact；这直接影响计费（与 DS 计费条联动）。
5. **首启向导（已有 Wizard 迁移）** —— 改为首次启动的全屏引导：欢迎 → 填 key → `bobby probe` 能力检测 → 选默认模型 → 进入主界面。之后从 Settings 可重跑 probe。
6. **命令面板（Ctrl+K）** —— 全局搜索 + 动作执行（新建会话/切项目/跳设置），CC/CX 都有，桌面端刚需。
7. **状态栏** —— kernel 进程健康、API 连通、当前模型、版本、更新提示（electron-updater 已接，差 UI）。
8. **Git 感知** —— 会话标题旁显示分支 `⎇main`；New Session 时可选"在 worktree 中隔离运行"（CX 风格）。
9. **通知系统** —— 长任务完成/需要审批时发系统通知（Electron Notification）；应用内通知中心（铃铛 inbox）放标题栏。
10. **会话恢复** —— 应用重启后恢复运行中会话的状态（resume）；崩溃恢复提示。
11. **用量统计页** —— 每条会话的计费条是即时数据，Settings 里要有累计 dashboard：按日/模型分组的 token、缓存命中率趋势、人民币合计（DS 的计费心智做全套）。
12. **composer 富输入** —— `@` 文件引用（带补全）、`/` 命令、拖拽/粘贴图片、多行编辑、历史输入上翻。
13. **空状态设计** —— 每个占位模块（icons-only 阶段）要有像样的空状态页：图标 + 一句话定位 + "即将推出"，而不是白屏。这是 UI-first 路线的脸面。
14. **键盘快捷键体系** —— Ctrl+K 面板、Ctrl+N 新会话、Ctrl+` 终端、Esc 中断任务；Settings 里可查改。
15. **离线/错误降级** —— API 不可达时的全局横幅与重试；kernel 崩溃时的状态栏红点 + 一键重启。

---

## 3. 各区域详细设计

### 3.1 活动栏（ActivityBar）

竖条 48px。上：Chat、Code 两个图标（当前高亮）。下：Settings 齿轮、账号头像。徽标规则：任何后台会话出现 pending gate / 失败，对应入口图标右上角显示数字角标。

### 3.2 侧边栏（Sidebar）

宽 260px，可拖拽调宽、可折叠（折叠后只剩活动栏）。结构两段式：

- **功能项区**（固定，随模式切换）：见 §2 导航树。每项 = 图标 + 文案；未实现的模块照常可点，进入占位页。
- **列表区**（滚动）：置顶 → 项目分组 → 时间分组的记录。每条目：标题、相对时间、状态点（Code 模式）、hover 出现 📌/⋯ 操作（置顶、重命名、删除、在新窗口打开）。右键菜单同款。

搜索：列表顶部常驻过滤框（输入即过滤当前列表），全文检索走 🔍 功能项/Ctrl+K。

### 3.3 工作区（Workspace）

- **顶栏**：会话标题（可改名）· 分支徽标 · 右侧摘要栏开关。
- **摘要栏（CX）**：从右上角展开的抽屉，内容：当前计划步骤（PlanView 迁移）、TODO 进度、已产生的文件变更数、累计费用。任务运行时自动显示当前步骤的一行摘要在顶栏。
- **对话流**：消息气泡 + 结构化卡片（工具调用可折叠、闸口审批、证据卡片、错误卡片）。支持代码块复制、按消息重试。
- **composer**：多行输入框；底部工具行：`@` `/` 图片、模型选择器（Flash/Pro/自动）、权限模式、思考开关、发送/中断按钮。
- **计费条（DS）**：composer 下方一行小字：`缓存命中 92% · 输入 8.1k / 输出 4.2k tok · ≈¥0.18`。点击展开本会话明细。

### 3.4 右侧面板

宽 380px，可折叠/拖宽。tabs：审查 / 终端 / 网页 / SideChat。

- **审查**：上半文件变更列表（A/M/D 标记），点击看 diff；下半证据时间线。一键"用 Pro 复核"按钮（执行/复核分离的入口）。
- **终端**：只读命令流先行（kernel 执行的每条命令+输出），后续再考虑可交互 shell。
- **网页**：内嵌 webview，地址栏 + 刷新；预设"打开 dev server"。
- **SideChat**：独立小对话，自带极小上下文（当前文件/选中内容），用 Flash，费用独立显示。

### 3.5 三个自动化模块（Code 模式的差异化版块）

这三个模块共享一个心智模型，建议在 UI 上做成同构的「列表页 → 详情页」：

**Routines（定时任务）**
- 列表：名称、cron 人话化（"每天 09:00"）、下次运行、上次结果（✓/✗）、开关。
- 新建：自然语言描述 → 解析出 cron + 任务 prompt → 确认。
- 每次运行落成一条 Code 会话记录，可点进去看完整过程（复用会话视图，零新 UI）。

**Loop Engineering ★（你要重点设计的版块）**
建议把 Loop 定义为一个四元组，这样 UI 自然成型：
- **目标**（prompt）+ **验收器**（怎样算过：测试命令通过 / Pro 复核打分 ≥ N / 自定义脚本）+ **迭代策略**（每轮把上轮失败证据喂回去）+ **预算**（最多 N 轮 / M token / ¥X）。
- 列表页：每条 loop 显示状态（迭代中 ●/ 已收敛 ✓ / 预算耗尽 ⚠ / 人工介入 ◐）、当前轮次、累计费用。
- 详情页：左侧迭代时间线（第 1…n 轮，每轮展开 = 一次会话视图 + 验收结果 + 分数），右上收敛曲线（分数随轮次变化的迷你图），右下控制（暂停/继续/介入指导/调预算）。
- 与 Bobby 理念严丝合缝：验收器默认用 Pro 复核 —— "自己不能给自己打分"在 UI 上可见。

**Team（多智能体流水线）**
- 模板库先行：内置 2~3 个模板（执行者→复核者；规划→编码→测试→复核），降低空白画布的门槛。
- 编排视图：横向流水线/DAG，节点 = 角色（名称、模型、系统提示、工具权限、交接物定义），连线 = 交接。MVP 用"线性流水线 + 分支审批"就够，别一上来做自由画布。
- 运行视图：泳道时间线，每个 agent 一条泳道，交接物（文件/报告）显示在泳道之间，可点开任意 agent 的完整消息流。
- 每次运行同样落成会话记录。

> 三个模块的共同落点：**一切自动化的产物都是一条 Code 会话**。这条设计原则让 Routines/Loop/Team 的详情页 80% 复用主会话视图，UI-first 阶段只需要做它们各自的列表页 + 编排表单。

### 3.6 Chat 模式特有

- **Write（DS）**：进入后工作区变为左右分栏：左 markdown 编辑器（AI 续写/改写/润色按钮），右预览。导出 md/docx。
- **Projects（CC）**：项目 = 名称 + 自定义指令 + 知识文件列表 + 归属对话。项目页：顶部项目信息卡，下方该项目的对话列表 + 新建按钮。

---

## 4. 技术方案

### 4.1 目录结构（packages/gui/src 重组）

```
src/
├─ shell/                 # 外壳六区域
│  ├─ AppShell.tsx        # 布局网格 + 区域装配
│  ├─ TitleBar.tsx  ActivityBar.tsx  Sidebar.tsx
│  ├─ RightPanel.tsx  StatusBar.tsx  CommandPalette.tsx
├─ modes/
│  ├─ chat/               # ChatHome, WritePage, ProjectsPage
│  └─ code/               # RoutinesPage, LoopPage, TeamPage（先占位）
├─ workspace/             # SessionView, ChatStream*, Composer, SummaryBar, CostBar*
├─ panels/                # ReviewPanel(=EvidencePanel*+diff), TerminalPanel, BrowserPanel, SideChatPanel
├─ onboarding/            # Wizard* 迁移
├─ settings/              # Settings* 拆分为子页
├─ kernel/
│  ├─ client.ts           # KernelClient 接口（contract.ts 扩展）
│  ├─ ipc-client.ts       # 真实现
│  └─ mock/               # MockKernelClient + fixtures/（剧本 JSON）
├─ store/                 # zustand：ui-store(导航/面板) + session-store(会话) 
└─ lib/                   # i18n*, theme tokens
```
（* = 现有代码迁移：ChatStream、CostBar、EvidencePanel、GateDialog、PlanView、Wizard、Settings、History→侧边栏列表、Plugins→设置子页）

### 4.2 关键决策

- **状态管理**：现有 `useReducer` 太小。引入 **zustand**（约 1KB，无 Provider 样板），分 `ui-store`（导航、面板开合、主题）和 `session-store`（会话列表、消息、费用）。
- **KernelClient 接口扩展**（UI-first 的契约，先定义、mock 先实现，kernel 后补）：
  `listSessions / createSession / startTask / interrupt / approveGate / onEvent / getUsage / listRoutines / listLoops / listTeams …`
  —— 未实现的方法 mock 返回剧本数据，真实现抛 `NotImplemented`，UI 据此显示"即将推出"。
- **路由**：不引入 react-router，保持现有"状态即路由"模式，但收敛为 `ui-store` 里的一棵导航树 `{ mode, page, sessionId }`。
- **样式**：继续纯 CSS + CSS variables 设计 tokens（暗色优先，跟随系统）。不引组件库，保持 Bobby 自己的脸。
- **i18n**：沿用现有 `lib/i18n.ts`，新增文案双语成对提交。

### 4.3 Mock 剧本（fixtures）

UI-first 的灵魂。准备 4 套剧本 JSON，覆盖核心用户场景：

1. `chat-basic`：一次普通问答（流式输出、费用累计）。
2. `code-gate-evidence`：代码任务全流程 —— 计划 → 工具调用 → **闸口审批** → diff → **证据产出** → Pro 复核 → 完成。（演示 Bobby 全部核心心智）
3. `loop-converge`：一个 loop 跑 4 轮收敛的剧本。
4. `multi-session`：3 个并行会话，1 个待审批，演示徽标/通知。

---

## 5. 分阶段实施计划（每阶段都可演示）

| 阶段 | 内容 | 验收（用户场景演练） |
|---|---|---|
| **P0 外壳** | AppShell 六区域 + 双入口切换 + 全部 sidebar 项 + 占位页/空状态 + 主题 tokens | 能点遍所有入口，布局/导航手感成立 |
| **P1 Mock 数据流** | KernelClient 接口扩展 + MockKernelClient + 4 套剧本；会话列表、对话流、composer、计费条、摘要栏全部吃 mock | 不连后端，完整走完 `code-gate-evidence` 剧本 |
| **P2 Chat 接通** | IpcKernelClient 实现 chat 路径；首启向导迁移 | 真 key 真对话，费用真实 |
| **P3 Code 核心** | code 会话接通：闸口、审查面板（diff+证据）、摘要栏吃真数据 | 真任务全流程 + 证据可查 |
| **P4 右侧面板补全** | 终端（只读流）、网页、SideChat | — |
| **P5 自动化三件套** | Routines → Loop → Team，依次从 mock 转真 | 各自列表+详情可用 |
| **P6 打磨** | 命令面板、通知、用量 dashboard、快捷键、会话恢复 | — |

P0+P1 合起来就是你说的"先把 GUI 框架搭好、模拟真实使用场景"；P2 起每次只接通一个模块，mock 与真实现并存随时可切。

## 6. 风险与边界

- **范围控制**：Team 的自由 DAG 画布、可交互终端、多窗口 —— 全部明确推迟，先线性流水线/只读终端/单窗口。
- **现有测试**：迁移现有组件时保留其 vitest 用例，外壳新增组件按"渲染 + 交互"补测。
- **Electron 安全**：webview（网页面板）需关 nodeIntegration、开 contextIsolation，allowlist 导航。
- **性能**：会话列表虚拟化推迟到条目 >200 时再做；先用分页"加载更多"。
