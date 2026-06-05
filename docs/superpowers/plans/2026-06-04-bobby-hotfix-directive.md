# Bobby — 实测崩溃/胡乱干活 热修指令（基于真实运行 trace 的根因调查）

> **For chief (GPT-5.5):** 按 `execution-protocol` 执行；每个修复**先写失败测试复现 → 只修根因 → 端到端验收**。
> 本指令的根因**已从源码逐一坐实**（非猜测）。证据见每条「根因」。

## ✅ 进度更新（P0-1、P0-2 已由 Claude 直接修复并验证）
> **总工程师从 P0-3 开始**，不要重做 1/2。
- **P0-1 exec 失败转证据** ✅：`packages/kernel/src/hands/tools/exec.ts` 的 `spawnCommand` 加 try/catch；spawn 失败（ENOENT 等）→ `command_output{ exitCode:127, spawnError }`，**绝不再抛**。
- **P0-2 错误边界** ✅：`packages/kernel/src/host/kernel-host.ts` 的 `handleStartTask`(TASK 分支) try/catch → emit `error` + `final_result:failed`；`packages/cli/src/interactive.ts` 的 `onSubmit` 兜底。
- **验证证据**：新增复现测试 RED→GREEN；vitest **kernel 233/233、cli 66/66** 全过；`tsc --noEmit` kernel/cli **exit 0**。
- ⚠️ **这些改动目前在工作区（尚未提交）**——开工前务必先提交/纳入基线，避免被覆盖或与新工作冲突。
- **仍待办（你的活）**：**P0-3（退化输入不建项目 + 接 `clarify`）→ P0-4（渲染净化）→ P1-1（跨平台命令）→（P1-2 verdict 复现）→ P2（CLI 手感）**。

## Phase 1 根因结论（已确认）
| # | 现象（来自真实 trace） | 根因（文件 + 机制） | 置信 |
|---|---|---|---|
| 1 | `spawn test ENOENT` 把整个 CLI 崩到 PowerShell（raw Node stack） | `hands/tools/exec.ts`：`waitForProcessClose` 用 `child.once('error', reject)` → `run()` **无 try/catch** → 异常一路冒泡。**违反 M3「exec 失败必须变证据」** | 高 |
| 2 | 输入 `a` → 拆 4 步「建一个接受 'a' 的软件项目」 | `brain/triage.ts` `classifyIntent('a')` 走完启发式落到 **`return 'TASK'`（默认）**；`brain/clarify.ts` `needsClarification` 是**死代码（全仓无人 import）**；`TaskContractSchema` 强制 `acceptanceCriteria≥1` → grader 被迫为 'a' 编目标+AC → planner 编步骤。**管道结构上无法表达「这不是任务」** | 高 |
| 3 | 生成 `test a = a`（unix 内建）→ Windows ENOENT | runner/EXEC 提示词未注入 OS、未禁 unix 内建 | 高 |
| 4 | exit 0 / stdout `True` 却 verdict=fail | 出现在 #2 伪造出的「Intent parsing for input 'a'」任务上，AC 未知；**疑为 #2 下游**（伪任务无真实 oracle） | 低（需复现） |
| 5 | 输出乱码（`in <module>aceback`）、状态像纯文本、崩溃 raw stack | Ink 已接（`interactive.ts` `runInkInteractive` 渲染 `<App/>`），但 ① **无错误边界**：`onSubmit` 的 `await host.send` 不 catch、`KernelHost.handleStartTask` 的 `await orchestrator.startTask` 直接抛 → 崩；② 命令 stdout（含 `\r`/多行 traceback）**未净化**就进 Ink 帧 → 帧错乱 | 高 |

---

## P0-1：exec 失败必须变证据，绝不抛（修崩溃的根）
- **先写失败测试**：`ExecTool.run({ cmd: '__no_such_binary__' }, ctx)` 应 **resolve** 出 `command_output` evidence（`exitCode!==0`，`stderr` 含错误文案），**绝不 throw**。
- **修根因**：`run()` 把 `spawnCommand` 包进 try/catch；catch → 返回 `command_output` 证据 `{ cmd, args, exitCode: 127, stdout: '', stderr: String(err), spawnError: true }`。（`waitForProcessClose` 的 reject 改为被 `run()` 接住转证据。）
- **护栏**：不许在上层 swallow；失败要成为闸门可见的证据（verdict fail → 触发重试/升级）。

## P0-2：CLI/内核错误边界 → 永不裸崩
- **先写失败测试**：① `KernelHost`：注入一个 `startTask` 会抛的 orchestrator/model → `send({startTask})` **不 reject**，而是 `emit({type:'error'})` + `emit({type:'final_result', status:'failed'})`。② interactive：`onSubmit` 内 `host.send` 抛错 → 渲染 error、进程不退出。
- **修根因**：(a) `KernelHost.handleStartTask` 包 try/catch → 转 `error` + `final_result:failed` 事件；(b) `interactive.ts` `runInkInteractive` 的 `onSubmit` 包 try/catch，错误交给 App 渲染。
- **护栏**：任何内核异常都渲染成**错误卡**，绝不把 raw stack 崩到终端。

## P0-3：退化输入不许变项目（修「输入 a 建了个项目」）
- **先写失败测试**：
  - triage：`classifyIntent('a')` / `''` / `'。'` / `'aa'` **不得返回 `TASK`**（应为新增 `'UNCLEAR'`）。
  - host：输入 `'a'` → **不产生** `plan_ready`/`step_started`，应 `emit` 一个澄清式 `direct_answer`。
  - clarify 接线：给一个退化 contract（`needsClarification().should===true`）→ orchestrator/host **不调用 `planTask`**。
- **修根因（三处）**：
  1. `triage.ts` 加**退化守卫**：trim 为空 / 单 token / 长度 < 阈值 / 无可执行内容 → 返回 `'UNCLEAR'`；`KernelHost` 对 `UNCLEAR` 发澄清问句（"你想让我具体做什么？"），不进重型循环。
  2. **把 `needsClarification` 接进流程**：`captureIntent` 之后若 `should===true` → emit 澄清 `direct_answer` 并 `return`，**不 `planTask`**。
  3. （可选）放宽结构强制：允许 grader 显式标注「非任务」。最简做法靠上面的澄清闸即可。
- **护栏**：含糊但**确有动作意图**的仍走 TASK；只拦真正退化/无意图输入。改文件请求绝不借澄清快路绕过完成闸门。

## P0-4：渲染净化（修 traceback 乱码）
- **先写失败测试**：`MessageStream`/`EvidenceLine` 渲染含 `\r`、ANSI、超长的 stdout → 输出被净化（去 `\r`、剥 ANSI、按行宽/行数截断，长输出折叠）。
- **修根因**：渲染命令输出前统一 `sanitize()`（strip `\r` 与 ESC 序列、clamp、折叠）。

## P1-1：跨平台命令（修 unix `test` 在 Windows ENOENT）
- **先写失败测试**：在 `process.platform==='win32'` 下组装的 runner 系统提示**包含**「禁用 unix 内建（test/rm/cat/ls/touch…）+ 断言优先用 node/python 或 write_file/file_exists」。
- **修根因**：runner/EXEC 提示词注入 `os/platform` 与上述规则（PORT-A 的 Flash 规则里补）。
- 注：P0-1 修好后这只是「一次失败→重试」，非致命，但要修以提质。

## P1-2：verdict 不一致 —— **先复现再修**
- **先写复现测试**：构造该 AC + `command_output(exitCode:0, stdout:'True')` 喂 `VerificationEngine`，断言期望裁决，锁定到底是哪只 oracle、为何 fail。
- **确认根因前不许盲改 oracle**。P0-3 修好后（不再伪造无 oracle 的任务）多半自然消失；若仍存在再按复现结果修。

## P2：CLI 手感对齐 Claude Code（迭代，非崩溃）
- Ink 组件已在，保真度不足。按 `cli-claude-code-directive` 逐项打磨：流式、工具行内折叠、内联权限、计划模式、Esc 中断、状态行、证据折叠。**最关键的已并入 P0-2/P0-4：异常成错误卡、输出净化。**

---

## ⚠️ 这批 bug 的元教训（总工程师必看）
**组件单测全过，但一集成就崩**：`clarify` 是死代码、exec「失败转证据」没测、无错误边界没测、triage 没测退化输入 `'a'`。
→ 这正是 **"蒙混过关" 在建造过程里的复现**：工人交了"绿测试"，但只是 isolation 单测，没有端到端集成测试。
→ **验收闸门必须升级到集成层**：每个 P0 都要配**真实端到端测试**（真跑：退化输入 `'a'`、不存在的命令、会抛的步骤），断言「不崩 / 不建伪项目 / 错误成证据或错误卡」。光靠隔离单测的"绿"不算完成。

## 修复顺序与验收
顺序：**P0-1 → P0-2 → P0-3 → P0-4 → P1-1 →（P1-2 复现）→ P2**。
验收：`pnpm -r test` 全绿 + 新增端到端集成测试；手测——输入 `a` → 澄清（不建项目）；跑不存在的命令 → 错误卡 + 证据（不崩）；python 报错 → 整洁渲染；真实任务正常跑完并产证据。
