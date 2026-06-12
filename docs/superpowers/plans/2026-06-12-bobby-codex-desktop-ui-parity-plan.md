# Bobby Codex Desktop UI Parity Plan

> 状态：执行中  
> 日期：2026-06-12  
> 分支：`codex/bobby-cli-parity`

## 0. 目的

本计划用于把 Bobby GUI 从“已有功能页面集合”推进到“接近 Codex Desktop / Claude Code Desktop 的完整桌面工作台”。  
目标不是逐像素抄界面，而是对齐以下三件事：

1. 信息架构一致：左导航、项目树、任务区、右侧工具区、右上环境卡职责清晰。
2. 操作流一致：空状态、活跃任务、工具调用、文件查看、环境操作都在同一套 shell 内完成。
3. 状态语义一致：任务、分支、插件、工具、验证、错误都来自真实数据，不允许假控件和占位交互。

本文件是该阶段唯一主计划。后续 GUI parity 的执行、验收、续做统一以此文件为准。

## 1. 依据

1. `E:\ai-files\Bobby\docs\superpowers\plans\2026-06-11-bobby-desktop-parity-directive.md`
2. `E:\ai-files\Bobby\docs\superpowers\plans\2026-06-04-bobby-execution-protocol.md`
3. 2026-06-12 用户提供的 7 张 Codex Desktop 截图
4. 当前 Bobby GUI 实现现状与已完成切片

## 2. 当前对标结论

### 2.1 已经接近的部分

1. 已经具备桌面应用的基础壳体。
2. 已有左侧导航、项目列表、中央任务区、右侧工具 dock、右上环境卡、文件面板等模块雏形。
3. 已完成一轮 shell 收口：
   - 去掉了冗余 workspace 顶栏。
   - 左栏密度已经向 Codex 靠拢。
   - 中央 transcript 已从纯聊天样式开始向任务流样式过渡。
   - composer 已拆出控制层、输入层、上下文层基础结构。

### 2.2 仍然明显落后的部分

1. 整体仍更像“页面集合”，不像“持续驻留的桌面工作台”。
2. 左栏的应用区、项目区、任务区层级还不够明确。
3. 中央任务流缺少 Codex 那种“请求/执行/推理/工具/结果”一体化阅读感。
4. composer 还没有达到真正的控制台化，`+` 菜单、插件入口、上下文条都偏弱。
5. 右上环境卡还没成为真实的“当前工作上下文卡”，更多还是 git 信息卡。
6. 右侧 dock 的稳定性、持久化和内容密度仍不足。
7. 文件面板行为与截图差距较大，尤其是默认空预览、树/预览分栏、引用回写。
8. 搜索、插件、自动化页面还没有完全纳入统一 shell 语义。

## 3. 从截图抽取的目标界面模型

### 3.1 顶层窗口结构

目标是稳定三栏桌面工作台，而不是 dashboard。

- 左侧：一级应用导航 + 二级项目/任务树
- 中央：当前任务工作区
- 右侧：固定工具入口与面板
- 右上：环境信息卡
- 底部：统一 composer

空状态和活跃任务状态共用同一套 shell，不允许切成两套页面。

### 3.2 左侧一级导航

按截图，一级导航应稳定承载这些入口：

1. 新对话 / 快速对话
2. 搜索
3. 插件
4. 自动化
5. 设置

要求：

1. 它表达的是“应用区切换”，不是按钮堆。
2. 图标、文案、选中态、hover、focus 必须统一。
3. 切换一级页面时，中央 shell 与右侧 dock 不应被重建。

### 3.3 左侧二级区：项目与任务树

截图里的二级区是“项目树下挂任务”，不是平铺的 session 列表。

要求：

1. 项目是一级实体，任务是项目下实体。
2. 同项目多任务并行时，状态必须严格按 taskId 隔离。
3. 项目可展开/折叠，任务可高亮，状态可见。
4. 长名称要做截断并保留 hover 完整信息。
5. 滚动时层级感不能丢。

### 3.4 中央工作区

中央区域有两种状态，但必须使用同一 shell：

1. 空状态
   - 中央欢迎文案
   - 底部悬浮 composer
   - 左右结构仍完整存在
2. 活跃任务状态
   - 顶部显示当前任务标题
   - 下方是连续任务流
   - reasoning、tool output、status、error、final result 都在同一条任务链路里

要求：

1. 去掉任何仍像 dashboard 的容器感。
2. transcript 阅读体验要接近执行流，而不是气泡聊天流。
3. message / reasoning / tool / status / error 分层清晰。
4. 正文宽度、留白、密度按桌面工作台优化。

### 3.5 Composer

截图里的 composer 是控制台，不是普通输入框。

目标结构：

1. 输入层：提示词输入、发送、语音等。
2. 控制层：权限、计划模式、目标、模型档位、插件入口、`+` 菜单。
3. 上下文层：项目、本地模式、分支、目标上下文。

要求：

1. 空状态与任务状态共用同一 composer 组件契约。
2. `+` 菜单承载真实能力入口，不是跳页占位。
3. 插件入口既能跳转插件页，也要保留“当前可调用能力”的上下文感。
4. 项目 / 模式 / 分支这些上下文必须稳定、可理解、可测试。

### 3.6 右上环境信息卡

截图里它不是纯 git 卡，而是“当前执行上下文卡”。

应包含：

1. 变更统计
2. 本地环境标识
3. 当前分支与切换器
4. 提交或推送
5. 创建拉取请求
6. 进度 checklist
7. 浏览器目标
8. 来源信息

要求：

1. 所有动作都必须链接真实能力。
2. 不可用状态必须显式禁用并说明原因。
3. checklist 要来自真实任务/计划状态，而不是静态文案。
4. 分支切换器要支持展开、搜索、高亮当前分支。

### 3.7 右侧固定 dock

截图对标的右侧固定入口为：

1. 审查
2. 终端
3. 浏览器
4. 文件

要求：

1. 入口常驻，页面切换不消失。
2. 快捷键文案可见。
3. 对应面板是真可用，不是占位。
4. 当前 tab、开关态、面板内容需持久化恢复。

### 3.8 文件面板

截图对应的文件面板行为：

1. 左树右预览的双栏结构。
2. 默认空预览，不自动打开第一个文件。
3. 顶部有过滤框。
4. 目录支持展开/折叠。
5. 选中文件后才加载预览。

要求：

1. 读取失败必须显示错误卡。
2. 选中文件后可以回写引用到 composer。
3. 整体布局和密度接近截图，不走 IDE 式过重设计。

### 3.9 视觉系统

截图体现的是高密度深色桌面工作台：

1. 深色基底
2. 深灰面板
3. 较大圆角
4. 极细边框
5. 清晰的文本层级
6. 稳定的一致性交互 token

要求：

1. 建立统一 token，而不是零散补样式。
2. spacing、radius、border、hover、focus、active 全局一致。
3. 在 1366px 到 1920px 桌面宽度下表现稳定。

## 4. 开发原则

1. 先稳 shell，再做局部 polish。
2. 先保证真实行为，再对齐视觉。
3. 每个 slice 都必须带测试与手工验收。
4. UI 不承载业务真相，真实状态继续以 store / IPC / kernel 为准。
5. 每个 slice 验收通过必须立即 `commit + push`。
6. 不允许用假按钮、假 badge、假状态来制造“看起来像”的错觉。

## 5. 分阶段实施路线

### W1. Shell 骨架收口

目标：把 Bobby 稳定成三栏桌面工作台 shell。

范围文件：

- `E:\ai-files\Bobby\packages\gui\src\main.tsx`
- `E:\ai-files\Bobby\packages\gui\src\components\Sidebar.tsx`
- `E:\ai-files\Bobby\packages\gui\src\screens\Workspace.tsx`
- `E:\ai-files\Bobby\packages\gui\src\components\SessionToolDock.tsx`
- `E:\ai-files\Bobby\packages\gui\src\app.css`
- `E:\ai-files\Bobby\packages\gui\src\styles\tokens.css`

结果要求：

1. 空状态和任务状态使用同一 shell。
2. 左中右结构稳定，切任务不重建整体布局。
3. 右侧工具入口在空状态也可见。
4. 不再存在独立的 workspace 品牌顶栏。

当前状态：已基本完成，但还需继续作为后续所有切片的约束基线。

### W2. 左侧导航与项目树收口

目标：把左侧从“目录栏”提升为“应用区 + 项目树”。

范围文件：

- `E:\ai-files\Bobby\packages\gui\src\components\Sidebar.tsx`
- `E:\ai-files\Bobby\packages\gui\src\store\chat-store.ts`
- `E:\ai-files\Bobby\packages\gui\src\store\app-store.ts`
- `E:\ai-files\Bobby\packages\gui\tests\chat-store.test.ts`
- `E:\ai-files\Bobby\packages\gui\tests\workspace-screen.test.tsx`

结果要求：

1. 一级应用导航稳定并统一。
2. 项目与任务层级更清晰。
3. 并行任务状态严格按 taskId 隔离。
4. 任务列表密度和高亮语义接近截图。

当前状态：已完成第一轮密度对齐，但项目树表达仍不够强。

### W3. 中央 transcript 重构

目标：把中央工作区从聊天流改成任务执行流。

范围文件：

- `E:\ai-files\Bobby\packages\gui\src\screens\Workspace.tsx`
- `E:\ai-files\Bobby\packages\gui\src\components\MarkdownRenderer.tsx`
- `E:\ai-files\Bobby\packages\gui\src\app.css`
- `E:\ai-files\Bobby\packages\gui\tests\workspace-screen.test.tsx`

结果要求：

1. 当前任务标题与执行流关系明确。
2. request / response / reasoning / tool / status / error 分层清楚。
3. streaming 与 final result 只更新当前任务。
4. 阅读宽度、留白和密度接近桌面工作台。

当前状态：已完成基础分层，仍需继续压缩为更强的执行流阅读体验。

### W4. Composer 控制台化

目标：把底部输入区做成真正的任务控制台。

范围文件：

- `E:\ai-files\Bobby\packages\gui\src\screens\Workspace.tsx`
- `E:\ai-files\Bobby\packages\gui\src\store\chat-store.ts`
- `E:\ai-files\Bobby\packages\gui\src\ipc\contract.ts`
- `E:\ai-files\Bobby\packages\gui\tests\workspace-screen.test.tsx`
- `E:\ai-files\Bobby\packages\gui\tests\plugins.test.tsx`

结果要求：

1. `+` 菜单按截图的能力顺序组织。
2. 计划模式、目标、权限、模型档位语义清晰。
3. 项目 / 本地模式 / 分支 / 目标上下文在底部形成稳定一行。
4. 插件入口既可跳页，也体现当前已安装能力。

当前状态：三层结构已落地，下一阶段重点应放在能力组织和交互语义。

### W5. 环境信息卡完成态

目标：把右上角环境卡做成真实工作上下文卡。

范围文件：

- `E:\ai-files\Bobby\packages\gui\src\screens\Workspace.tsx`
- `E:\ai-files\Bobby\packages\gui\src\ipc\contract.ts`
- `E:\ai-files\Bobby\packages\gui\tests\workspace-screen.test.tsx`

结果要求：

1. git summary 来自真实数据。
2. 当前分支高亮正确，分支切换器可用。
3. 提交/推送与 PR 动作状态真实。
4. progress checklist 与真实任务计划状态联动。
5. 浏览器目标与来源信息表达清楚。

当前状态：已有骨架，但仍明显弱于截图。

### W6. 右侧 dock 一体化

目标：把右侧从工具抽屉改成长期驻留工作区。

范围文件：

- `E:\ai-files\Bobby\packages\gui\src\components\SessionToolDock.tsx`
- `E:\ai-files\Bobby\packages\gui\src\store\app-store.ts`
- `E:\ai-files\Bobby\packages\gui\src\screens\Workspace.tsx`
- `E:\ai-files\Bobby\packages\gui\tests\session-tool-dock.test.tsx`
- `E:\ai-files\Bobby\packages\gui\tests\workspace-screen.test.tsx`

结果要求：

1. 审查 / 终端 / 浏览器 / 文件四个入口稳定可切。
2. 快捷键、选中态、空态、错误态统一。
3. 页面切换后当前 tab 和开关状态可恢复。

### W7. 文件面板精修

目标：把文件面板行为对齐截图。

范围文件：

- `E:\ai-files\Bobby\packages\gui\src\components\SessionToolDock.tsx`
- `E:\ai-files\Bobby\packages\gui\src\ipc\contract.ts`
- `E:\ai-files\Bobby\packages\gui\tests\session-tool-dock.test.tsx`

结果要求：

1. 默认空预览。
2. 左树右预览稳定分栏。
3. 文件过滤可用。
4. 选中文件后才能预览。
5. 可把文件引用写回 composer。

### W8. 搜索 / 插件 / 自动化纳入统一 shell

目标：避免这些页面看起来像切到另一套应用。

范围文件：

- `E:\ai-files\Bobby\packages\gui\src\screens\Search.tsx`
- `E:\ai-files\Bobby\packages\gui\src\screens\PluginMarketplace.tsx`
- `E:\ai-files\Bobby\packages\gui\src\screens\ScheduleTasks.tsx`
- `E:\ai-files\Bobby\packages\gui\src\screens\History.tsx`
- `E:\ai-files\Bobby\packages\gui\src\main.tsx`
- `E:\ai-files\Bobby\packages\gui\tests\plugins.test.tsx`
- `E:\ai-files\Bobby\packages\gui\tests\automations.test.tsx`
- `E:\ai-files\Bobby\packages\gui\tests\history.test.tsx`

结果要求：

1. 这些页面保留统一 shell。
2. 插件页与 composer 插件入口语义一致。
3. 自动化结果可回到任务或历史语境。
4. 历史与任务上下文关联清晰。

### W9. 持久化与恢复

目标：应用重启后恢复到有意义的工作上下文。

范围文件：

- `E:\ai-files\Bobby\packages\gui\src\store\app-store.ts`
- `E:\ai-files\Bobby\packages\gui\src\store\chat-store.ts`
- `E:\ai-files\Bobby\packages\gui\tests\app-store.test.ts`
- `E:\ai-files\Bobby\packages\gui\tests\smoke.test.ts`

结果要求：

1. 当前项目、当前任务、dock 状态、当前 tab 能恢复。
2. 恢复后不出现状态串线和视觉错位。

### W10. 视觉系统与响应式收口

目标：把最后剩下的“结构已对，气质不对”差距收掉。

范围文件：

- `E:\ai-files\Bobby\packages\gui\src\styles\tokens.css`
- `E:\ai-files\Bobby\packages\gui\src\app.css`
- `E:\ai-files\Bobby\packages\gui\src\screens\Workspace.tsx`
- `E:\ai-files\Bobby\packages\gui\src\components\Sidebar.tsx`
- `E:\ai-files\Bobby\packages\gui\src\components\SessionToolDock.tsx`
- `E:\ai-files\Bobby\packages\gui\tests\smoke.test.ts`

结果要求：

1. 颜色、边框、圆角、阴影、层级统一。
2. hover / focus / active 一致。
3. 常见桌面宽度下不破版。

## 6. 执行顺序

严格按以下顺序推进：

1. W1 Shell 骨架收口
2. W2 左侧导航与项目树收口
3. W3 中央 transcript 重构
4. W4 Composer 控制台化
5. W5 环境信息卡完成态
6. W6 右侧 dock 一体化
7. W7 文件面板精修
8. W8 搜索 / 插件 / 自动化纳入统一 shell
9. W9 持久化与恢复
10. W10 视觉系统与响应式收口

说明：

1. W1-W4 是当前最高优先级，因为它们决定整体工作台形态。
2. W5-W7 属于核心体验强化，必须在 shell 收口后推进。
3. W8-W10 属于一致性与完成度收口，不能前置替代结构问题。

## 7. 每个切片的固定纪律

每个切片必须遵守：

1. 先补测试或调整测试，先显露缺口。
2. 再改实现。
3. 跑 focused tests。
4. 跑 `pnpm --filter @bobby/gui test`。
5. 若涉及 shell / composer / dock / IPC，再跑 `pnpm --filter @bobby/gui smoke:electron`。
6. 验收通过立即 `commit + push`。
7. 在 handoff 记录：
   - 目标
   - 修改文件
   - 验证命令
   - 未完成项

## 8. 自动化验收矩阵

### 必跑测试

- `E:\ai-files\Bobby\packages\gui\tests\workspace-screen.test.tsx`
- `E:\ai-files\Bobby\packages\gui\tests\session-tool-dock.test.tsx`
- `E:\ai-files\Bobby\packages\gui\tests\chat-store.test.ts`
- `E:\ai-files\Bobby\packages\gui\tests\plugins.test.tsx`
- `E:\ai-files\Bobby\packages\gui\tests\automations.test.tsx`
- `E:\ai-files\Bobby\packages\gui\tests\history.test.tsx`
- `E:\ai-files\Bobby\packages\gui\tests\app-store.test.ts`
- `E:\ai-files\Bobby\packages\gui\tests\smoke.test.ts`

### 阶段命令

每个 GUI 切片至少执行：

```powershell
pnpm --filter @bobby/gui test
```

涉及 shell / composer / dock / IPC 的切片额外执行：

```powershell
pnpm --filter @bobby/gui smoke:electron
```

阶段里程碑验收执行：

```powershell
pnpm -r test
pnpm build
```

## 9. 手工验收脚本

最终至少完整走通以下脚本：

1. 打开项目。
2. 在同一项目下启动两个任务。
3. 确认左侧任务状态互不串线。
4. 在中央任务流中看到 reasoning、工具输出和最终结果。
5. 打开文件面板，选中文件，并把引用插回 composer。
6. 打开环境卡，检查分支、git 统计、progress checklist。
7. 打开右侧 `审查 / 终端 / 浏览器 / 文件` 四个入口。
8. 从 composer 打开插件菜单并进入插件页。
9. 运行一个自动化任务并跳转到结果或历史。
10. 重启应用并恢复到原工作上下文。
11. 跑完整测试与 smoke。

## 10. 完成定义

只有以下条件同时满足，才算本计划完成：

1. Bobby GUI 已是稳定三栏桌面工作台。
2. 空状态与活跃任务状态共用同一 shell。
3. 左侧项目/任务树达到截图级的信息架构清晰度。
4. 中央 transcript、底部 composer、右上环境卡、右侧 dock 四个核心区全部收口。
5. 文件面板行为与截图目标一致。
6. 搜索、插件、自动化已纳入统一 shell。
7. 持久化与恢复可用。
8. `pnpm -r test` 全绿。
9. `pnpm build` 通过。
10. `pnpm --filter @bobby/gui smoke:electron` 通过。
11. 手工验收脚本逐项通过。

## 11. 当前建议的下一开发切片

基于现状，下一步应优先做：

1. W4 深化：把 composer 的 `+` 菜单、插件入口、上下文条做成更接近 Codex 的控制台交互。
2. W5 收口：把环境信息卡从“显示信息”升级为“真实工作上下文卡”。
3. 然后进入 W6/W7：把右侧 dock 与文件面板做成稳定长期驻留能力。

## 12. 非目标

本阶段不单独扩展以下能力，除非上游指令另行要求：

1. 与截图无关的新模型能力。
2. 与截图无关的全新信息架构。
3. 非桌面版特有的大改版。
4. 重做 Bobby 品牌系统。
