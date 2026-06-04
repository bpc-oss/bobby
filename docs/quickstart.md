# 快速上手

本文档面向本地开发者，目标是让 Bobby 可运行并能看到可复核输出。

## 1. 前置条件

1. 安装 Node.js（建议 20+）
2. 在仓库根目录安装依赖：

```bash
cd E:/ai-files/Bobby
npm exec pnpm@9 -- install
```

3. 准备 DeepSeek Key（你的密钥）：

```powershell
New-Item -ItemType Directory -Force -Path "$HOME/.bobby"
Set-Content "$HOME/.bobby/key" "<你的 DeepSeek Key>" -Encoding utf8
```

> 仅示例，不要在任何输出里泄露真实 Key。

## 2. 先做能力探测（`bobby probe`）

源码环境下必须先做全工作区构建，再运行探测：

```bash
npm exec pnpm@9 -- -r build
node packages/cli/dist/index.js probe
```

`bobby probe` 会将能力报告写入 `~/.bobby/capabilities.json`，用于后续任务执行。

## 3. CLI 运行（源码安装 / 本地构建）

```bash
npm exec pnpm@9 -- -r build
node packages/cli/dist/index.js run "把 README.md 内容翻译成英文"
```

CLI 返回任务日志与证据文件；没有可验证证据不应声明“已完成”。

你也可以本地做命令级安装（不走 npm registry）：

```bash
npm exec pnpm@9 -- --filter @bobby/cli link --global
bobby run "把 README.md 内容翻译成英文"
```

如果你未执行 `link --global`，请直接使用 `node packages/cli/dist/index.js ...`。

## 4. GUI 路径

- 下载 GitHub Release 的 GUI 安装包（推荐）
- 或本地构建后运行：

```bash
npm exec pnpm@9 -- --filter @bobby/gui build
npm exec pnpm@9 -- --filter @bobby/gui exec electron .
```

GUI 与 CLI 共用同一内核与配置。启动后会读取 `~/.bobby/key` 与 `~/.bobby/capabilities.json`。

## 5. 边界说明（避免误读）

- 本仓库按 source-install 路径说明运行；当前不宣称 `npm i -g @bobby/cli` 可用。
- `bobby probe` 和真实任务执行边界均由你的 `~/.bobby/key` 与能力报告决定。
