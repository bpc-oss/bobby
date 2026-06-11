# Bobby

**Bobby = “不撒谎”的代码 agent（DeepSeek V4 Flash/Pro native）。**

## 里程碑承诺（边界优先，不空口承诺）

- **不撒谎不是口号，是流程。**
  Bobby 不以“我做完了”作为最终结论。任务完成必须有可复核证据（如 `command_output`、`file_exists`、`file_diff` 等），否则视为未完成。
- **执行者与复核者分离。**
  默认执行使用 Flash，复核使用 Pro，避免“自己给自己打分”。
- **本地先运行，不依赖云端编排。**
  你在本地启动 Bobby，仓库中的代码与配置共同决定行为；除调用 DeepSeek API 外，不默认上报遥测。
- **你的密钥由你持有。**
  DeepSeek Key 由本地 `~/.bobby/key` 提供，项目不替你注入默认密钥。
- **默认零遥测。**
  默认设置 `telemetryEnabled: false`，未默认开启上报通道。

## 当前发布目标（v0.1.0）

- 本版本发布目标改为 **GitHub Release-only + source-install**。
- **不再将 `npm i -g @bobby/cli` 作为可用交付路径。**
- Tag 触发 release CI，执行：
  - `pnpm install --frozen-lockfile`
  - `pnpm lint`
  - `pnpm -r build`
  - `pnpm -r test`
- GUI 仍通过 electron-builder 发布三端安装包到 GitHub Release；CLI 通过源码安装/本地构建运行。

## 关键声明（请按证据理解）

- 开源协议：**Apache-2.0**
- 实现形态：CLI + Electron GUI（同源）
- 默认流程：`bobby probe` → `~/.bobby/capabilities.json` → 任务执行
- 不背书未验证能力：README 不承诺未验证代码路径的“实时发布 / 生产级 SLA”。

## 快速上手

见 [docs/quickstart.md](./docs/quickstart.md)

## 参考

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)

Bobby desktop parity is under verification.
