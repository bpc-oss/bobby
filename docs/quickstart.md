# 快速上手

本文档面向本地开发者，目标是“让 Bobby 可运行并能看到可复核输出”。

## 1. 前置条件

1. 安装 Node.js（建议 20+）。
2. 在仓库根目录执行依赖安装：

```bash
cd E:/ai-files/Bobby
npm exec pnpm@9 -- install
```

3. 准备 DeepSeek Key（**不要在文档中写真实 Key**）。

## 2. 提供用户密钥（你自己的）

Bobby 从本机读取 DeepSeek Key：`~/.bobby/key`。

示例（请改成你自己的 key）：

```powershell
New-Item -ItemType Directory -Force -Path "$HOME/.bobby"
Set-Content "$HOME/.bobby/key" "<你的 DeepSeek Key>" -Encoding utf8
```

> 仅作为演示，不要把真实 Key 发布到任何输出里。

## 3. 先跑能力探针（`bobby probe`）

```bash
npm exec pnpm@9 -- -r build
node packages/cli/dist/index.js probe
```

该命令会在 `~/.bobby/capabilities.json` 写入能力报告，用于后续任务运行。

## 4. CLI 路径

```bash
node packages/cli/dist/index.js run "把 README.md 内容翻译成英文"
```

CLI 会返回任务日志和证据；若无可验证证据不会无条件宣告完成。

如果你已全局安装 `bobby`，也可以直接使用：

```bash
bobby probe
bobby run "把 README.md 内容翻译成英文"
```

## 5. GUI 路径

GUI 与 CLI 共用同一内核和配置，开发路径如下：

```bash
npm exec pnpm@9 -- --filter @bobby/gui build
npm exec pnpm@9 -- --filter @bobby/gui exec electron .
```

界面启动后会读取同一套本地文件：`~/.bobby/key`、`~/.bobby/capabilities.json`。

## 6. 重要边界（避免误读）

- 本文不表示已完成生产发布级 E2E 验证。
- 未声明的场景（如复杂多平台打包闭环）不应提前写成既定事实。
- 不默认开启遥测；当前示例未假设额外遥测上报。
