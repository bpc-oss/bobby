# CLI-PARITY-0

## 目标

Bobby 的 CLI 交互需要在以下用户可观察输出层面与 Claude Code 的最小交互价值（Parity 0）接近一致。

## 观察边界（用户可见输出）

只约束 CLI 表示层与命令行文本行为：

1. `bobby run a` / 其他长度不明输入
   - 输出应指向澄清问题（中文提示）：`你想让我具体做什么？请给我一个明确任务或要修改的文件。`
   - 不应进入计划/步骤/证据流程（至少不打印 `[plan]` / `[step]` / `[evidence]`）
   - 不应创建项目文件（如默认演示文件）

2. 缺失密钥或能力探测结果提示
   - 输出应明确显示 `DeepSeek key: missing` 与 `Capability probe: missing`
   - 应给出下一步操作（如 `1. bobby login`, `2. bobby`）

3. 空状态 slash 命令
   - `/cost`、`/agents`、`/undo`、`/resume` 等命令不应出现 `not wired yet`
   - 在空状态应输出对应固定短句（例如 `cost: no usage data yet`, `agents: no agents`, `undo: no snapshots available`）

4. 未知 slash 不得提交任务
   - `/not-real args` 等未注册命令应输出：
     - `unknown command: /not-real args`
     - `commands: /help /clear /status /probe /cost /undo /agents /resume /exit`
   - 不应将该交互作为任务提交（不出现 `goal:` / `plan:` / `step:`）

## 交付范围

- 文档：本文档 + fixture 说明
- 测试：`packages/cli/tests` 下 transcript/golden 测试
- 不改系统业务逻辑；避免改内置代码

## 验收口径（每个用例）

- 通过：基于 fixture 生成实际 CLI/headless 事件输出并断言输出结构
- 允许：当前仅对上述基线场景做严格断言，不作为完整功能覆盖

## 证据规范

- 每个场景有可读文本 fixture（JSON）
- 断言仅使用真实命令执行或 headless 事件流
- 每个基线场景必须可通过真实输出验证（含退出码、日志文本、文件副作用）

### fixture 格式（tests/fixtures/interaction）

```json
{
  "id": "run-degenerate-input-no-file-creation",
  "description": "场景说明",
  "kind": "run" | "headless" | "slash",
  "argv": ["run", "a"], // 仅 kind=run
  "input": "a", // 仅 kind=headless
  "events": [ ... ], // 仅 kind=headless
  "command": {
    "name": "cost" | "agents" | "undo" | "resume", // 仅 kind=slash
    "raw": "/not-real args", // 可选，仅 kind=slash，存在时优先用于解析
    "args": []
  },
  "assertions": {
    "contains": ["必须出现的字段"],
    "notContains": ["不应出现的字段"],
    "orderedLines": ["严格顺序断言"],
    "notExist": ["文件路径（基于运行目录）"],
    "exitCode": 0
  }
}
```

### 当期基线场景映射

| 场景 | fixture |
| --- | --- |
| `a` 退化输入澄清 | `clarify-degenerate-headless.json`, `run-degenerate-no-file-creation.json` |
| 缺失 key/capabilities setup 提示 | `run-missing-key-shows-ready-steps.json` |
| slash 空状态 | `ui-slash-cost-empty.json`, `ui-slash-agents-empty.json`, `ui-slash-agents-host-empty.json`, `ui-slash-undo-host-empty.json`, `ui-slash-resume-host-empty.json` |
| slash 未知命令 | `ui-slash-unknown-no-task.json` |
