# Bobby Codex Desktop UI Parity Plan

> 状态：执行中  
> 日期：2026-06-12  
> 分支：`codex/bobby-cli-parity`  
> 目标：把 Bobby GUI 从“功能接近”推进到“桌面工作台形态和交互模型接近 Codex Desktop”。

## 1. 本计划的输入依据

本计划只以以下两类依据为准：

1. 仓库内已有指令与约束  
   - `docs/superpowers/plans/2026-06-11-bobby-desktop-parity-directive.md`
   - `docs/superpowers/plans/2026-06-04-bobby-execution-protocol.md`
2. 2026-06-12 提供的 Codex Desktop 截图

本文件不再讨论“是否要做”，只定义“还差什么、按什么顺序做、做到什么算过”。

## 2. 目标定义

不是把 Bobby 改成“长得像聊天页”，而是改成一个完整的桌面编码工作台：

- 左侧是稳定的全局导航和项目/任务树
- 中间是当前任务的主工作区
- 底部是控制台式 composer
- 右侧是固定工具入口和按需展开的 dock
- 右上是环境信息卡，承载 git、分支、进度、浏览器、来源
- 空状态和活跃任务状态共享同一套 shell，而不是两套页面

## 3. 从截图抽出的目标界面模型

### 3.1 顶层窗口层

- 原生菜单栏保留
- 主体是三栏工作台，而不是单页 dashboard
- 中央工作区有明显的“画布感”，左右两侧是稳定辅助区

### 3.2 左侧一级导航

截图表现出的一级导航模型：

- `新对话/快速对话`
- `搜索`
- `插件`
- `自动化`
- `设置`

要求：

- 一级导航是“应用区切换”，不是“功能卡片列表”
- 图标、文字、激活态、间距统一
- 切换页面时右侧 dock 和整体 shell 不闪断

### 3.3 左侧二级导航：项目与任务

截图表现出的二级导航模型：

- 有“项目”分组
- 项目下能直接看到任务条目
- 任务条目可显示当前活动状态
- 项目列表可滚动，任务密度高

要求：

- 项目是一级实体，任务是项目下属实体
- 每个任务的状态必须来自该任务自己的线程/运行态
- 不能再使用会串线的全局 busy 标记替代 per-task 状态

### 3.4 中央工作区

截图表现出的中央区模型：

- 空状态时，大标题和 composer 居中，但 shell 不消失
- 有任务时，中间是 transcript，不是普通聊天卡片堆叠
- 顶部标题显示当前任务名
- 工具输出、推理状态、结果、错误都在同一条任务流中

要求：

- transcript 层级明确：用户消息、assistant 消息、reasoning、工具、状态卡、错误卡
- 消息区宽度、留白、行宽接近工作台阅读模式
- “正在思考/已运行 N 条命令/审查”等状态要自然挂在任务流上

### 3.5 底部 composer

截图表现出的 composer 模型：

- 不是单纯输入框，而是“控制台”
- 左侧 `+` 菜单里有：
  - 添加照片和文件
  - 创建
  - 计划模式
  - 追求目标
  - 插件
- 主输入区上方/下方存在上下文控制行
- 可见权限级别、目标开关、模型档位、语音/发送按钮
- 项目、执行目标、分支上下文集成在 composer 附近

要求：

- composer 必须形成三层结构：
  - 输入层
  - 控制层
  - 上下文层
- 空状态和任务状态使用同一组件合同
- 插件入口不能只是跳页，还要保留“已安装插件/可调用插件”的上下文感觉

### 3.6 右上环境信息卡

截图表现出的环境卡模型：

- 标题：环境信息
- git 变更统计：新增/删除
- 运行环境：本地
- 分支选择器，当前分支可切换
- `提交或推送`
- `创建拉取请求`
- 进度 checklist
- 浏览器目标
- 来源

要求：

- 这是当前任务的总上下文卡，不是纯 git 卡
- 分支切换器需要可展开搜索/选择
- `提交或推送`、`创建拉取请求` 要么真能工作，要么明确禁用且说明原因
- checklist 必须和当前任务/计划状态联动

### 3.7 右侧工具入口与 dock

截图表现出的右侧工具模型：

- 固定快捷入口：
  - 审查
  - 终端
  - 浏览器
  - 文件
- 有快捷键标签
- 点击后出现真正可用的面板，不是占位

要求：

- 右侧入口是“稳定存在的工作台部件”
- dock 开闭、当前 tab、内容状态要可持续
- 不同页面下仍然能作为全局工具存在

### 3.8 文件面板

截图表现出的文件面板模型：

- 左侧文件树
- 右侧预览区
- 初始为空预览，不自动打开第一个文件
- 顶部有文件过滤输入框
- 目录可展开折叠
- 选中文件后再预览

要求：

- 默认空预览
- 文件树和预览区视觉分栏明确
- 选中文件后可插入引用回 composer
- 读取失败要显示错误卡，不能静默失败

### 3.9 视觉系统

截图表现出的视觉方向：

- 近黑背景
- 面板是轻微抬起的深灰层
- 圆角偏大
- 边框很细
- 文本层级鲜明
- 列表密度高，但不拥挤

要求：

- 统一 tokens，不允许继续一处一处临时补色值
- 全局 spacing、radius、border、hover、focus、active 态统一

## 4. 当前 Bobby 已有基础

以下能力不是本轮从零开始：

- 左侧导航与项目列表已有雏形
- 中央 transcript 已能展示任务过程
- 右侧 dock 已有 `review / terminal / browser / files`
- 搜索页、插件页、自动化页已存在
- 环境卡已有部分信息
- 文件面板已能列树、预览、插入引用

当前问题不是“有没有功能”，而是：

- 壳层结构还不像 Codex Desktop
- 组件之间仍像拼接物，而不是统一工作台
- 交互密度、空状态、状态归属和视觉一致性仍有明显差距

## 5. 后续开发总原则

1. 先壳层，后局部面板。  
   不先做结构，局部 polish 会反复返工。
2. 先行为正确，再做视觉对齐。  
   占位按钮和假控件会制造错误预期。
3. 每个 slice 都要带测试和验收。  
   不接受“UI 看起来差不多”。
4. 只在 renderer 放视图编排，不把业务规则塞进 UI。  
   线程、任务、计划、git、工具能力仍以 store/IP C/kernel 为准。
5. 每个验收通过的 slice 立即 `commit + push`。  
   不再积压大批未推送改动。

## 6. 模块化工单拆解

### W1. Shell 骨架重构

目标：让 Bobby 第一眼就是三栏工作台。

范围文件：

- `packages/gui/src/main.tsx`
- `packages/gui/src/components/Sidebar.tsx`
- `packages/gui/src/screens/Workspace.tsx`
- `packages/gui/src/components/SessionToolDock.tsx`
- `packages/gui/src/app.css`
- `packages/gui/src/styles/tokens.css`

实施项：

- 固定 shell 四区：
  - 左一级导航
  - 左项目/任务区
  - 中央工作区
  - 右工具区
- 清除仍然像 dashboard 的包裹容器和多余标题块
- 空状态和任务状态共用同一 shell
- 右侧工具入口在空状态和任务状态都保留

自动化验收：

- `workspace-screen.test.tsx`
- `session-tool-dock.test.tsx`

人工验收：

- 打开 GUI，未选任务时仍能看到左右两侧稳定框架
- 进入任务后壳层不重排成另一套页面

### W2. 左侧一级导航与项目树对齐

目标：把左侧从“页面目录”变成“应用区 + 项目树”。

范围文件：

- `packages/gui/src/components/Sidebar.tsx`
- `packages/gui/src/store/chat-store.ts`
- `packages/gui/src/store/app-store.ts`
- `packages/gui/tests/chat-store.test.ts`
- `packages/gui/tests/workspace-screen.test.tsx`

实施项：

- 一级导航按截图收敛为：
  - 新对话
  - 搜索
  - 插件
  - 自动化
  - 设置
- 项目列表下沉为独立区域
- 项目条目支持折叠/展开
- 项目下任务条目高密度展示
- 任务状态改为严格 per-task 派生
- 长项目名和长任务名支持截断与 hover 完整展示

自动化验收：

- `loadSessions` 后项目分组正确
- 同项目两个任务并行时状态不串线
- 选中任务切换不污染其他任务状态

人工验收：

- 左侧列表能直观看到 `Bobby` 项目和其下任务
- 滚动时项目区和一级导航层次仍清晰

### W3. 中央 transcript 重构

目标：让中央区读起来像任务流，而不是聊天页。

范围文件：

- `packages/gui/src/screens/Workspace.tsx`
- `packages/gui/src/components/MarkdownRenderer.tsx`
- `packages/gui/src/app.css`
- `packages/gui/tests/workspace-screen.test.tsx`

实施项：

- 当前任务标题固定在主工作区顶部
- transcript 的层级和间距重新整理：
  - 用户请求
  - 助手回复
  - reasoning
  - 工具结果
  - 状态卡
  - 错误卡
- “已运行 N 条命令”“正在思考”“审查”等状态保留在任务流上下文
- 限制最大阅读宽度，避免全文铺满

自动化验收：

- 空状态标题和 composer 居中但壳层不消失
- 任务执行中 transcript 可持续显示
- streaming、reasoning、final result 只更新当前线程

人工验收：

- 当前任务名、执行过程、结果能一眼串起来

### W4. Composer 控制台化

目标：把底部输入区做成真正的任务控制台。

范围文件：

- `packages/gui/src/screens/Workspace.tsx`
- `packages/gui/src/store/chat-store.ts`
- `packages/gui/src/ipc/contract.ts`
- `packages/gui/tests/workspace-screen.test.tsx`
- `packages/gui/tests/plugins.test.tsx`

实施项：

- 重构 composer 为三层：
  - 主输入框
  - 操作控制行
  - 项目/目标/执行上下文行
- `+` 菜单按截图顺序组织
- 保留并统一：
  - 添加照片和文件
  - 创建
  - 计划模式
  - 追求目标
  - 插件
- 明确展示：
  - 权限级别
  - 目标开关
  - 模型档位
  - 语音/发送
- 项目选择器、执行目标、本地模式、分支上下文统一排布

自动化验收：

- plus 菜单顺序稳定
- 项目 picker 支持搜索
- 插件菜单仍能进入插件页
- 计划模式/目标控制在空状态和任务状态都可见

人工验收：

- composer 不再像独立组件，而像工作台底部控制台

### W5. 环境信息卡完成度

目标：把环境卡变成统一上下文卡。

范围文件：

- `packages/gui/src/screens/Workspace.tsx`
- `packages/gui/src/ipc/contract.ts`
- `packages/gui/tests/workspace-screen.test.tsx`

实施项：

- 稳定显示：
  - 新增/删除统计
  - 本地环境标签
  - 当前分支
  - 分支切换器
  - 提交或推送
  - 创建拉取请求
  - 进度 checklist
  - 浏览器目标
  - 来源
- 分支切换器支持搜索和当前分支高亮
- `提交或推送` 直接联动 review/diff 工作流
- `创建拉取请求` 在未接线前保持显式禁用，不伪装可用
- checklist 来自真实计划状态

自动化验收：

- git 统计来自真实 summary
- 当前分支高亮正确
- 点击 `提交或推送` 有明确行为
- `创建拉取请求` 的禁用态和原因可见

人工验收：

- 右上卡片能独立回答“我现在在哪个分支、改了多少、下一步是什么”

### W6. 右侧工具入口与 dock 一体化

目标：让右侧不是工具抽屉，而是长期驻留的工作区。

范围文件：

- `packages/gui/src/components/SessionToolDock.tsx`
- `packages/gui/src/store/app-store.ts`
- `packages/gui/src/screens/Workspace.tsx`
- `packages/gui/tests/session-tool-dock.test.tsx`
- `packages/gui/tests/workspace-screen.test.tsx`

实施项：

- 固定入口：
  - 审查
  - 终端
  - 浏览器
  - 文件
- 入口文案、快捷键、选中态统一
- dock 当前 tab 保持
- 页面切换后 dock 状态可恢复
- review、terminal、browser、files 各自空状态和错误状态统一

自动化验收：

- 切换 tab 不丢当前状态
- 页面跳转不异常关闭 dock
- 空状态下也能打开各工具

人工验收：

- 右侧入口在任何时刻都像“系统工具栏”

### W7. 文件面板精修

目标：文件面板按截图行为收口。

范围文件：

- `packages/gui/src/components/SessionToolDock.tsx`
- `packages/gui/src/ipc/contract.ts`
- `packages/gui/tests/session-tool-dock.test.tsx`

实施项：

- 默认空预览
- 左树右预览固定布局
- 文件筛选输入稳定可用
- 目录展开/折叠视觉清晰
- 选中高亮统一
- 读取失败展示错误卡
- 插入引用继续回写 composer

自动化验收：

- 初始显示 `Open file` 空状态
- 选择文件后才出现预览
- 筛选结果能缩小树内容
- 读取失败走错误卡
- 插入引用成功写回共享 composer 状态

人工验收：

- 文件树浏览体验接近截图，不再自动打开第一个文件

### W8. 搜索、插件、自动化纳入统一 shell

目标：其他页面不再像“跳出工作台”的独立页面。

范围文件：

- `packages/gui/src/screens/Search.tsx`
- `packages/gui/src/screens/PluginMarketplace.tsx`
- `packages/gui/src/screens/ScheduleTasks.tsx`
- `packages/gui/src/screens/History.tsx`
- `packages/gui/src/main.tsx`
- `packages/gui/tests/plugins.test.tsx`
- `packages/gui/tests/automations.test.tsx`
- `packages/gui/tests/history.test.tsx`

实施项：

- 搜索页保留同一 shell
- 插件页和 composer 中的插件入口语义一致
- 自动化页增强“结果可见性”
- 自动化到历史/任务结果页有明确跳转路径
- 历史记录返回任务上下文路径清楚

自动化验收：

- 插件菜单可正确跳转插件页
- 自动化结果入口能跳到历史或任务
- 通知点击和历史点击的目标一致

人工验收：

- 从主工作区切到搜索/插件/自动化，不觉得跳出了应用结构

### W9. 持久化与会话恢复

目标：桌面应用重启后回到有意义的上下文。

范围文件：

- `packages/gui/src/store/app-store.ts`
- `packages/gui/src/store/chat-store.ts`
- `packages/gui/tests/app-store.test.ts`
- `packages/gui/tests/smoke.test.ts`

实施项：

- 持久化：
  - 当前项目
  - 当前任务
  - dock 开关
  - 当前 dock tab
  - 可能引入的左右栏宽度
- 恢复后不要出现状态错配

自动化验收：

- 重载后恢复当前项目和任务
- dock tab 恢复正确
- shell 关键区域恢复可见

人工验收：

- 重启 Bobby 后仍然能回到之前的工作位

### W10. 最终视觉系统和响应式收口

目标：把“看起来不统一”的最后差距收掉。

范围文件：

- `packages/gui/src/styles/tokens.css`
- `packages/gui/src/app.css`
- `packages/gui/src/screens/Workspace.tsx`
- `packages/gui/src/components/Sidebar.tsx`
- `packages/gui/src/components/SessionToolDock.tsx`
- `packages/gui/tests/smoke.test.ts`

实施项：

- 统一色板、圆角、边框、阴影、字体层级
- 统一 hover/focus/active 态
- 控制紧凑列表和正文阅读区的节奏差异
- 保证常见桌面宽度下不破版

自动化验收：

- smoke 通过
- 关键区域 DOM 仍存在

人工验收：

- 对照截图时，差距变成“细节”和“品牌”层面，而不是结构层面

## 7. 推荐执行顺序

严格按以下顺序推进：

1. `W1 Shell 骨架重构`
2. `W2 左侧一级导航与项目树对齐`
3. `W3 中央 transcript 重构`
4. `W4 Composer 控制台化`
5. `W5 环境信息卡完成度`
6. `W6 右侧工具入口与 dock 一体化`
7. `W7 文件面板精修`
8. `W8 搜索、插件、自动化纳入统一 shell`
9. `W9 持久化与会话恢复`
10. `W10 最终视觉系统和响应式收口`

说明：

- `W5` 和 `W7` 当前已有部分在做，但仍从属于上述主顺序。
- 若某 slice 需要先补 store/IP C 契约，可在本 slice 内前置，不单独拆散顺序。

## 8. 当前正在进行的子项

截至 2026-06-12 当前工作区，已进入但未完成的内容：

- 环境卡里新增了 `提交或推送` 和 `创建拉取请求` 的显式控件接线方向
- 文件面板已改为“默认空预览”的目标行为
- 对应测试已经开始按新行为改写，但仍有 focused test 未收绿

因此，下一个直接执行点应为：

1. 先收口 `W7 文件面板精修` 的 focused tests
2. 再把 `W5 环境信息卡完成度` 这轮实现收干净
3. 随后进入更上层的 `W1-W4` 结构收敛

原因：

- 当前工作区已经有这两个模块的在制改动，先收口能减少返工和冲突

## 9. 每个 slice 的固定执行纪律

每个 slice 必须遵守：

1. 先补或调整测试，先看到失败或缺口
2. 再改实现
3. 跑 focused tests
4. 跑 `pnpm --filter @bobby/gui test`
5. 若涉及 shell/composer/dock/IPC，再跑 `pnpm --filter @bobby/gui smoke:electron`
6. 测试全绿后立刻 `commit + push`
7. 在 handoff 中记录：
   - 目标
   - 变更文件
   - 验证命令
   - 未完成项

## 10. 自动化验收矩阵

### 必跑 focused suites

- `packages/gui/tests/workspace-screen.test.tsx`
- `packages/gui/tests/session-tool-dock.test.tsx`
- `packages/gui/tests/chat-store.test.ts`
- `packages/gui/tests/plugins.test.tsx`
- `packages/gui/tests/automations.test.tsx`
- `packages/gui/tests/history.test.tsx`
- `packages/gui/tests/app-store.test.ts`
- `packages/gui/tests/smoke.test.ts`

### 阶段验收命令

每个 GUI slice：

```powershell
pnpm --filter @bobby/gui test
```

涉及 shell/composer/dock/IPC：

```powershell
pnpm --filter @bobby/gui smoke:electron
```

里程碑验收：

```powershell
pnpm -r test
pnpm build
```

## 11. 人工验收脚本

最终必须按以下脚本走通：

1. 打开项目
2. 在同一项目下启动两个任务
3. 确认左侧项目树中两个任务状态互不串线
4. 在中央任务流里看到 reasoning、工具输出和最终结果
5. 打开文件面板，选中文件，再插入引用
6. 打开环境卡，检查分支、git 统计、progress checklist
7. 打开右侧 `审查 / 终端 / 浏览器 / 文件`
8. 从 composer 打开插件菜单并进入插件页
9. 运行一个自动化任务并跳到结果历史
10. 重启应用并恢复到原上下文
11. 跑完整测试和 smoke

## 12. 完成定义

以下条件同时满足，才算本计划完成：

- 结构上，Bobby GUI 已是稳定三栏工作台
- 空状态和活跃任务状态使用同一 shell
- 左侧项目/任务树具备 Codex Desktop 的阅读方式
- 中央 transcript、底部 composer、右上环境卡、右侧 dock 四个核心区都完成收口
- 文件面板行为和截图一致
- 搜索、插件、自动化页纳入统一 shell
- 持久化和恢复可用
- `pnpm -r test` 全绿
- `pnpm build` 通过
- `pnpm --filter @bobby/gui smoke:electron` 通过
- 人工验收脚本逐项通过

## 13. 非目标

本计划暂不单独扩展以下能力，除非上游指令另行要求：

- 新模型能力扩展
- 非桌面版特有的全新信息架构
- 与截图无关的功能性大改版
- 重新定义 Bobby 的产品品牌视觉方向

本文件是后续 GUI parity 开发的唯一落盘计划，后续执行只在此文件上推进，不再把主计划留在对话里。
