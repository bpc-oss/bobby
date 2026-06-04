# Bobby

**Bobby = “不撒谎”的编码 agent（DeepSeek V4 Flash/Pro native）。**

## 卖点（边界先行，不空口承诺）

- **不撒谎不是口号，是流程。**
  Bobby 不以“我做完了”作为最终结论。任务完成需要有机器可复核的证据记录（如 `command_output`、`file_exists`、`file_diff` 等），否则视为未完成。
- **出题人 != 阅卷人。**
  任务执行（`runner`）与复核（`grader`）模型分离：默认使用 Flash 作为执行主模型、Pro 作为复核/审查模型，避免“自己给自己打分”。
- **本地先运行，不依赖云端编排。**
  你在本地启动 Bobby，仓库中的代码与配置共同决定行为。除了调用 DeepSeek API 外，不默认上报遥测。
- **你自己的密钥。**
  DeepSeek Key 由用户本地提供（`~/.bobby/key`），项目默认不替你注入默认密钥。
- **默认零遥测。**
  默认设置 `telemetryEnabled: false`，没有默认开启遥测上报通道。

## 关键声明（请按证据理解）

- 许可证：**Apache-2.0**
- 实现模式：CLI + Electron GUI（同一内核）
- 默认流程：`bobby probe` → `~/.bobby/capabilities.json` → 任务执行
- 不承诺未验证能力：README 中不展示未经过代码路径验证的“实时发布/生产级 SLA”字样

## 快速上手

详见 [docs/quickstart.md](./docs/quickstart.md)

## 参考

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
