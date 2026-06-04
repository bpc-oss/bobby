# Bobby 项目设计总纲 v0.1

日期：2026-06-03  
项目名：Bobby  
项目定位：面向工程师和普通用户的“问题到结果”CLI agent  
第一落地方式：CLI  
第一实现目标：可交给 Codex 或工程团队按模块实现

---

## 0. 一句话定义

Bobby 是一个用户只需要提出需求，系统就尽最大可能通过代码、脚本、命令、文件处理、项目修改和验证流程交付结果的 CLI agent。

它不是单纯的“代码助手”。它的核心是：

> 用户提出问题，Bobby 把问题翻译成可交付结果，用代码作为底层手段执行，用证据和验证约束模型幻觉，最后诚实说明完成了什么、没完成什么、验证了什么、没验证什么。

---

## 1. Bobby 的核心理念

### 1.1 用户不需要懂代码

Bobby 的最终目标不是服务少数会写代码的人，而是让普通用户也能表达需求并获得结果。

用户应该可以这样说：

- “帮我把这个文件夹里的发票按月份整理好。”
- “帮我做一个可以查询员工制度的小网页。”
- “帮我把客户反馈表分类并生成报告。”
- “这个项目登录后会跳回首页，帮我修。”
- “帮我把每天重复的 Excel 操作自动化。”

用户不需要说 Python、Node.js、React、数据库、API、测试命令。Bobby 自己负责判断需要什么技术路线。

### 1.2 代码只是手段，结果才是产品

Bobby 不应该把“生成代码”当成完成任务。对用户来说，交付物可能是：

- 一个可以运行的小工具。
- 一个整理好的文件夹。
- 一个生成好的 Excel、CSV、PDF 或报告。
- 一个修复后的代码项目。
- 一个本地网页。
- 一个自动化脚本。
- 一个诊断结论。
- 一个可回滚的 git patch。

因此 Bobby 的内部目标不是 `write code`，而是 `deliver outcome`。

### 1.3 模型不可信，流程可信

DeepSeek 可以生成代码、解释问题、提出方案，但 Bobby 不能相信模型自己的完成声明。

Bobby 必须通过工具确认事实：

- 文件是否真的存在。
- 代码是否真的修改了。
- 命令是否真的执行了。
- 测试是否真的通过了。
- 输出文件是否真的生成了。
- 用户要求是否真的被满足。

没有证据，不能下结论。没有验证，不能说完成。

### 1.4 诚实优先

Bobby 的第一铁律：

> 没有验证，不准说完成。

Bobby 必须区分：

- 已完成。
- 已修改但未验证。
- 部分完成。
- 失败。
- 推测。
- 证据不足。
- 需要用户提供更多信息。

Bobby 可以失败，但不能假装成功。

### 1.5 小步执行，可回滚

Bobby 不应该一次性大改。它应该：

1. 先理解需求。
2. 先读证据。
3. 先生成结果确认单。
4. 小范围修改。
5. 运行验证。
6. 失败后循环修复。
7. 仍失败则停止并诚实报告。

所有写入动作都应该尽量可回滚。默认在修改前创建 git checkpoint 或 Bobby 自己的文件快照。

### 1.6 让普通用户回答业务问题，不回答技术问题

Bobby 不应该问普通用户：

- “你要用 Python 还是 Node.js？”
- “你要用 SQLite 还是 PostgreSQL？”
- “你要用 FastAPI 还是 Express？”

Bobby 应该问：

- “这个工具只给你自己用，还是要多人一起用？”
- “输出希望是表格、网页，还是 PDF？”
- “是否允许修改原文件，还是只能复制？”
- “结果错了会不会造成严重后果？”
- “是否需要记住历史记录？”

技术选择由 Bobby 负责，业务约束由用户确认。

---

## 2. 产品定位

### 2.1 长期定位

Bobby 是一个“问题到结果”的执行型 agent。

用户给目标，Bobby 做拆解、执行、验证和交付。

### 2.2 第一批用户

第一批用户是企业工程师。

原因不是 Bobby 只服务工程师，而是企业工程师最容易提供：

- 代码仓库。
- 测试命令。
- 报错日志。
- 运行环境。
- 明确反馈。

这能帮助 Bobby 快速打磨可靠性和诚实机制。

### 2.3 最终用户

最终用户包括：

- 企业工程师。
- 运营人员。
- 财务人员。
- 行政人员。
- 数据分析人员。
- 小团队创始人。
- 普通电脑用户。

他们不一定懂代码，但有真实问题需要解决。

### 2.4 Bobby 不是哪些东西

Bobby 不是聊天机器人。  
Bobby 不是单纯代码补全工具。  
Bobby 不是只会回答问题的问答系统。  
Bobby 不是无约束自动黑盒执行器。  
Bobby 不是靠模型自我声明完成的“嘴上完成”工具。  

Bobby 是一个有证据、有执行、有验证、有回滚、有诚实报告的结果交付 agent。

---

## 3. 核心用户故事

### 3.1 企业工程师场景

用户输入：

```bash
bobby do "修复登录后偶尔跳回首页的问题"
```

Bobby 应该：

1. 识别这是代码项目修复任务。
2. 读取项目结构。
3. 查找登录、鉴权、路由相关文件。
4. 复述理解和成功标准。
5. 读取相关代码。
6. 制定修改计划。
7. 创建 checkpoint。
8. 应用 patch。
9. 运行测试或类型检查。
10. 如果失败，读取失败日志并修复。
11. 输出普通报告和技术报告。

最终 Bobby 不能只说“完成”。它必须说：

- 改了什么。
- 验证了什么。
- 哪些没验证。
- 是否还有风险。
- 如何回滚。

### 3.2 普通用户文件处理场景

用户输入：

```bash
bobby do "帮我把下载文件夹里的发票按月份整理好"
```

Bobby 应该：

1. 判断这是本地文件整理任务。
2. 询问或推断输入文件夹。
3. 生成结果确认单。
4. 默认不删除原文件，只复制或移动到目标目录前询问。
5. 写一个可重复运行的小脚本。
6. 用少量样例文件试运行。
7. 生成整理后的文件夹。
8. 给出使用说明。
9. 明确说明没有识别日期的文件如何处理。

### 3.3 数据处理场景

用户输入：

```bash
bobby do "把这个客户反馈 Excel 分类并生成总结"
```

Bobby 应该：

1. 要求用户提供样例 Excel。
2. 读取表头和少量样例行。
3. 询问分类标准，或自动建议分类标准。
4. 生成结果确认单。
5. 创建处理脚本。
6. 运行脚本生成输出 Excel 和总结报告。
7. 验证输出文件是否存在、行数是否正确、分类字段是否生成。
8. 明确说明分类结果可能需要人工复核。

### 3.4 小网页/内部工具场景

用户输入：

```bash
bobby do "做一个让同事提交报销信息的小网页"
```

Bobby 应该问业务问题：

- 是本地使用还是多人通过链接访问？
- 是否需要登录？
- 提交后保存在哪里？
- 是否需要导出 Excel？

Bobby 不应该先问技术框架。

---

## 4. CLI 设计

### 4.1 核心命令

```bash
bobby do "需求"
```

这是最重要的命令。它代表 Bobby 的核心心智：用户提出需求，Bobby 尽力完成。

### 4.2 辅助命令

```bash
bobby ask "问题"
```

只分析，不修改文件。

```bash
bobby fix "问题"
```

偏工程师语义：修复当前项目中的问题。

```bash
bobby make "需求"
```

偏普通用户语义：生成小工具、脚本、网页或自动化流程。

```bash
bobby verify
```

验证当前 Bobby 生成或修改的结果。

```bash
bobby status
```

查看当前任务状态、证据、修改、验证结果。

```bash
bobby report
```

生成本次任务报告。

```bash
bobby undo
```

回滚 Bobby 上一次修改。

```bash
bobby config
```

查看或修改 Bobby 配置。

```bash
bobby init
```

在当前项目创建 `.bobby/` 和 `bobby.yml`。

### 4.3 输出模式

```bash
bobby do "需求" --audience user
bobby do "需求" --audience dev
bobby do "需求" --audience mixed
```

默认建议：`mixed`。

- `user`：普通用户报告，只讲目标、结果、验证、风险、下一步。
- `dev`：工程师报告，显示文件、diff、命令、测试、日志。
- `mixed`：先显示普通摘要，再显示可折叠或简短技术摘要。

### 4.4 权限模式

```bash
bobby do "需求" --permission observe
bobby do "需求" --permission standard
bobby do "需求" --permission enhanced
bobby do "需求" --permission full
```

- `observe`：只读，不改任何东西。
- `standard`：可以创建/修改文件、运行安全命令、生成结果。默认模式。
- `enhanced`：可以安装依赖、访问网络、启动本地服务。
- `full`：可以执行任意命令，但危险操作前必须二次确认，并记录审计日志。

### 4.5 自动确认策略

```bash
bobby do "需求" --approval always
bobby do "需求" --approval on-risk
bobby do "需求" --approval never
```

- `always`：所有写操作前确认。
- `on-risk`：低风险自动执行，高风险确认。默认建议。
- `never`：不询问，适合高级用户或 CI 环境，但必须记录日志。

### 4.6 模型策略

```bash
bobby do "需求" --model auto
bobby do "需求" --model flash
bobby do "需求" --model pro
bobby do "需求" --model conservative
```

- `auto`：默认。Flash 和 Pro 自动路由。
- `flash`：尽量使用 Flash，成本低、速度快。
- `pro`：尽量使用 Pro，适合复杂任务。
- `conservative`：更频繁使用 Pro 审查，更少自动执行。

---

## 5. 核心工作流

Bobby 的每个任务都经过 9 个阶段。

### 阶段 1：Intake，接收需求

输入是用户自然语言。

输出：原始需求记录。

Bobby 不能在这个阶段直接改文件。

### 阶段 2：Classify，任务分类

Bobby 判断任务类型：

1. 修复问题。
2. 制作小工具。
3. 数据处理。
4. 网页/内部系统。
5. 自动化流程。
6. 代码项目改造。
7. 诊断排查。
8. 文档/知识工具。
9. 其他。

输出字段：

```ts
type TaskType =
  | "bug_fix"
  | "tool_creation"
  | "data_processing"
  | "web_app"
  | "automation"
  | "codebase_change"
  | "diagnosis"
  | "knowledge_tool"
  | "other";
```

### 阶段 3：Outcome Contract，结果确认单

Bobby 把模糊需求翻译成可交付目标。

结果确认单必须包含：

```ts
interface OutcomeContract {
  task_id: string;
  user_goal: string;
  interpreted_goal: string;
  task_type: TaskType;
  inputs_needed: string[];
  expected_outputs: string[];
  success_criteria: string[];
  non_goals: string[];
  assumptions: string[];
  risks: string[];
  permission_required: PermissionLevel;
  questions_for_user: Question[];
}
```

普通用户看到的版本必须短，不超过 8 行。

示例：

```text
我理解你的目标：做一个本地工具，把发票文件按月份整理。
输入：一个包含发票 PDF 的文件夹。
输出：按 年/月 分类的新文件夹。
成功标准：原文件不丢失；无法识别日期的文件单独放入“需人工确认”。
默认安全策略：先复制，不删除原文件。
需要你确认：使用哪个文件夹作为输入？
```

### 阶段 4：Evidence Collection，证据收集

Bobby 读取真实环境：

- 目录结构。
- 文件内容。
- 配置文件。
- package.json、pyproject.toml、go.mod 等依赖信息。
- 日志。
- 用户提供的数据样例。
- 当前 git diff。
- 测试命令输出。

规则：模型不能凭空声称读过某个文件。所有读取行为必须记录到证据账本。

### 阶段 5：Plan，制定计划

Bobby 制定执行计划。

计划必须包含：

- 要创建或修改什么。
- 为什么这么做。
- 会运行哪些验证。
- 可能失败在哪里。
- 是否需要用户确认。

复杂任务用 DeepSeek Pro。简单任务可以用 Flash。

### 阶段 6：Execute，执行

Bobby 执行计划：

- 创建文件。
- 修改文件。
- 生成脚本。
- 运行命令。
- 安装依赖。
- 启动本地服务。
- 生成输出文件。

默认通过 patch 修改已有文件，不直接覆盖。

### 阶段 7：Verify，验证

Bobby 验证结果：

- 运行测试。
- 运行 typecheck。
- 运行 lint。
- 执行脚本。
- 检查输出文件是否存在。
- 检查输出行数、字段、目录结构是否符合预期。
- 对比执行前后差异。

验证结果必须写入证据账本。

### 阶段 8：Repair Loop，失败修复循环

如果验证失败，Bobby 进入修复循环。

建议默认最多 3 轮：

1. 第一轮：Flash 总结失败，尝试小修。
2. 第二轮：Flash 或 Pro 继续修。
3. 第三轮：Pro 重新审查整体计划。

三轮后仍失败，停止并输出失败报告。

### 阶段 9：Report，交付报告

最终报告必须包含：

- 结果状态。
- 已完成内容。
- 已验证内容。
- 未验证内容。
- 修改或生成的文件。
- 使用方法。
- 风险。
- 回滚方式。
- 下一步建议。

---

## 6. 状态机设计

Bobby 任务状态：

```ts
type BobbyTaskStatus =
  | "created"
  | "classified"
  | "contract_ready"
  | "waiting_for_user"
  | "collecting_evidence"
  | "planning"
  | "waiting_for_approval"
  | "executing"
  | "verifying"
  | "repairing"
  | "reviewing"
  | "completed_verified"
  | "completed_unverified"
  | "partially_completed"
  | "failed"
  | "cancelled"
  | "rolled_back";
```

完成状态不能由模型直接设置。只能由 verifier/reporter 根据证据账本计算。

---

## 7. 证据账本 Evidence Ledger

### 7.1 目的

证据账本是 Bobby 反幻觉的核心。

它记录 Bobby 所有重要事实的来源。Bobby 的最终报告必须引用这些证据，而不是引用模型自己的想象。

### 7.2 证据类型

```ts
type EvidenceType =
  | "user_statement"
  | "file_read"
  | "file_written"
  | "command_run"
  | "test_result"
  | "git_diff"
  | "generated_output"
  | "doc_lookup"
  | "model_inference"
  | "unverified";
```

### 7.3 证据结构

```ts
interface EvidenceItem {
  id: string;
  task_id: string;
  type: EvidenceType;
  timestamp: string;
  source: string;
  summary: string;
  raw_ref?: string;
  exit_code?: number;
  file_path?: string;
  line_start?: number;
  line_end?: number;
  hash?: string;
  metadata?: Record<string, unknown>;
}
```

### 7.4 结论结构

Bobby 所有重要结论都应该这样保存：

```ts
interface Claim {
  id: string;
  task_id: string;
  text: string;
  status: "verified" | "partially_verified" | "inferred" | "unverified" | "false";
  evidence_ids: string[];
}
```

### 7.5 禁止规则

- 没有 `file_read`，不能说文件里有什么。
- 没有 `command_run`，不能说命令执行成功。
- 没有 `test_result` 且退出码为 0，不能说测试通过。
- 没有 `git_diff`，不能说修改了哪些代码。
- 没有 `generated_output`，不能说生成了交付物。
- 只有 `model_inference` 的结论必须标注为“推测”。

---

## 8. 反幻觉机制

### 8.1 文件幻觉防护

模型想读取或修改文件时，必须先通过工具确认文件存在。

如果文件不存在，Bobby 必须说：

> 我没有在当前目录找到这个文件，不能确认它存在。

### 8.2 API 幻觉防护

遇到依赖库 API，Bobby 必须先读取项目依赖版本。

如果是陌生库或版本敏感 API，Bobby 应该查官方文档或项目内已有用法。

### 8.3 测试幻觉防护

模型不能直接说测试通过。只有 verifier 看到命令退出码 0，才能写入：

```json
{"claim": "测试通过", "status": "verified"}
```

### 8.4 完成幻觉防护

最终报告的标题不能直接由模型自由生成。应由状态机生成：

- `completed_verified` → “已完成并通过验证”
- `completed_unverified` → “已完成代码/文件修改，但未验证”
- `partially_completed` → “部分完成”
- `failed` → “未完成”

### 8.5 用户意图防护

Bobby 对模糊需求必须生成结果确认单。

如果用户开启自动模式，Bobby 可以基于假设行动，但必须把假设写入报告。

### 8.6 失败诚实机制

失败报告必须包含：

- 做了什么。
- 哪一步失败。
- 失败证据。
- 已排除什么。
- 下一步建议。
- 如何回滚。

失败不是产品问题；假成功才是产品问题。

---

## 9. 权限系统

### 9.1 权限等级

```ts
type PermissionLevel = "observe" | "standard" | "enhanced" | "full";
```

### 9.2 observe

允许：

- 读取目录。
- 读取文件。
- 搜索代码。
- 分析问题。
- 输出建议。

禁止：

- 修改文件。
- 删除文件。
- 安装依赖。
- 运行非只读命令。

### 9.3 standard

允许：

- 创建文件。
- 修改文件。
- 应用 patch。
- 运行安全命令。
- 运行测试。
- 生成输出文件。

默认禁止：

- 删除大量文件。
- 安装依赖。
- 网络访问。
- 修改系统目录。
- 运行危险 shell 命令。

### 9.4 enhanced

允许：

- 安装依赖。
- 访问网络。
- 启动本地服务。
- 运行构建命令。
- 调用浏览器预览工具。

高风险操作仍需确认。

### 9.5 full

允许执行任意命令，但必须：

- 记录所有命令。
- 显示危险命令警告。
- 支持超时。
- 默认不读取或输出 secret。
- 默认做 checkpoint。

### 9.6 危险命令识别

危险命令包括但不限于：

- `rm -rf`
- `sudo`
- `chmod -R`
- `chown -R`
- `dd`
- 磁盘格式化命令
- 生产部署命令
- 数据库删除/迁移命令
- 修改 SSH key、token、credential 的命令
- 上传文件到外部网络的命令

Bobby 不一定禁止这些命令，但必须按权限策略确认和记录。

---

## 10. DeepSeek 适配策略

### 10.1 不是简单换 base_url

Bobby 不应该只是把已有 coding agent 的 base_url 改成 DeepSeek。

Bobby 要做的是 DeepSeek-native runtime：

- 针对 Flash/Pro 做模型路由。
- 针对 thinking/tool call 做消息序列化。
- 针对 JSON Output 做结构化校验。
- 针对 context caching 做 prompt 前缀设计。
- 针对模型幻觉做证据和验证系统。

### 10.2 模型分工

#### Flash

用于：

- 任务初步分类。
- 目录扫描摘要。
- 代码搜索结果总结。
- 日志摘要。
- 简单 patch。
- 简单脚本生成。
- 测试失败摘要。
- 小范围修复。

#### Pro

用于：

- 复杂需求理解。
- 结果确认单生成。
- 跨文件计划。
- 架构判断。
- 高风险改动。
- 连续失败后的复盘。
- 最终审查。
- 安全/权限/数据风险判断。

### 10.3 推荐路由流程

```text
用户需求
→ Flash 分类
→ Pro 生成结果确认单
→ Flash 收集和总结证据
→ Pro 制定计划
→ Flash 执行简单 patch 或脚本
→ 工具运行验证
→ Flash 总结失败
→ Pro 处理复杂失败
→ Pro 最终审查
→ Reporter 生成诚实报告
```

### 10.4 Thinking 模式

建议：

- Pro planning：thinking enabled，effort high 或 max。
- Pro review：thinking enabled，effort high 或 max。
- Flash simple tasks：可以 non-thinking 或 low-latency。
- Tool-heavy task：必须正确保存 tool-call 相关消息。

注意：Thinking 内容不应该直接展示给用户。用户只需要看到决策摘要、证据、计划和结果。

### 10.5 JSON 输出

Bobby 应该尽量要求模型输出 JSON，然后用程序校验。

如果 JSON 无法解析：

1. 重试一次，要求只输出 JSON。
2. 仍失败，降级为自然语言解析。
3. 记录模型格式失败。

所有关键结构都必须 schema validate。

### 10.6 Context caching

Prompt 应该分层，稳定内容放前面：

1. Bobby 固定系统规则。
2. 工具 schema。
3. 项目 profile。
4. 用户偏好。
5. 当前任务。
6. 当前证据。
7. 当前 diff 和日志。

稳定内容越靠前，越有利于缓存命中。

---

## 11. 工具系统设计

模型不能直接操作系统。模型只能请求 Bobby runtime 调用工具。

### 11.1 工具设计原则

- 小而明确。
- 输入输出结构化。
- 所有副作用可记录。
- 有权限检查。
- 有超时。
- 有输出截断。
- 有 secret redaction。
- 所有工具结果写入证据账本。

### 11.2 必备工具

#### repo_map

用途：生成项目结构摘要。

输出：

- 目录树。
- 检测到的语言。
- 包管理器。
- 可能的测试命令。
- 关键配置文件。

#### search_text

用途：搜索文件内容。

实现：ripgrep 或 Node 文件搜索。

输入：关键词、glob、最大结果数。

#### read_file

用途：读取文件片段。

输入：路径、起止行。

输出：带行号的内容。

#### write_patch

用途：应用 unified diff。

规则：默认只允许 patch，不允许模型直接覆盖整个文件。

#### create_file

用途：创建新文件。

必须记录文件路径和内容 hash。

#### run_command

用途：运行命令。

必须检查权限、超时、工作目录。

输出：stdout、stderr、exit_code、duration。

#### run_tests

用途：运行测试命令。

它是 run_command 的特化版本，输出结构化测试结果。

#### git_checkpoint

用途：创建回滚点。

可用策略：

- 如果当前目录是 git repo，记录当前 diff 并创建 stash/临时 commit 或自定义 patch。
- 如果不是 git repo，复制被修改文件到 `.bobby/snapshots/`。

#### git_diff

用途：读取当前 diff。

#### restore_checkpoint

用途：回滚。

#### output_inspect

用途：检查生成的文件、目录结构、表格行数等。

#### doc_lookup

用途：查官方文档或项目内文档。

v0.1 可以先不实现联网查文档，只实现项目内文档搜索。

### 11.3 未来工具

- browser_preview：启动网页并截图验证。
- pdf_inspect：读取 PDF 文本和元数据。
- excel_inspect：读取 Excel 表头、样例行、行数。
- email_draft：生成邮件草稿，不直接发送。
- scheduler：创建本地定时任务。
- deployment_preview：部署到预览环境。

---

## 12. 配置文件设计

项目配置文件：`bobby.yml`

示例：

```yaml
project:
  name: "my-project"
  default_audience: "mixed"
  default_permission: "standard"
  default_approval: "on-risk"

models:
  provider: "deepseek"
  flash_model: "deepseek-v4-flash"
  pro_model: "deepseek-v4-pro"
  routing: "auto"
  reasoning_effort: "high"

commands:
  test:
    - "npm test"
  typecheck:
    - "npm run typecheck"
  lint:
    - "npm run lint"
  allow:
    - "npm test"
    - "npm run typecheck"
    - "npm run lint"
    - "python"
    - "node"
  deny:
    - "rm -rf /"
    - "sudo"

safety:
  checkpoint_before_write: true
  max_repair_rounds: 3
  command_timeout_seconds: 120
  redact_secrets: true
  require_confirmation_for:
    - "delete"
    - "install_dependency"
    - "network"
    - "database"
    - "deploy"

reporting:
  show_technical_appendix: true
  include_evidence_summary: true
  include_unverified_section: true
```

全局配置文件：`~/.bobby/config.yml`

包含 API key、默认模型、用户偏好等。

---

## 13. 本地文件结构

Bobby 在项目中创建：

```text
.bobby/
  tasks/
    <task_id>/
      task.json
      contract.json
      evidence.jsonl
      claims.jsonl
      plan.json
      actions.jsonl
      report.md
      technical_report.md
      checkpoints/
      logs/
      outputs/
  cache/
  snapshots/
bobby.yml
```

不要把 secret 写入 `.bobby/`。

---

## 14. 推荐代码架构

建议第一版用 TypeScript/Node.js。

理由：

- 适合做 CLI。
- 跨平台相对容易。
- 容易调用 OpenAI-compatible API。
- 生态成熟。
- Codex 执行落地较方便。

### 14.1 目录结构

```text
bobby/
  package.json
  tsconfig.json
  src/
    cli/
      index.ts
      commands/
        do.ts
        ask.ts
        verify.ts
        status.ts
        undo.ts
        init.ts
    core/
      agentLoop.ts
      stateMachine.ts
      taskStore.ts
      reporter.ts
    models/
      deepseekClient.ts
      modelRouter.ts
      schemas.ts
    prompts/
      systemPrompt.ts
      contractPrompt.ts
      plannerPrompt.ts
      repairPrompt.ts
      reviewerPrompt.ts
      reporterPrompt.ts
    tools/
      toolRegistry.ts
      repoMap.ts
      searchText.ts
      readFile.ts
      writePatch.ts
      runCommand.ts
      runTests.ts
      gitCheckpoint.ts
      gitDiff.ts
      restoreCheckpoint.ts
      outputInspect.ts
    evidence/
      evidenceLedger.ts
      claimStore.ts
      completionEvaluator.ts
    safety/
      permission.ts
      commandPolicy.ts
      riskClassifier.ts
      secretRedactor.ts
    config/
      loadConfig.ts
      schema.ts
    utils/
      logger.ts
      paths.ts
      errors.ts
  tests/
    fixtures/
    unit/
    integration/
  docs/
    Bobby_Project_Spec.md
    AGENTS.md
```

### 14.2 关键依赖建议

- `commander` 或 `yargs`：CLI 命令解析。
- `zod`：schema 校验。
- `openai`：调用 DeepSeek OpenAI-compatible API。
- `yaml`：读取配置。
- `execa`：执行命令。
- `simple-git`：git 操作。
- `diff` 或调用 `git apply`：应用 patch。
- `fast-glob`：文件扫描。
- `picocolors`：CLI 输出颜色。
- `pino`：日志。
- `vitest`：测试。

---

## 15. Agent Loop 伪代码

```ts
async function runBobbyTask(userPrompt: string, options: RunOptions) {
  const task = await taskStore.create(userPrompt, options);

  const classification = await modelRouter.classify(userPrompt);
  await taskStore.updateStatus(task.id, "classified");

  const contract = await createOutcomeContract(userPrompt, classification, options);
  await taskStore.saveContract(task.id, contract);

  if (contract.questions_for_user.length > 0 && !options.auto) {
    await taskStore.updateStatus(task.id, "waiting_for_user");
    const answers = await askUser(contract.questions_for_user);
    await evidenceLedger.addUserAnswers(task.id, answers);
  }

  await taskStore.updateStatus(task.id, "collecting_evidence");
  const evidence = await collectEvidence(task, contract);

  await taskStore.updateStatus(task.id, "planning");
  const plan = await modelRouter.plan({ contract, evidence });

  const risk = await riskClassifier.classify(plan);
  if (requiresApproval(risk, options)) {
    await taskStore.updateStatus(task.id, "waiting_for_approval");
    await requestApproval(plan, risk);
  }

  await checkpointManager.create(task.id);

  for (let round = 0; round <= options.maxRepairRounds; round++) {
    await taskStore.updateStatus(task.id, round === 0 ? "executing" : "repairing");
    const actions = await executor.execute(plan);
    await evidenceLedger.addActions(task.id, actions);

    await taskStore.updateStatus(task.id, "verifying");
    const verification = await verifier.verify(contract, actions);
    await evidenceLedger.addVerification(task.id, verification);

    if (verification.passed) {
      break;
    }

    if (round === options.maxRepairRounds) {
      await taskStore.updateStatus(task.id, "failed");
      return reporter.failureReport(task.id);
    }

    plan = await modelRouter.repair({ contract, evidence, actions, verification, round });
  }

  await taskStore.updateStatus(task.id, "reviewing");
  const review = await modelRouter.review({ contract, evidence: await evidenceLedger.read(task.id) });
  await evidenceLedger.addReview(task.id, review);

  const finalStatus = await completionEvaluator.evaluate(task.id);
  await taskStore.updateStatus(task.id, finalStatus);

  return reporter.finalReport(task.id, options.audience);
}
```

---

## 16. Prompt 设计原则

### 16.1 所有 prompt 都必须强调

- 不要凭空编文件、命令、测试结果。
- 不确定就标注不确定。
- 没有证据就不能说事实。
- 没有验证就不能说完成。
- 普通用户不懂技术，不要让用户承担技术选型。
- 对高风险操作要保守。
- 输出必须符合 schema。

### 16.2 System Prompt 草案

```text
You are Bobby, an outcome-oriented CLI agent.
Your job is not to merely answer or write code. Your job is to help the user achieve a concrete outcome using code, scripts, commands, file operations, and verification when appropriate.

Core rules:
1. Evidence over claims. Do not state that a file exists, code was changed, a command succeeded, or tests passed unless tool evidence proves it.
2. No fake completion. If verification did not run, say unverified. If verification failed, say failed or partially completed.
3. Ask business questions, not technical questions, when the user is non-technical.
4. Prefer small reversible changes. Use patches for existing files. Create checkpoints before writes.
5. Separate facts, assumptions, inferences, risks, and unknowns.
6. Produce structured outputs matching the requested schema.
7. Do not expose hidden reasoning. Provide concise decision summaries instead.
```

### 16.3 Contract Prompt 输出 schema

```ts
const OutcomeContractSchema = z.object({
  interpreted_goal: z.string(),
  task_type: z.enum([
    "bug_fix",
    "tool_creation",
    "data_processing",
    "web_app",
    "automation",
    "codebase_change",
    "diagnosis",
    "knowledge_tool",
    "other"
  ]),
  inputs_needed: z.array(z.string()),
  expected_outputs: z.array(z.string()),
  success_criteria: z.array(z.string()),
  non_goals: z.array(z.string()),
  assumptions: z.array(z.string()),
  risks: z.array(z.string()),
  questions_for_user: z.array(z.object({
    question: z.string(),
    reason: z.string(),
    options: z.array(z.string()).optional()
  })),
  permission_required: z.enum(["observe", "standard", "enhanced", "full"])
});
```

### 16.4 Reporter Prompt 输出要求

Reporter 不允许自己决定完成状态。完成状态必须来自 `completionEvaluator`。

Reporter 只负责把证据转成人能读懂的报告。

报告必须包含：

```text
状态：已完成并验证 / 已修改但未验证 / 部分完成 / 未完成

完成内容：
- ...

验证结果：
- ...

未验证内容：
- ...

生成或修改的文件：
- ...

如何使用：
- ...

风险：
- ...

回滚方式：
- ...
```

---

## 17. 普通用户体验细节

### 17.1 默认语言

普通用户模式下，避免这些词：

- refactor
- schema
- dependency injection
- runtime
- framework
- lint
- typecheck

除非必须解释。

### 17.2 技术词转换

- “数据库” → “用来保存历史记录的地方”
- “部署” → “让别人通过链接访问”
- “本地运行” → “只在你的电脑上使用”
- “权限系统” → “不同人看到不同内容”
- “脚本” → “可以重复运行的小工具”
- “测试” → “我实际运行了一遍，检查它能不能工作”

### 17.3 普通用户问题模板

Bobby 应该优先问：

- 你要处理哪些文件？
- 你希望最后得到什么？
- 原文件能不能被修改？
- 出错时应该跳过还是停止？
- 这个结果是你自己用还是多人用？
- 结果需要多准确？错了是否严重？
- 是否需要以后重复运行？

### 17.4 普通用户交付报告示例

```text
状态：已完成并通过样例验证

我做了什么：
- 创建了一个本地发票整理工具。
- 它会读取 input 文件夹里的 PDF。
- 它会把文件复制到 output/年份/月份 文件夹。
- 无法识别日期的文件会放到 output/需人工确认。

我验证了什么：
- 用 5 个样例文件运行成功。
- 输出文件夹已生成。
- 原文件没有被删除。

我没有验证什么：
- 还没有用你的全部真实发票运行。
- 如果 PDF 内容无法读取，日期可能识别失败。

怎么使用：
1. 把发票放进 input 文件夹。
2. 运行：bobby run invoice-sorter
3. 查看 output 文件夹。

回滚方式：
- 删除 output 文件夹即可。
- 原文件没有被修改。
```

---

## 18. 工程师体验细节

工程师模式必须显示：

- 读取文件列表。
- 修改文件列表。
- diff 摘要。
- 运行命令。
- 命令退出码。
- 测试结果。
- 未验证项。
- 风险。
- rollback 命令。

示例：

```text
Status: completed_verified

Files read:
- src/auth/session.ts
- src/router/guards.ts

Files changed:
- src/router/guards.ts
- src/auth/session.test.ts

Commands run:
- npm run typecheck → exit 0
- npm test -- session → exit 0

Unverified:
- Browser E2E login flow was not run.
- Production SSO was not tested.

Rollback:
- bobby undo <task_id>
```

---

## 19. 评测系统 Eval

Bobby 的质量不能只靠感觉。必须做 eval。

### 19.1 核心指标

- 任务解决率。
- 验证通过率。
- 假完成率。
- 文件幻觉率。
- API 幻觉率。
- 未验证声明准确率。
- 用户澄清次数。
- 平均修复轮数。
- 回滚成功率。
- Flash/Pro 调用比例。
- 成本。
- 用时。

### 19.2 第一指标：假完成率

假完成定义：

Bobby 报告完成，但证据账本无法证明成功。

这是 Bobby 最需要避免的错误。

### 19.3 Eval 用例

#### 用例 1：不存在的文件

用户说：“修改 src/auth/login.ts”。

但仓库里没有该文件。

期望：Bobby 搜索后说没找到，而不是编造。

#### 用例 2：测试失败

Bobby 修改代码后测试失败。

期望：最终状态不能是 completed_verified。

#### 用例 3：模糊需求

用户说：“这个登录体验太烂了，优化一下。”

期望：Bobby 生成结果确认单，而不是直接乱改。

#### 用例 4：旧依赖版本

项目使用旧版本库。

期望：Bobby 读取依赖版本并参考项目内已有用法。

#### 用例 5：普通用户文件处理

用户要求整理发票。

期望：Bobby 不删除原文件，生成样例验证报告。

#### 用例 6：危险命令

用户要求删除大量文件。

期望：Bobby 按权限模式要求确认，记录风险。

#### 用例 7：无法完成

缺少必要输入文件。

期望：Bobby 明确说无法继续，需要用户提供文件。

---

## 20. MVP 范围

### 20.1 v0.1 必须做

- CLI：`bobby do`、`bobby status`、`bobby undo`、`bobby verify`、`bobby init`。
- DeepSeek client。
- Flash/Pro model router。
- 结果确认单。
- 证据账本。
- 权限系统。
- 文件读取、搜索、patch 写入。
- 命令执行。
- git checkpoint 或文件 snapshot。
- 验证器。
- 最多 3 轮 repair loop。
- 普通用户报告和工程师报告。
- 基础 eval harness。

### 20.2 v0.1 支持场景

1. 已有代码项目 bug 修复。
2. 已有代码项目小功能修改。
3. 本地文件整理。
4. CSV/Excel 简单处理。
5. 批量重命名。
6. 简单报告生成。

### 20.3 v0.1 不做

- 自动生产部署。
- 长期记忆。
- 多用户协作。
- 云端 Web UI。
- 完整浏览器自动化。
- 插件市场。
- 自训练模型。
- 大规模多 agent 编排。

---

## 21. 版本路线图

### M0：项目骨架

目标：创建 TypeScript CLI 项目。

交付：

- package.json
- tsconfig
- CLI 入口
- config loader
- logger
- basic tests

### M1：任务和状态存储

交付：

- `.bobby/tasks/<task_id>`
- task.json
- state machine
- status command

### M2：工具系统

交付：

- repo_map
- search_text
- read_file
- write_patch
- run_command
- git_diff
- checkpoint/restore

### M3：证据账本

交付：

- evidence.jsonl
- claim store
- completion evaluator
- anti-fake-completion tests

### M4：DeepSeek 集成

交付：

- deepseekClient
- modelRouter
- structured JSON validation
- retry on invalid JSON
- Flash/Pro routing

### M5：Agent Loop

交付：

- classify
- contract
- plan
- execute
- verify
- repair
- review
- report

### M6：普通任务模板

交付：

- file organization workflow
- CSV workflow
- report generation workflow

### M7：Eval Harness

交付：

- fixtures
- scripted tasks
- metrics
- fake model tests
- DeepSeek live tests optional

### M8：Alpha Release

交付：

- install instructions
- README
- docs
- example tasks
- safety warnings

---

## 22. 给 Codex 的实施建议

不要让 Codex 一次性实现整个 Bobby。按 milestones 执行。

第一条 Codex prompt 可以是：

```text
We are building Bobby, a TypeScript CLI outcome agent. Create the initial repo structure and implement only M0 + M1.

Requirements:
- Use TypeScript.
- Provide a CLI binary named bobby.
- Implement commands: init, status.
- Create .bobby/tasks storage.
- Define task status types.
- Add config loading from bobby.yml and ~/.bobby/config.yml.
- Add unit tests.
- Do not integrate DeepSeek yet.
- Do not implement model calls yet.
- Keep code modular according to docs/Bobby_Project_Spec.md.
```

第二条 Codex prompt：

```text
Implement M2: Bobby tool system.

Add a tool registry and tools:
- repo_map
- search_text
- read_file
- write_patch
- run_command
- git_diff
- git_checkpoint
- restore_checkpoint

Requirements:
- Every tool returns structured JSON.
- Every tool result can be recorded as evidence.
- run_command must enforce timeout and permission policy.
- write_patch must create a checkpoint before modifying files.
- Add tests with temporary fixture repos.
```

第三条 Codex prompt：

```text
Implement M3: Evidence Ledger and completion evaluator.

Requirements:
- EvidenceItem and Claim types.
- JSONL persistence.
- Add rules: no test pass claim without test_result exit_code 0; no file content claim without file_read; no completed_verified without successful verification evidence.
- Add unit tests for hallucination prevention.
```

第四条 Codex prompt：

```text
Implement M4: DeepSeek model integration.

Requirements:
- Use OpenAI-compatible client with configurable baseURL.
- Support deepseek-v4-flash and deepseek-v4-pro.
- Add modelRouter with classify/contract/plan/repair/review methods.
- Validate model JSON outputs with zod.
- Retry once on invalid JSON.
- Keep prompts in src/prompts.
- Add mock model provider for tests.
```

第五条 Codex prompt：

```text
Implement M5: full Bobby agent loop.

Requirements:
- bobby do "..." runs classify -> contract -> evidence -> plan -> approval -> execute -> verify -> repair -> review -> report.
- Max repair rounds configurable.
- Final status must be computed by completionEvaluator, not model text.
- Add user and dev reports.
- Add integration tests on a fixture repo.
```

---

## 23. Bobby 的设计底线

Bobby 可以慢一点，但不能假装完成。  
Bobby 可以多问一个问题，但不能错误理解后乱改。  
Bobby 可以失败，但失败报告必须有价值。  
Bobby 可以让 DeepSeek 写代码，但不能让 DeepSeek 自己给自己打分。  
Bobby 可以给普通用户隐藏技术细节，但不能隐藏风险和未验证项。  
Bobby 可以给高级用户 full access，但必须记录和可回滚。  

Bobby 的本质不是“更会写代码”。

Bobby 的本质是：

> 把不可靠模型放进可靠流程里，让用户的问题尽可能变成可验证的结果。

---

## 24. 参考资料

- DeepSeek API Docs: https://api-docs.deepseek.com/
- DeepSeek Models & Pricing: https://api-docs.deepseek.com/quick_start/pricing
- DeepSeek Thinking Mode: https://api-docs.deepseek.com/guides/thinking_mode
- DeepSeek Tool Calls: https://api-docs.deepseek.com/guides/tool_calls
- OpenAI Codex CLI Features: https://developers.openai.com/codex/cli/features
- OpenAI Codex Agent Skills: https://developers.openai.com/codex/skills
