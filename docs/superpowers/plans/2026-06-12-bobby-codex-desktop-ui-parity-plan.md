# Bobby Codex Desktop UI Parity Plan

> 状态：执行中  
> 日期：2026-06-12  
> 分支：`codex/bobby-cli-parity`  
> 目标：基于 2026-06-12 提供的 Codex Desktop 截图，把 Bobby GUI 从“已有功能”推进到“桌面工作台形态、信息架构、操作流接近 Codex Desktop”。

## 1. 计划依据

本计划只基于以下输入：

1. 仓库既有约束与阶段任务
   - `docs/superpowers/plans/2026-06-11-bobby-desktop-parity-directive.md`
   - `docs/superpowers/plans/2026-06-04-bobby-execution-protocol.md`
2. 2026-06-12 用户提供的 Codex Desktop 截图
3. 当前 Bobby GUI 已实现能力与已知差距

本文件是后续 GUI parity 的唯一落盘计划。后续执行、验收、续做，统一以本文件为准。

## 2. 目标定义

目标不是把 Bobby 改成“像聊天页”，而是改成一个完整桌面工作台：

- 左侧是稳定的应用导航和项目/任务树
- 中间是当前任务的主工作区
- 底部是控制台式 composer
- 右侧是稳定存在的工具入口与 dock
- 右上是环境信息卡，承载 git、分支、进度、浏览器、来源
- 空状态和任务状态共用同一套 shell，而不是两套页面

## 3. 从截图抽取的目标界面模型

### 3.1 顶层窗口结构

截图体现的是“三栏工作台”而不是“单页 dashboard”：

- 顶层保留原生菜单栏
- 左侧固定导航和项目区长期存在
- 中间是任务画布
- 右侧是工具入口和可展开面板
- 空状态下 shell 仍完整可见，不应只剩一个欢迎页

### 3.2 左侧一级导航

截图中的一级导航为：

- `新对话` 或 `快速对话`
- `搜索`
- `插件`
- `自动化`
- `设置`

要求：

- 一级导航表达“应用区切换”，不是功能卡片集合
- 图标、文案、选中态、间距、hover/focus 统一
- 页面切换时 shell 不闪断，右侧 dock 不重置

### 3.3 左侧二级导航：项目与任务树

截图中的二级结构是：

- `项目` 分组常驻
- 项目节点下直接展示任务条目
- 当前任务可高亮，任务状态可见
- 项目列表滚动时仍保持清晰层级

要求：

- 项目是一级实体，任务是项目下属实体
- 任务状态必须来自 per-task 数据，不能再用全局 busy 替代
- 并行任务时不能串线
- 长项目名、长任务名支持截断与 hover 完整展示

### 3.4 中央工作区

截图中的中央区域有两种共享 shell 的状态：

1. 空状态
   - 中央大标题
   - 底部 composer 居中悬浮
   - 左右结构仍存在
2. 活跃任务状态
   - 当前任务标题显示在工作区头部
   - transcript 按任务流呈现
   - reasoning、工具输出、状态、最终结果在同一条任务流里

要求：

- 去掉冗余 workspace 顶栏品牌条
- transcript 不是普通聊天气泡堆叠，而是任务执行流
- message / reasoning / tool / status / error 五类块层级清晰
- 阅读宽度、留白、正文密度接近桌面工作台

### 3.5 Composer

截图中的 composer 不是单一输入框，而是控制台：

- 有 `+` 菜单
- 有计划模式、目标开关、插件入口
- 有权限级别、模型档位、语音、发送等控制
- 有项目、执行目标、本地模式、分支等上下文条

要求：

- composer 拆为三层
  - 输入层
  - 控制层
  - 上下文层
- 空状态与活跃任务状态共用同一 composer 组件合同
- `+` 菜单要体现可调用能力，而不是跳页占位
- 插件入口既能进入插件页，也要保留“已安装/可调用”的上下文感

### 3.6 右上环境信息卡

截图中的环境卡包含：

- `环境信息`
- git 变更统计
- 本地环境标签
- 分支选择器
- `提交或推送`
- `创建拉取请求`
- 进度 checklist
- 浏览器目标
- 来源

要求：

- 这张卡是“当前任务上下文卡”，不是纯 git 卡
- 分支切换器支持展开、搜索、高亮当前分支
- `提交或推送` 要么可用，要么显式禁用并说明原因
- `创建拉取请求` 同理，不能伪装可用
- checklist 与当前任务/计划状态联动

### 3.7 右侧稳定工具入口与 dock

截图中的右侧入口为：

- `审查`
- `终端`
- `浏览器`
- `文件`

要求：

- 入口常驻，不随页面切换消失
- 快捷键文案可见
- 打开后出现真正可用的面板，不是占位
- dock 的开关、当前 tab、内容状态应持久化

### 3.8 文件面板

截图中的文件面板行为：

- 左侧文件树，右侧预览
- 初始为空预览，不自动打开第一个文件
- 顶部有过滤框
- 目录支持展开/折叠
- 选中文件后才预览

要求：

- 默认空预览
- 树和预览分栏明确
- 读取失败显示错误卡
- 选中文件后可插入引用回写到 composer

### 3.9 视觉系统

截图体现的视觉方向：

- 近黑背景
- 深灰面板
- 较大的圆角
- 很细的边框
- 高密度列表
- 清晰的文字层级

要求：

- 建立统一 token，不再零碎补样式
- spacing、radius、border、hover、focus、active 全局一致
- 在 1366px 到 1920px 桌面宽度下都稳定

## 4. 当前 Bobby 已有基础

当前不是从零开始，已具备：

- 左侧导航与项目列表基础
- 中央 transcript 基础
- 右侧 `review / terminal / browser / files` 基础
- 搜索、插件、自动化页面基础
- 环境卡基础
- 文件面板基础

当前主要问题不是“有没有功能”，而是：

- shell 结构还不够像桌面工作台
- 模块像拼接，不像统一系统
- 多数区域的交互密度、状态归属、视觉一致性仍明显落后于目标截图

## 5. 开发原则

1. 先 shell，后局部面板  
   不先稳定结构，局部 polish 会反复返工。
2. 先行为正确，再做视觉对齐  
   禁止用假控件制造错误预期。
3. 每个 slice 必须带测试与验收  
   不接受“看起来差不多”。
4. UI 零业务逻辑继续成立  
   任务、计划、git、工具能力仍以 store / IPC / kernel 为准。
5. 每个验收通过的 slice 立即 `commit + push`  
   不再积压大批未推送改动。

## 6. 工单拆解

### W1. Shell 骨架重构

目标：先把 Bobby 固定成三栏工作台骨架。

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
- 去掉仍像 dashboard 的多余顶栏和容器包装
- 空状态与任务状态共用同一 shell
- 右侧工具入口在空状态下也保持可见

验收标准：

- 打开 GUI 未选任务时仍能看见完整 shell
- 进入任务后 shell 结构不重排
- 不再存在独立 workspace 品牌顶栏

### W2. 左侧导航与项目树对齐

目标：把左侧从“页面目录”变成“应用区 + 项目树”。

范围文件：

- `packages/gui/src/components/Sidebar.tsx`
- `packages/gui/src/store/chat-store.ts`
- `packages/gui/src/store/app-store.ts`
- `packages/gui/tests/chat-store.test.ts`
- `packages/gui/tests/workspace-screen.test.tsx`

实施项：

- 一级导航只保留：
  - 新对话
  - 搜索
  - 插件
  - 自动化
  - 设置
- 项目区和任务区层级明确
- 项目节点支持展开/折叠
- 项目下任务高密度展示
- 状态改为严格 per-task 派生

验收标准：

- 同项目两个任务并行时状态不串线
- 左侧能稳定看见项目及其任务
- 滚动时层级关系仍清晰

### W3. 中央 transcript 重构

目标：把中间区域从聊天页读感改成任务流读感。

范围文件：

- `packages/gui/src/screens/Workspace.tsx`
- `packages/gui/src/components/MarkdownRenderer.tsx`
- `packages/gui/src/app.css`
- `packages/gui/tests/workspace-screen.test.tsx`

实施项：

- 当前任务标题固定在主工作区头部
- 统一 transcript block 层级：
  - 用户请求
  - assistant 回复
  - reasoning
  - 工具输出
  - 状态卡
  - 错误卡
- “正在思考”“已运行 N 条命令”“审查”等状态自然挂在任务流上
- 控制正文最大宽度，减少满屏铺开

验收标准：

- 空状态标题和 composer 居中，但 shell 不消失
- 任务执行时 transcript 连续可读
- streaming、reasoning、final result 只更新当前任务

### W4. Composer 控制台化

目标：把底部输入区做成真正的任务控制台。

范围文件：

- `packages/gui/src/screens/Workspace.tsx`
- `packages/gui/src/store/chat-store.ts`
- `packages/gui/src/ipc/contract.ts`
- `packages/gui/tests/workspace-screen.test.tsx`
- `packages/gui/tests/plugins.test.tsx`

实施项：

- composer 重构为三层：
  - 输入层
  - 控制层
  - 上下文层
- `+` 菜单按截图顺序组织：
  - 添加照片和文件
  - 创建
  - 计划模式
  - 追求目标
  - 插件
- 明确显示：
  - 权限级别
  - 目标开关
  - 模型档位
  - 语音/发送
- 项目、本地模式、分支、目标等上下文统一排布

验收标准：

- plus 菜单顺序稳定
- 项目 picker 可搜索
- 插件入口能进入插件页且保留上下文一致性
- 计划模式/目标控制在空状态与任务状态都可见

### W5. 环境信息卡完成度

目标：把右上卡片收敛成统一的上下文卡。

范围文件：

- `packages/gui/src/screens/Workspace.tsx`
- `packages/gui/src/ipc/contract.ts`
- `packages/gui/tests/workspace-screen.test.tsx`

实施项：

- 稳定展示：
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
- `提交或推送` 联动 review/diff 流
- `创建拉取请求` 未接线前显式禁用并说明原因
- checklist 来自真实计划状态

验收标准：

- git 统计来自真实 summary
- 当前分支高亮正确
- `提交或推送` 点击后产生明确行为
- `创建拉取请求` 的禁用态与原因可见

### W6. 右侧 dock 一体化

目标：把右侧从“工具抽屉”改成“长期驻留工作区”。

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
- review、terminal、browser、files 的空状态与错误态统一

验收标准：

- 切换 tab 不丢状态
- 页面切换不会异常关闭 dock
- 空状态下仍能打开各工具

### W7. 文件面板精修

目标：把文件面板行为与截图彻底对齐。

范围文件：

- `packages/gui/src/components/SessionToolDock.tsx`
- `packages/gui/src/ipc/contract.ts`
- `packages/gui/tests/session-tool-dock.test.tsx`

实施项：

- 保持默认空预览
- 左树右预览布局固定
- 文件筛选可用且稳定
- 目录展开/折叠清晰
- 选中高亮统一
- 读取失败显示错误卡
- 插入引用继续回写 composer

验收标准：

- 初始显示 `Open file` 空状态
- 选中文件后才出现预览
- 筛选结果能缩小树内容
- 读取失败走错误卡

### W8. 搜索、插件、自动化纳入统一 shell

目标：避免这些页面像“跳出主应用”。

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
- 插件页与 composer 插件入口语义一致
- 自动化页提升结果可见性
- 自动化到历史/任务结果有明确跳转路径
- 历史记录回到任务上下文的路径清楚

验收标准：

- 插件菜单可正确跳转插件页
- 自动化结果能回到任务或历史
- 从主工作区切到搜索/插件/自动化时不显得是另一套应用

### W9. 持久化与恢复

目标：应用重启后恢复到有意义的工作上下文。

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
  - 必要的 shell 布局状态
- 恢复后避免状态错配

验收标准：

- 重载后恢复当前项目和任务
- dock tab 恢复正确
- shell 关键区域恢复可见

### W10. 最终视觉系统与响应式收口

目标：把最后的“看起来不统一”差距收掉。

范围文件：

- `packages/gui/src/styles/tokens.css`
- `packages/gui/src/app.css`
- `packages/gui/src/screens/Workspace.tsx`
- `packages/gui/src/components/Sidebar.tsx`
- `packages/gui/src/components/SessionToolDock.tsx`
- `packages/gui/tests/smoke.test.ts`

实施项：

- 统一色板、圆角、边框、阴影、文字层级
- 统一 hover / focus / active
- 拉开高密度列表与正文阅读区节奏差
- 保证常见桌面宽度下不破版

验收标准：

- 核心区域 DOM 与交互都稳定
- 视觉差距缩小到“品牌风格差异”，不再是结构差异

## 7. 建议执行顺序

严格按以下顺序推进：

1. `W1 Shell 骨架重构`
2. `W2 左侧导航与项目树对齐`
3. `W3 中央 transcript 重构`
4. `W4 Composer 控制台化`
5. `W5 环境信息卡完成度`
6. `W6 右侧 dock 一体化`
7. `W7 文件面板精修`
8. `W8 搜索、插件、自动化纳入统一 shell`
9. `W9 持久化与恢复`
10. `W10 最终视觉系统与响应式收口`

说明：

- `W5`、`W7` 当前已有部分实现，但仍按上述顺序纳入统一收口。
- 若某个 slice 需要先补 store / IPC 契约，在该 slice 内前置完成，不单独拆出并打乱顺序。

## 8. 当前优先级判断

基于截图差距，当前最高优先的不是继续补局部按钮，而是先完成以下结构收口：

1. `W1` 去掉冗余 workspace 顶栏，稳定 shell
2. `W2` 把左侧改成 Codex 风格的导航 + 项目树
3. `W3` 让中间区域读起来像任务流而不是聊天流
4. `W4` 把 composer 做成控制台

这四项做完后，再推进环境卡、dock、文件面板，否则后续样式和行为会持续返工。

## 9. 每个 slice 的固定执行纪律

每个 slice 必须遵守：

1. 先补或调整测试，先看见失败或缺口
2. 再改实现
3. 跑 focused tests
4. 跑 `pnpm --filter @bobby/gui test`
5. 若涉及 shell / composer / dock / IPC，再跑 `pnpm --filter @bobby/gui smoke:electron`
6. 测试全绿后立即 `commit + push`
7. 在 handoff 记录：
   - 目标
   - 变更文件
   - 验证命令
   - 未完成项

## 10. 自动化验收矩阵

### 必跑测试

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

涉及 shell / composer / dock / IPC：

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
4. 在中央任务流中看到 reasoning、工具输出和最终结果
5. 打开文件面板，选中文件，再插入引用
6. 打开环境卡，检查分支、git 统计、progress checklist
7. 打开右侧 `审查 / 终端 / 浏览器 / 文件`
8. 从 composer 打开插件菜单并进入插件页
9. 运行一个自动化任务并跳到结果/历史
10. 重启应用并恢复到原上下文
11. 跑完整测试与 smoke

## 12. 完成定义

以下条件同时满足，才算本计划完成：

- Bobby GUI 已是稳定三栏工作台
- 空状态与活跃任务状态共用同一 shell
- 左侧项目/任务树达到 Codex Desktop 的阅读方式
- 中央 transcript、底部 composer、右上环境卡、右侧 dock 四个核心区全部收口
- 文件面板行为与截图一致
- 搜索、插件、自动化页面纳入统一 shell
- 持久化与恢复可用
- `pnpm -r test` 全绿
- `pnpm build` 通过
- `pnpm --filter @bobby/gui smoke:electron` 通过
- 人工验收脚本逐项通过

## 13. 非目标

本计划暂不单独扩展以下能力，除非上游指令另行要求：

- 新模型能力扩展
- 与截图无关的全新信息架构
- 非桌面版特有的大改版
- 重新定义 Bobby 的产品品牌视觉方向

后续所有 GUI parity 开发，统一在本文件基础上推进，不再把主计划停留在对话里。
