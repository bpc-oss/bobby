# M8 开源上线 Implementation Plan（Bobby v1）

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` 或 `superpowers:executing-plans`
> 总纲：`2026-06-04-bobby-v1-master-plan.md`
> 前置：M0–M7 完成。

**Goal:** 将 Bobby 的发布目标改为 **GitHub Release-only + source-install**，不再以 `@bobby/shared`、`@bobby/kernel`、`@bobby/cli` 的 npm 发行为 v0.1.0 交付条件。GUI 继续走 electron-builder + GitHub Release 三端桌面包发布，文档与验收口径统一到可验证边界。

**Architecture:** CLI 改为源码交付（clone/repo + workspace 全量 build 后直接运行），GUI 继续 electron-builder 发布三端安装包；发布 CI 改为 verify + desktop 两阶段，不依赖 npm registry 与 npm token。

**Tech Stack:** pnpm workspace / GitHub Actions / electron-builder / GitHub Release / source install。

**历史原因说明:** 当前无法稳定访问或注册 npmjs @bobby scope，npm 发布会受外部账号门槛影响。为保证 v0.1.0 可交付性，发布目标改为 GitHub Release-only/source-install，不再将 `pnpm publish` 成功或 `NPM_TOKEN` 可用作为完成条件。

## 任务范围（计划更新）

- `README.md`
- `docs/quickstart.md`
- `.github/workflows/release.yml`

## Task 1: 发布目标与文档更新

- [x] 明确 v0.1.0 改为 **GitHub Release-only + source-install**。
- [x] 明确 CLI 交付不再是 `npm i -g @bobby/cli`，改为源码安装/本地构建运行。
- [x] 明确说明 `@bobby/shared`、`@bobby/kernel`、`@bobby/cli` npm scope 发布不再为此目标强制条件。

## Task 5: 发布 CI 改造（GitHub Release-only）

- [x] `.github/workflows/release.yml` 改为 tag 触发的 `verify` + `desktop` 两阶段。
- [x] `verify` job 仅保留：
  - `pnpm install --frozen-lockfile`
  - `pnpm lint`
  - `pnpm -r build`
  - `pnpm -r test`
- [x] 移除所有 npm 发布路径、`NPM_TOKEN` 和 `registry-url` 配置。
- [x] 保留 `desktop` 对 `verify` 的依赖，保留 `permissions: contents: write` 与 `GH_TOKEN`，继续执行 `pnpm --filter @bobby/gui run package:publish`。

## Task 6: 上线前复核

- [x] 以 source-install 路径为准：CLI 运行前先执行 `pnpm -r build`，避免只 build CLI 造成运行依赖缺失。
- [x] 更新验收条件：不再要求 `npm i -g @bobby/cli` 成功，改为 GitHub Release + source-install 可交付。
- [x] 保留“无未验证承诺”的文档口径（零默认遥测、非空口承诺、DeepSeek Key 本地持有、证据先行）。

## M8 验收标准（v0.1.0）

- 发布目标为 GitHub Release-only + source install。
- `release.yml` 不执行 `pnpm publish` / `npm publish`，不依赖 `NPM_TOKEN`。
- `release.yml` 不包含 `registry-url`，并且 `desktop` 依赖 `verify`。
- `desktop` 继续使用 `GH_TOKEN` 与 `permissions: contents: write` 发布 GitHub Release（electron-builder）。
- Source-install 文档要求：先执行 `npm exec pnpm@9 -- -r build`，再执行 `node packages/cli/dist/index.js ...`。
- 文档不再将 `npm i -g @bobby/cli` 写为可交付交付路径。
