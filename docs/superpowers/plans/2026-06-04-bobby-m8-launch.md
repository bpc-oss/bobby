# M8 开源上线 Implementation Plan（Bobby v1）

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` 或 `superpowers:executing-plans`。
> 总纲：`2026-06-04-bobby-v1-master-plan.md`　前置：M0–M7 完成。

**Goal:** 把 Bobby 打包、分发、配文档、配发布 CI，做到三平台可安装、CI 绿、文档齐，正式开源上线（Apache-2.0、用户自带 Key）。

**Architecture:** CLI 走 npm 发布；GUI 走 electron-builder 出三平台安装包 + electron-updater 自动更新；GitHub Actions 跑 verify + release。

**Tech Stack:** npm/pnpm publish、electron-builder、electron-updater、GitHub Actions。

---

## 文件结构
- `packages/gui/electron-builder.yml`
- `packages/gui/electron/updater.ts`
- `.github/workflows/release.yml`
- `README.md`（卖点重写）、`CONTRIBUTING.md`、`CODE_OF_CONDUCT.md`、`docs/quickstart.md`
- `.changeset/`（版本管理，可选）

---

## Task 1: 发布元数据（npm 包就绪）

**Files:** Modify `packages/{shared,kernel,cli}/package.json`

- [ ] **Step 1: 给可发布包补元数据**
为 `@bobby/shared`、`@bobby/kernel`、`@bobby/cli` 各补：
```json
{
  "license": "Apache-2.0",
  "repository": { "type": "git", "url": "https://github.com/<org>/bobby" },
  "publishConfig": { "access": "public" },
  "files": ["dist"]
}
```
- [ ] **Step 2: 验证打包内容**
Run: `pnpm -r build && pnpm --filter @bobby/cli pack`
Expected: 生成 `.tgz`，内含 `dist/`，无源码/密钥。
- [ ] **Step 3: 提交** — `git commit -am "chore(release): publishable package metadata (Apache-2.0)"`

---

## Task 2: GUI 安装包（electron-builder）

**Files:** Create `packages/gui/electron-builder.yml`

- [ ] **Step 1: 写打包配置**
```yaml
# packages/gui/electron-builder.yml
appId: dev.bobby.app
productName: Bobby
directories: { output: release }
files: ["dist/**", "dist-electron/**"]
mac: { target: [dmg], category: public.app-category.developer-tools }
win: { target: [nsis] }
linux: { target: [AppImage], category: Development }
publish: [{ provider: github }]
```
- [ ] **Step 2: 本地出包验证**
Run: `pnpm --filter @bobby/gui build`
Expected: `packages/gui/release/` 下生成当前平台安装包。
- [ ] **Step 3: 提交** — `git commit -am "build(gui): electron-builder config for win/mac/linux"`

---

## Task 3: 自动更新（electron-updater）

**Files:** Create `packages/gui/electron/updater.ts`; Modify `packages/gui/electron/main.ts`

- [ ] **Step 1: 写更新器**
```ts
// packages/gui/electron/updater.ts
import { autoUpdater } from 'electron-updater';
export function initAutoUpdate(notify: (msg: string) => void) {
  autoUpdater.on('update-available', () => notify('发现新版本，正在后台下载…'));
  autoUpdater.on('update-downloaded', () => notify('新版本已就绪，重启后生效。'));
  autoUpdater.checkForUpdatesAndNotify().catch(() => {/* 离线静默，不打扰 */});
}
```
- [ ] **Step 2: main.ts 启动时调用** `initAutoUpdate((m) => win.webContents.send('kernel:event', { type: 'error', taskId: 'system', message: m }))`（复用事件通道提示，非真错误，UI 以 system 标识区分）。
- [ ] **Step 3: 手测**：打两个版本，验证升级流程。
- [ ] **Step 4: 提交** — `git commit -am "feat(gui): auto-update via electron-updater"`

---

## Task 4: 文档（卖点：不撒谎）

**Files:** Create/Modify `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `docs/quickstart.md`

- [ ] **Step 1: 重写 README**（要点）
```markdown
# Bobby — 不敢骗你的编码 agent（DeepSeek V4 Flash/Pro 原生）

普通 AI agent 会"看起来做完了"就糊弄过去——尤其当你看不懂代码时。
Bobby 不行：它被结构性地逼着，**凡声称"做完"必须交出机器可核验的证据**，
出题人 ≠ 阅卷人（Flash 干活、Pro 挑刺），没过完成闸门就绝不显示"完成"。

## 30 秒上手
1. 安装：CLI `npm i -g @bobby/cli`，或下载桌面版。
2. 配置你自己的 DeepSeek Key（`bobby config set-key` 或首启向导）。
3. `bobby run "把这个文件夹里的 csv 都转成 json"` —— 看它做，并看它给的证据。

开源 · Apache-2.0 · 自带 Key · 本地运行 · 零默认遥测。
```
- [ ] **Step 2: 写 `docs/quickstart.md`**（CLI + GUI 两条路径，含 `bobby probe`）。
- [ ] **Step 3: 写 `CONTRIBUTING.md`**（TDD 要求、`pnpm -r test` 必须绿、Conventional Commits）与 `CODE_OF_CONDUCT.md`（Contributor Covenant）。
- [ ] **Step 4: 提交** — `git commit -am "docs: README (anti-lying pitch) + quickstart + contributing + CoC"`

---

## Task 5: 发布 CI

**Files:** Create `.github/workflows/release.yml`

- [ ] **Step 1: 写发布工作流**
```yaml
# .github/workflows/release.yml
name: release
on: { push: { tags: ['v*'] } }
jobs:
  npm:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm, registry-url: https://registry.npmjs.org }
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r build && pnpm -r test
      - run: pnpm --filter @bobby/shared --filter @bobby/kernel --filter @bobby/cli publish --no-git-checks
        env: { NODE_AUTH_TOKEN: '${{ secrets.NPM_TOKEN }}' }
  desktop:
    strategy: { matrix: { os: [macos-latest, windows-latest, ubuntu-latest] } }
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @bobby/gui build
        env: { GH_TOKEN: '${{ secrets.GITHUB_TOKEN }}' }
```
- [ ] **Step 2: 验证**：打 `v0.1.0` tag（先在 fork/测试仓库），确认两条 job 跑通。
- [ ] **Step 3: 提交** — `git commit -am "ci: release workflow (npm + tri-platform desktop)"`

---

## Task 6: 上线前总验收（守 L6，对自己也不撒谎）

- [ ] **Step 1: 全量绿**
Run: `pnpm install && pnpm lint && pnpm -r build && pnpm -r test`
Expected: 全绿。
- [ ] **Step 2: 真实端到端冒烟**（配真实 DeepSeek Key）
  - `bobby probe` 生成 capabilities。
  - CLI：`bobby run "新建 demo/ 并写 hello.py 打印 hi，然后运行它"` → 看到真实执行 + `command_output` 证据 + `done`。
  - 故意给一个无硬裁判的模糊任务 → 触发追问或 `need_human`，**不蒙混**。
  - 桌面版：首启向导填 Key → 同一任务 → 证据面板可展开真实输出。
- [ ] **Step 3: 三平台安装包产物存在**（release/ 或 CI artifacts）。
- [ ] **Step 4: 打正式 tag 发布** — `git tag v0.1.0 && git push --tags`

---

## ✅ M8 验收标准（= v1 上线标准）
- [ ] `pnpm install && pnpm lint && pnpm -r build && pnpm -r test` 全绿。
- [ ] CLI 可 `npm i -g @bobby/cli` 安装运行；GUI 三平台安装包可装可跑。
- [ ] 自动更新链路通；零默认遥测。
- [ ] README 讲清"不撒谎"卖点；quickstart/CONTRIBUTING/CoC/LICENSE(Apache-2.0) 齐全。
- [ ] 真实端到端：能解决问题并给真实证据；无硬裁判任务不蒙混（追问/need_human）。
- [ ] release CI 在 tag 上跑通。

**M8 完成 → Bobby v1 上线。** 四层（大脑/良心/双手/脸面）+ 双前端 + DeepSeek 适配，全部 v1 一步到位。
