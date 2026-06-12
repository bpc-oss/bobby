# Bobby GUI 外壳（UI-First）实施计划 — Codex 施工指令

> **For agentic workers:** 本计划按"一个 Task = 一个可独立派发的工单"组织，步骤用 checkbox（`- [ ]`）跟踪。工人（Codex）严格 TDD、逐 Task 执行；总工程师按 §0.3 验收闸门亲自验收。
>
> 配套阅读（开工前必读）：
> - 设计规范：`docs/superpowers/specs/2026-06-13-bobby-gui-shell-design.md`（信息架构、视觉语言、模块定义）
> - 视觉/DOM 基准：`docs/superpowers/specs/2026-06-13-bobby-gui-shell-mockup.html`（**本计划多处要求"移植 mockup 对应 CSS/DOM"，它是唯一视觉基准**）
> - 执行协议：`docs/superpowers/plans/2026-06-04-bobby-execution-protocol.md`（派单/验收/重做铁律，本计划完全沿用）

**Goal:** 重建 `@bobby/gui` 的外壳为「侧边栏分段双入口（Chat/Code）+ 中央工作区 + 右侧面板」结构，全部 UI 面向 `KernelClient` 接口编程并由 `MockKernelClient` + 剧本 fixtures 驱动，不连真实 kernel 即可完整演练核心用户场景。

**Architecture:** 五区域外壳（标题栏 / 侧边栏 / 工作区 / 右侧面板 / 状态栏），zustand 双 store（`ui-store` 导航、`session-store` 会话数据），`KernelClient` 接口 + Mock 实现 + 剧本 fixtures。视觉按 Deep Glow tokens（spec §1.1）。

**Tech Stack:** React 18 + TypeScript + Vite 5 + Electron 31（本阶段不动 electron 层）+ zustand 5 + vitest 2 / @testing-library/react + @fontsource 本地字体。**不引入** react-router、组件库、CSS 框架。

---

## 0. 工作协议（每个工单都适用）

### 0.1 仓库事实（零上下文速览）

| 事实 | 值 |
|---|---|
| 包管理 | pnpm 9（`pnpm-workspace.yaml`），Node ≥ 20 |
| 本计划工作范围 | **只允许改 `packages/gui/`**（含其 `tests/`）；`packages/{kernel,cli,shared}` 一律只读 |
| GUI 测试 | `packages/gui/tests/*.test.ts(x)`，vitest + jsdom + @testing-library/react（见 `vitest.config.ts`，alias 已配好 `@bobby/shared` → 源码） |
| 共享类型 | `@bobby/shared` 导出 `KernelCommand / KernelEvent / Evidence / Verdict / PlanStep`（zod，见 `packages/shared/src/api/kernel-api.ts`）。**禁止自创平行类型重复它们** |
| Electron 桥 | `window.bobby = { send(cmd), onEvent(cb) }`（`packages/gui/electron/preload.ts`）。本计划阶段 UI 不直接用它，统一走 `KernelClient` |
| 现有屏幕 | `src/screens/{Workspace,Wizard,History,Settings,Plugins}.tsx` + `src/main.tsx` 顶部导航。P0 重写 main.tsx；Wizard/Settings/Plugins **保留文件**（后续阶段迁移）；Workspace/History 在 T17 清退 |
| 语言 | UI 文案默认中文；`src/lib/i18n.ts` 是简易字典。本计划 P0/P1 允许在 config/组件中硬编码中文文案（集中到 config 文件），全量 i18n 化属于 P6，**不要顺手做** |

### 0.2 命令速查（验收用，工人和总工程师都用这套）

```bash
pnpm install                          # 装依赖（增删依赖后必跑）
pnpm --filter @bobby/gui test         # GUI 全部测试（vitest run）
pnpm --filter @bobby/gui typecheck    # tsc --noEmit
pnpm lint                             # 全仓 eslint（--max-warnings=0，一条警告都不许）
pnpm -r build                         # 全仓构建
pnpm --filter @bobby/gui dev          # vite dev → http://localhost:5173（浏览器打开即 mock 模式）
```

### 0.3 铁律（沿用执行协议，违者打回）

1. **TDD**：每个 Task 先写失败测试 → 跑出真实 FAIL → 最小实现 → 跑出真实 PASS → 提交。
2. **回传证据**：每个 Task 完成时回传 ① 完整 `git diff`；② 测试命令**整段真实输出**（不许摘要）；③ 改动文件清单。"我觉得可以/应该没问题" = 未完成。
3. **范围红线**：只动该 Task 声明的文件；不许削弱/删除既有测试来"凑绿"（测试文件每行改动都会被审）；不许越界改 `packages/{kernel,cli,shared}`。
4. **视觉红线**：class 名与 DOM 结构对齐 mockup；颜色/字体/动效只用 `theme.css` 的 CSS variables，**不许出现裸色值**（mockup 移植过来的 CSS 需把硬编码色值替换为对应 var）；不引入新调色（尤其紫色渐变）。
5. **零占位**：不许提交 `TODO`/空函数/假断言（`expect(true).toBe(true)`）。
6. 每个 Task 一个 commit，message 用 `feat(gui): ...` / `test(gui): ...` / `refactor(gui): ...`。

### 0.4 派单模板（总工程师 → Codex，照抄执行协议 §2）

```
[任务] P<阶段>/T<N> <标题>
[范围] 只做这一个 Task，严禁扩大范围
[文件] <照抄该 Task 的 Files 清单>
[步骤] 严格按 Task 的 Step 1..N
[完成时必须回传] 1) git diff 全文 2) 测试整段真实输出 3) 文件清单
[红线] 见 directive §0.3
```

---

## 1. 阶段地图与验收门

| 阶段 | 内容 | 验收门（全部满足才解锁下一阶段） |
|---|---|---|
| **P0** 外壳（T1–T9） | 五区域布局 + 分段双入口 + 全部占位页 + Deep Glow tokens | §2.10 P0 验收清单 |
| **P1** Mock 数据流（T10–T17） | KernelClient 接口 + MockKernelClient + 4 套剧本 + 会话视图/列表/审查面板吃 mock | §3.9 P1 验收清单 |
| **P2** Chat 接通 | IpcKernelClient（chat 路径）+ 首启向导迁移 | 真 key 真对话；费用为真实 usage；mock/real 可切 |
| **P3** Code 核心 | code 会话接真 kernel：闸口、审查面板 diff+证据、摘要栏 | 真任务全流程；每条证据可展开原始输出 |
| **P4** 右侧面板补全 | 终端只读流 / 网页 webview / SideChat | webview 关 nodeIntegration、开 contextIsolation、导航 allowlist |
| **P5** 自动化三件套 | Routines → Loop（引导式四步向导）→ Team（模板流水线） | 各自列表+详情可用；产物均落成 Code 会话 |
| **P6** 打磨 | 命令面板 Ctrl+K、通知、用量 dashboard、快捷键、会话恢复、全量 i18n | 见 spec §2.1 清单逐条勾验 |

**本 directive 只下发 P0+P1 的可执行工单**（T1–T17，代码级）。P2–P6 依赖 kernel 侧能力与 P0/P1 的实际落地形态，开工前由总工程师按本格式逐阶段补发工单书（见 §4），**严禁 Codex 凭本表自行开工 P2+**。

---

## 2. P0 工单：外壳（T1–T9）

> P0 完成形态：浏览器打开 dev server，看到完整 Deep Glow 外壳；Chat/Code 分段切换、全部 sidebar 项、右侧 tabs、摘要栏、占位页都可点；工作区是静态会话壳（无数据）。

### T1：ui-store（导航状态）

**Files:**
- Create: `packages/gui/src/store/ui-store.ts`
- Test: `packages/gui/tests/ui-store.test.ts`
- Modify: `packages/gui/package.json`（加依赖 zustand）

- [ ] **Step 1: 安装依赖**

```bash
pnpm --filter @bobby/gui add zustand@^5
pnpm install
```

- [ ] **Step 2: 写失败测试**

```ts
// packages/gui/tests/ui-store.test.ts
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '../src/store/ui-store';

const initial = useUiStore.getState();

beforeEach(() => {
  useUiStore.setState(initial, true);
});

describe('ui-store', () => {
  it('默认 chat 模式 / session 视图 / 右面板开 / review tab', () => {
    const s = useUiStore.getState();
    expect(s.mode).toBe('chat');
    expect(s.view).toBe('session');
    expect(s.rightPanelOpen).toBe(true);
    expect(s.rightTab).toBe('review');
    expect(s.summaryOpen).toBe(false);
  });

  it('setMode 切模式并把视图重置为 session', () => {
    useUiStore.getState().setView('projects');
    useUiStore.getState().setMode('code');
    expect(useUiStore.getState().mode).toBe('code');
    expect(useUiStore.getState().view).toBe('session');
  });

  it('setView / toggleSummary / toggleRightPanel / setRightTab', () => {
    useUiStore.getState().setView('loop');
    expect(useUiStore.getState().view).toBe('loop');

    useUiStore.getState().toggleSummary();
    expect(useUiStore.getState().summaryOpen).toBe(true);

    useUiStore.getState().toggleRightPanel();
    expect(useUiStore.getState().rightPanelOpen).toBe(false);

    useUiStore.getState().setRightTab('terminal');
    expect(useUiStore.getState().rightTab).toBe('terminal');
    expect(useUiStore.getState().rightPanelOpen).toBe(true); // 选 tab 自动展开
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm --filter @bobby/gui test -- ui-store`
Expected: FAIL（找不到 `../src/store/ui-store`）

- [ ] **Step 4: 最小实现**

```ts
// packages/gui/src/store/ui-store.ts
import { create } from 'zustand';

export type AppMode = 'chat' | 'code';
export type AppView =
  | 'session'
  | 'search'
  | 'write'
  | 'projects'
  | 'routines'
  | 'loop'
  | 'team'
  | 'settings';
export type RightTab = 'review' | 'terminal' | 'web' | 'sidechat';

interface UiState {
  mode: AppMode;
  view: AppView;
  rightPanelOpen: boolean;
  rightTab: RightTab;
  summaryOpen: boolean;
  setMode: (mode: AppMode) => void;
  setView: (view: AppView) => void;
  setRightTab: (tab: RightTab) => void;
  toggleRightPanel: () => void;
  toggleSummary: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  mode: 'chat',
  view: 'session',
  rightPanelOpen: true,
  rightTab: 'review',
  summaryOpen: false,
  setMode: (mode) => set({ mode, view: 'session' }),
  setView: (view) => set({ view }),
  setRightTab: (tab) => set({ rightTab: tab, rightPanelOpen: true }),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  toggleSummary: () => set((s) => ({ summaryOpen: !s.summaryOpen }))
}));
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm --filter @bobby/gui test -- ui-store`
Expected: PASS（3 个用例）

- [ ] **Step 6: 提交**

```bash
git add packages/gui/src/store/ui-store.ts packages/gui/tests/ui-store.test.ts packages/gui/package.json pnpm-lock.yaml
git commit -m "feat(gui): add zustand ui-store for shell navigation"
```

### T2：Deep Glow tokens + 本地字体

**Files:**
- Create: `packages/gui/src/lib/theme.css`
- Modify: `packages/gui/src/main.tsx`（只加 import 行，本 Task 不改其它）
- Modify: `packages/gui/package.json`（@fontsource 三件）

- [ ] **Step 1: 安装字体包**

```bash
pnpm --filter @bobby/gui add @fontsource/chakra-petch @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono
pnpm install
```

- [ ] **Step 2: 写 theme.css（完整 tokens，照抄）**

```css
/* packages/gui/src/lib/theme.css — Deep Glow tokens（spec §1.1）。全应用唯一颜色来源 */
:root {
  --bg-deep: #04070b;
  --glass: rgba(13, 20, 28, 0.58);
  --glass-2: rgba(20, 30, 41, 0.52);
  --glass-3: rgba(28, 41, 55, 0.55);
  --hairline: rgba(168, 224, 255, 0.09);
  --hairline-2: rgba(168, 224, 255, 0.18);
  --text: #cdd9e5;
  --muted: #7e91a6;
  --dim: #45576b;
  --teal: #36e4c8;
  --teal-soft: rgba(54, 228, 200, 0.13);
  --teal-glow: rgba(54, 228, 200, 0.32);
  --amber: #f0b35e;
  --amber-soft: rgba(240, 179, 94, 0.12);
  --coral: #ff7d70;
  --blue: #6db5ff;
  --font-ui: 'IBM Plex Sans', 'MiSans', 'Microsoft YaHei', sans-serif;
  --font-brand: 'Chakra Petch', 'IBM Plex Sans', sans-serif;
  --font-mono: 'IBM Plex Mono', Consolas, monospace;
  --radius-panel: 10px;
  --radius-card: 10px;
  --radius-chip: 7px;
}

body {
  margin: 0;
  font-family: var(--font-ui);
  font-size: 13px;
  color: var(--text);
  background:
    radial-gradient(1100px 750px at 12% -8%, rgba(38, 168, 152, 0.13), transparent 62%),
    radial-gradient(950px 700px at 108% 112%, rgba(56, 96, 190, 0.11), transparent 60%),
    var(--bg-deep);
}

::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-thumb { background: rgba(168, 224, 255, 0.1); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: rgba(168, 224, 255, 0.2); }
::-webkit-scrollbar-track { background: transparent; }
```

- [ ] **Step 3: 在 main.tsx 顶部 import（紧挨现有 `./app.css` import 之前）**

```ts
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import './lib/theme.css';
```

- [ ] **Step 4: 验证**

Run: `pnpm --filter @bobby/gui typecheck && pnpm -r build && pnpm --filter @bobby/gui test`
Expected: 全部通过，无新增告警

- [ ] **Step 5: 提交**

```bash
git add packages/gui/src/lib/theme.css packages/gui/src/main.tsx packages/gui/package.json pnpm-lock.yaml
git commit -m "feat(gui): Deep Glow design tokens + bundled fonts"
```

### T3：ModeSwitch（分段双入口）

**Files:**
- Create: `packages/gui/src/shell/ModeSwitch.tsx`
- Create: `packages/gui/src/shell/shell.css`（外壳组件共用样式，从 mockup 移植，本 Task 起逐步充实）
- Test: `packages/gui/tests/mode-switch.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
// packages/gui/tests/mode-switch.test.tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { ModeSwitch } from '../src/shell/ModeSwitch';
import { useUiStore } from '../src/store/ui-store';

const initial = useUiStore.getState();

beforeEach(() => {
  useUiStore.setState(initial, true);
});

describe('ModeSwitch', () => {
  it('渲染 Chat / Code 两个分段，chat 默认激活', () => {
    render(<ModeSwitch />);
    const chat = screen.getByRole('tab', { name: /chat/i });
    const code = screen.getByRole('tab', { name: /code/i });
    expect(chat.getAttribute('aria-selected')).toBe('true');
    expect(code.getAttribute('aria-selected')).toBe('false');
  });

  it('点击 Code 切换模式并重置视图', () => {
    useUiStore.getState().setView('projects');
    render(<ModeSwitch />);
    fireEvent.click(screen.getByRole('tab', { name: /code/i }));
    expect(useUiStore.getState().mode).toBe('code');
    expect(useUiStore.getState().view).toBe('session');
  });

  it('badge>0 时显示角标', () => {
    render(<ModeSwitch codeBadge={2} />);
    expect(screen.getByText('2')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @bobby/gui test -- mode-switch`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现组件**

```tsx
// packages/gui/src/shell/ModeSwitch.tsx
import React from 'react';

import { useUiStore } from '../store/ui-store';
import type { AppMode } from '../store/ui-store';

const SEGMENTS: Array<{ mode: AppMode; glyph: string; label: string }> = [
  { mode: 'chat', glyph: '❍', label: 'Chat' },
  { mode: 'code', glyph: '</>', label: 'Code' }
];

export function ModeSwitch({ codeBadge = 0 }: { codeBadge?: number }): JSX.Element {
  const mode = useUiStore((s) => s.mode);
  const setMode = useUiStore((s) => s.setMode);
  const activeIndex = SEGMENTS.findIndex((s) => s.mode === mode);

  return (
    <div className="mode-switch" role="tablist" aria-label="模式切换">
      <div
        className="glider"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
        aria-hidden
      />
      {SEGMENTS.map((seg) => (
        <button
          key={seg.mode}
          role="tab"
          aria-selected={mode === seg.mode}
          className={`seg ${mode === seg.mode ? 'active' : ''}`}
          onClick={() => setMode(seg.mode)}
        >
          <span className="glyph">{seg.glyph}</span>
          {seg.label}
          {seg.mode === 'code' && codeBadge > 0 && <span className="badge">{codeBadge}</span>}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: 建 shell.css 并移植样式**

新建 `packages/gui/src/shell/shell.css`，从 mockup `<style>` 块移植 `.mode-switch / .glider / .seg / .seg .badge / .seg .glyph` 五段规则（mockup 第 "②侧边栏" 样式节），**把所有硬编码色值替换为 theme.css 对应 var**（对照表：`#36e4c8→var(--teal)` 等，mockup 用的就是同名 var，可直接照搬）。在 `main.tsx` 的 theme.css import 之后加 `import './shell/shell.css';`。

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm --filter @bobby/gui test -- mode-switch`
Expected: PASS（3 个用例）

- [ ] **Step 6: 提交**

```bash
git add packages/gui/src/shell/ModeSwitch.tsx packages/gui/src/shell/shell.css packages/gui/src/main.tsx packages/gui/tests/mode-switch.test.tsx
git commit -m "feat(gui): ModeSwitch segmented control (chat/code)"
```

### T4：Sidebar（功能项 + 列表 + 底部）

**Files:**
- Create: `packages/gui/src/shell/sidebar-config.ts`
- Create: `packages/gui/src/shell/Sidebar.tsx`
- Modify: `packages/gui/src/shell/shell.css`（移植 `.side / .side-fn / .fn-item / .side-sep / .side-list / .group-h / .item / .dot.* / .side-bottom / .sb-btn / .avatar`）
- Test: `packages/gui/tests/sidebar.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
// packages/gui/tests/sidebar.test.tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { Sidebar } from '../src/shell/Sidebar';
import { useUiStore } from '../src/store/ui-store';

const initial = useUiStore.getState();

beforeEach(() => {
  useUiStore.setState(initial, true);
});

describe('Sidebar', () => {
  it('chat 模式显示 chat 功能项', () => {
    render(<Sidebar />);
    expect(screen.getByText('New Chat')).toBeTruthy();
    expect(screen.getByText('Write')).toBeTruthy();
    expect(screen.queryByText('Loop Engineering')).toBeNull();
  });

  it('code 模式显示 code 功能项', () => {
    useUiStore.getState().setMode('code');
    render(<Sidebar />);
    expect(screen.getByText('New Session')).toBeTruthy();
    expect(screen.getByText('Routines')).toBeTruthy();
    expect(screen.getByText('Loop Engineering')).toBeTruthy();
    expect(screen.getByText('Team')).toBeTruthy();
  });

  it('点击功能项切换视图', () => {
    useUiStore.getState().setMode('code');
    render(<Sidebar />);
    fireEvent.click(screen.getByText('Loop Engineering'));
    expect(useUiStore.getState().view).toBe('loop');
  });

  it('底部 Settings 切到 settings 视图', () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByText('Settings'));
    expect(useUiStore.getState().view).toBe('settings');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @bobby/gui test -- sidebar`
Expected: FAIL

- [ ] **Step 3: 实现 config + 组件**

```ts
// packages/gui/src/shell/sidebar-config.ts
import type { AppMode, AppView } from '../store/ui-store';

export interface FnItem {
  view: AppView;
  icon: string;
  label: string;
  soon?: boolean;
}

export const FN_ITEMS: Record<AppMode, FnItem[]> = {
  chat: [
    { view: 'session', icon: '＋', label: 'New Chat' },
    { view: 'search', icon: '⌕', label: '搜索' },
    { view: 'write', icon: '✎', label: 'Write', soon: true },
    { view: 'projects', icon: '▤', label: 'Projects' }
  ],
  code: [
    { view: 'session', icon: '＋', label: 'New Session' },
    { view: 'routines', icon: '↻', label: 'Routines', soon: true },
    { view: 'loop', icon: '∞', label: 'Loop Engineering', soon: true },
    { view: 'team', icon: '⧉', label: 'Team', soon: true }
  ]
};

// ⚠ P0 静态占位列表，T16 接 MockKernelClient 后移除
export interface StaticItem {
  title: string;
  time: string;
  dot: 'run' | 'gate' | 'ok' | 'err' | 'none';
}
export const STATIC_GROUPS: Record<AppMode, Array<{ heading: string; items: StaticItem[] }>> = {
  chat: [
    { heading: 'PINNED', items: [{ title: 'DeepSeek V4 定价梳理', time: '6/02', dot: 'none' }] },
    {
      heading: 'TODAY',
      items: [{ title: 'Electron 自动更新方案对比', time: '14:02', dot: 'none' }]
    }
  ],
  code: [
    { heading: 'PINNED', items: [{ title: 'GUI 外壳重构 P0', time: 'RUN', dot: 'run' }] },
    {
      heading: 'BOBBY',
      items: [
        { title: '修复 updater 校验失败', time: '待审批', dot: 'gate' },
        { title: 'kernel 事件总线单测补全', time: '11:20', dot: 'ok' }
      ]
    }
  ]
};
```

```tsx
// packages/gui/src/shell/Sidebar.tsx
import React from 'react';

import { FN_ITEMS, STATIC_GROUPS } from './sidebar-config';
import { ModeSwitch } from './ModeSwitch';
import { useUiStore } from '../store/ui-store';

export function Sidebar(): JSX.Element {
  const mode = useUiStore((s) => s.mode);
  const view = useUiStore((s) => s.view);
  const setView = useUiStore((s) => s.setView);

  return (
    <aside className="side">
      <ModeSwitch codeBadge={1} />
      <div className="side-fn">
        {FN_ITEMS[mode].map((fn) => (
          <button
            key={fn.view}
            className={`fn-item ${view === fn.view ? 'active' : ''}`}
            onClick={() => setView(fn.view)}
          >
            <span className="ic">{fn.icon}</span>
            {fn.label}
            {fn.soon && <span className="soon">SOON</span>}
          </button>
        ))}
      </div>
      <div className="side-sep" />
      <div className="side-list">
        {STATIC_GROUPS[mode].map((group) => (
          <React.Fragment key={group.heading}>
            <div className="group-h">{group.heading}</div>
            {group.items.map((item) => (
              <div className="item" key={item.title}>
                <span className={`dot ${item.dot}`} />
                <span className="t">{item.title}</span>
                <span className="time">{item.time}</span>
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="side-bottom">
        <button className={`sb-btn ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>
          ⚙ Settings
        </button>
        <button className="sb-btn acct">
          <span className="avatar">B</span>
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: 移植 CSS（Files 里列出的 selector 段，色值换 var）**

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm --filter @bobby/gui test -- sidebar`
Expected: PASS（4 个用例）

- [ ] **Step 6: 提交**

```bash
git add packages/gui/src/shell/Sidebar.tsx packages/gui/src/shell/sidebar-config.ts packages/gui/src/shell/shell.css packages/gui/tests/sidebar.test.tsx
git commit -m "feat(gui): sidebar with mode-scoped fn items and list groups"
```

### T5：TitleBar + StatusBar

**Files:**
- Create: `packages/gui/src/shell/TitleBar.tsx`
- Create: `packages/gui/src/shell/StatusBar.tsx`
- Modify: `packages/gui/src/shell/shell.css`（移植 `.titlebar / .brand / .pill / .icon-btn / .win-ctl / .status / .led / .ctx-meter`）
- Test: `packages/gui/tests/titlebar-statusbar.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
// packages/gui/tests/titlebar-statusbar.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { StatusBar } from '../src/shell/StatusBar';
import { TitleBar } from '../src/shell/TitleBar';

describe('TitleBar', () => {
  it('渲染品牌 / 项目切换器 / 命令面板入口', () => {
    render(<TitleBar projectName="bobby" />);
    expect(screen.getByText('BOBBY')).toBeTruthy();
    expect(screen.getByText(/bobby ▾/)).toBeTruthy();
    expect(screen.getByText(/Ctrl K/)).toBeTruthy();
  });
});

describe('StatusBar', () => {
  it('渲染 kernel/模型/上下文/mock 标识', () => {
    render(<StatusBar kernelConnected model="FLASH" contextPct={34} mock />);
    expect(screen.getByText(/KERNEL CONNECTED/)).toBeTruthy();
    expect(screen.getByText(/FLASH/)).toBeTruthy();
    expect(screen.getByText(/34%/)).toBeTruthy();
    expect(screen.getByText(/MOCK MODE/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: 跑测试确认失败** — Run: `pnpm --filter @bobby/gui test -- titlebar`，Expected: FAIL

- [ ] **Step 3: 实现两个组件（props 驱动的纯展示组件，DOM 结构对照 mockup ①标题栏 / ⑤状态栏，文案与 class 名一致；命令面板按钮 P0 仅展示不绑事件）**

```tsx
// packages/gui/src/shell/TitleBar.tsx
import React from 'react';

export function TitleBar({ projectName }: { projectName: string }): JSX.Element {
  return (
    <div className="titlebar">
      <span className="brand">
        <i aria-hidden /> BOBBY
      </span>
      <button className="pill">⌖ {projectName} ▾</button>
      <button className="pill palette">
        ⌕ 搜索或执行命令… <kbd>Ctrl K</kbd>
      </button>
      <button className="icon-btn" aria-label="通知">🔔</button>
    </div>
  );
}
```

```tsx
// packages/gui/src/shell/StatusBar.tsx
import React from 'react';

interface StatusBarProps {
  kernelConnected: boolean;
  model: string;
  contextPct: number;
  mock?: boolean;
}

export function StatusBar({ kernelConnected, model, contextPct, mock = false }: StatusBarProps): JSX.Element {
  return (
    <div className="status">
      <span>
        <span className="led">●</span> {kernelConnected ? 'KERNEL CONNECTED' : 'KERNEL OFFLINE'}
      </span>
      <span>
        <span className="led">●</span> DEEPSEEK · {model}
      </span>
      <span>
        CTX
        <span className="ctx-meter">
          <i style={{ width: `${contextPct}%` }} />
        </span>
        {contextPct}%
      </span>
      {mock && <span>MOCK MODE</span>}
    </div>
  );
}
```

- [ ] **Step 4: 移植 CSS** → **Step 5: 跑测试 PASS** → **Step 6: 提交**

```bash
git add packages/gui/src/shell/TitleBar.tsx packages/gui/src/shell/StatusBar.tsx packages/gui/src/shell/shell.css packages/gui/tests/titlebar-statusbar.test.tsx
git commit -m "feat(gui): titlebar and statusbar shell components"
```

### T6：RightPanel（四 tab + 折叠）

**Files:**
- Create: `packages/gui/src/panels/RightPanel.tsx`
- Create: `packages/gui/src/panels/panels.css`（移植 `.right / .rp-head / .rp-collapse / .rp-tabs / .rp-tab / .tab-underline / .rp-body` + 各 tab 内容样式；main.tsx 加 import）
- Test: `packages/gui/tests/right-panel.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
// packages/gui/tests/right-panel.test.tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { RightPanel } from '../src/panels/RightPanel';
import { useUiStore } from '../src/store/ui-store';

const initial = useUiStore.getState();

beforeEach(() => {
  useUiStore.setState(initial, true);
});

describe('RightPanel', () => {
  it('默认显示审查 tab 内容', () => {
    render(<RightPanel />);
    expect(screen.getByRole('tab', { name: /审查/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('点击终端 tab 切换', () => {
    render(<RightPanel />);
    fireEvent.click(screen.getByRole('tab', { name: /终端/ }));
    expect(useUiStore.getState().rightTab).toBe('terminal');
  });

  it('折叠按钮收起面板', () => {
    render(<RightPanel />);
    fireEvent.click(screen.getByLabelText('折叠面板'));
    expect(useUiStore.getState().rightPanelOpen).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试 FAIL** — Run: `pnpm --filter @bobby/gui test -- right-panel`

- [ ] **Step 3: 实现**

```tsx
// packages/gui/src/panels/RightPanel.tsx
import React from 'react';

import { useUiStore } from '../store/ui-store';
import type { RightTab } from '../store/ui-store';

const TABS: Array<{ tab: RightTab; label: string }> = [
  { tab: 'review', label: '◈ 审查' },
  { tab: 'terminal', label: '❯ 终端' },
  { tab: 'web', label: '◍ 网页' },
  { tab: 'sidechat', label: '❍ SideChat' }
];

// P0 各 tab 均为占位内容；T16 将 review 接入 mock 数据
function TabBody({ tab }: { tab: RightTab }): JSX.Element {
  if (tab === 'review') return <div className="rp-empty">暂无变更与证据 — 会话产生 file_diff / 证据后显示</div>;
  if (tab === 'terminal') return <div className="rp-empty">只读命令流（kernel 执行记录）· P4 接通</div>;
  if (tab === 'web') return <div className="rp-empty">内嵌 webview 预览 · P4 接通</div>;
  return <div className="rp-empty">旁路小聊，不污染主会话上下文 · P4 接通</div>;
}

export function RightPanel(): JSX.Element {
  const open = useUiStore((s) => s.rightPanelOpen);
  const tab = useUiStore((s) => s.rightTab);
  const setTab = useUiStore((s) => s.setRightTab);
  const toggle = useUiStore((s) => s.toggleRightPanel);
  const activeIndex = TABS.findIndex((t) => t.tab === tab);

  return (
    <aside className={`right ${open ? '' : 'collapsed'}`}>
      <div className="rp-head">
        <button className="rp-collapse" aria-label="折叠面板" onClick={toggle}>⇥</button>
        {open && (
          <div className="rp-tabs" role="tablist">
            <div className="tab-underline" style={{ transform: `translateX(${activeIndex * 100}%)` }} aria-hidden />
            {TABS.map((t) => (
              <button
                key={t.tab}
                role="tab"
                aria-selected={tab === t.tab}
                className={`rp-tab ${tab === t.tab ? 'active' : ''}`}
                onClick={() => setTab(t.tab)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {open && (
        <div className="rp-body">
          <TabBody tab={tab} />
        </div>
      )}
    </aside>
  );
}
```

`.rp-empty` 样式新增：`padding: 24px 12px; color: var(--dim); font-size: 12px; line-height: 1.8; text-align: center;`

- [ ] **Step 4: 跑测试 PASS** → **Step 5: 提交**

```bash
git add packages/gui/src/panels/RightPanel.tsx packages/gui/src/panels/panels.css packages/gui/src/main.tsx packages/gui/tests/right-panel.test.tsx
git commit -m "feat(gui): right panel with four tabs and collapse"
```

### T7：占位页（EmptyState + 各模块 + Loop 向导骨架）

**Files:**
- Create: `packages/gui/src/modes/EmptyState.tsx`
- Create: `packages/gui/src/modes/placeholder-config.tsx`
- Create: `packages/gui/src/modes/LoopPlaceholder.tsx`
- Create: `packages/gui/src/modes/modes.css`（移植 `.placeholder / .orb / .soon-tag / .mini-sketch / .wizard / .wz-step / .wz-conn / .wz-aids`；main.tsx 加 import）
- Test: `packages/gui/tests/placeholders.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
// packages/gui/tests/placeholders.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { LoopPlaceholder } from '../src/modes/LoopPlaceholder';
import { PLACEHOLDERS } from '../src/modes/placeholder-config';

describe('占位页', () => {
  it('所有非 session 视图都有占位配置', () => {
    for (const view of ['search', 'write', 'projects', 'routines', 'team', 'settings'] as const) {
      expect(PLACEHOLDERS[view]).toBeTruthy();
      expect(PLACEHOLDERS[view].title.length).toBeGreaterThan(0);
    }
  });

  it('Loop 占位页渲染四步引导向导骨架', () => {
    render(<LoopPlaceholder />);
    expect(screen.getByText('目标')).toBeTruthy();
    expect(screen.getByText('验收器')).toBeTruthy();
    expect(screen.getByText('迭代策略')).toBeTruthy();
    expect(screen.getByText('预算')).toBeTruthy();
    expect(screen.getByText(/AI 辅助润写/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: 跑测试 FAIL** — Run: `pnpm --filter @bobby/gui test -- placeholders`

- [ ] **Step 3: 实现**

```tsx
// packages/gui/src/modes/EmptyState.tsx
import React from 'react';

export interface EmptyStateProps {
  glyph: string;
  title: string;
  desc: React.ReactNode;
  tag: string;
  children?: React.ReactNode; // mini-sketch / 向导骨架等扩展区
}

export function EmptyState({ glyph, title, desc, tag, children }: EmptyStateProps): JSX.Element {
  return (
    <div className="placeholder">
      <div className="orb">{glyph}</div>
      <h2>{title}</h2>
      <p>{desc}</p>
      {children}
      <span className="soon-tag">{tag}</span>
    </div>
  );
}
```

```tsx
// packages/gui/src/modes/placeholder-config.tsx
// 文案与 mockup 占位视图一字不差（视觉基准即文案基准）
import React from 'react';

import type { EmptyStateProps } from './EmptyState';

export const PLACEHOLDERS: Record<string, Omit<EmptyStateProps, 'children'>> = {
  search: {
    glyph: '⌕',
    title: '全文搜索',
    desc: <>跨所有对话与会话的全文检索。也可以随时用 <b>Ctrl+K</b> 唤起命令面板：搜索 + 跳转 + 执行动作。</>,
    tag: 'P6'
  },
  write: {
    glyph: '✎',
    title: 'Write 写作模式',
    desc: <>文档型创作：左侧 Markdown 编辑器 + AI <b>续写 / 改写 / 润色</b>，右侧实时预览，可导出 md / docx。</>,
    tag: 'SOON'
  },
  projects: {
    glyph: '▤',
    title: 'Projects',
    desc: <>项目 = <b>共享上下文 + 自定义指令 + 知识文件</b>。归属项目的对话自动携带项目上下文。</>,
    tag: 'P5+'
  },
  routines: {
    glyph: '↻',
    title: 'Routines 定时任务',
    desc: <>自然语言排程 → cron。<b>每次运行落成一条 Code 会话</b>，可回看完整过程。</>,
    tag: 'P5'
  },
  team: {
    glyph: '⧉',
    title: 'Team 多智能体流水线',
    desc: <>角色编排：节点 = agent（模型/提示词/工具权限），连线 = 交接物。先提供<b>模板</b>，运行时泳道图展示各 agent 消息流。</>,
    tag: 'P5 · 重点版块'
  },
  settings: {
    glyph: '⚙',
    title: 'Settings 设置中心',
    desc: <>通用 · 模型与密钥 · 权限与闸口 · MCP/插件 · <b>用量统计</b> · 数据与隐私（零遥测）· 关于与更新。</>,
    tag: 'P2+'
  }
};
```

```tsx
// packages/gui/src/modes/LoopPlaceholder.tsx
import React from 'react';

import { EmptyState } from './EmptyState';

const STEPS = [
  { n: 'STEP 01', t: '目标', d: '要达成什么，怎样描述才可验' },
  { n: 'STEP 02', t: '验收器', d: '测试通过 / Pro 评分 / 自定义脚本' },
  { n: 'STEP 03', t: '迭代策略', d: '失败证据如何喂回下一轮' },
  { n: 'STEP 04', t: '预算', d: 'N 轮 / M token / ¥X 上限' }
];

export function LoopPlaceholder(): JSX.Element {
  return (
    <EmptyState
      glyph="∞"
      title="Loop Engineering 循环工程"
      desc={
        <>
          Loop = <b>目标 + 验收器 + 迭代策略 + 预算</b>。每轮把上轮失败证据喂回去，直到验收通过或预算耗尽。
          验收默认由 Pro 复核 —— 自己不能给自己打分。创建是<b>引导式</b>的：每步有写作要点、模板预设、AI 辅助润写。
        </>
      }
      tag="P5 · 重点版块"
    >
      <div className="wizard">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.n}>
            {i > 0 && (
              <div className="wz-conn">
                <i />
              </div>
            )}
            <div className="wz-step">
              <span className="n">{s.n}</span>
              <span className="t">{s.t}</span>
              <span className="d">{s.d}</span>
            </div>
          </React.Fragment>
        ))}
      </div>
      <div className="wz-aids">
        <span className="chip">📋 模板预设</span>
        <span className="chip">💡 写作要点</span>
        <span className="chip ai">✦ AI 辅助润写</span>
        <span className="chip">▶ 试运行一轮</span>
      </div>
    </EmptyState>
  );
}
```

- [ ] **Step 4: 移植 CSS** → **Step 5: 跑测试 PASS** → **Step 6: 提交**

```bash
git add packages/gui/src/modes/ packages/gui/src/main.tsx packages/gui/tests/placeholders.test.tsx
git commit -m "feat(gui): empty-state placeholders incl. loop guided-wizard skeleton"
```

### T8：SessionView 静态壳（头部 + 摘要栏 + 空流 + Composer + UsageBar）

**Files:**
- Create: `packages/gui/src/workspace/SessionView.tsx`
- Create: `packages/gui/src/workspace/SummaryBar.tsx`
- Create: `packages/gui/src/workspace/Composer.tsx`
- Create: `packages/gui/src/workspace/UsageBar.tsx`
- Create: `packages/gui/src/workspace/workspace.css`（移植 `.main / .ws-top / .ws-title / .git-chip / .summary-toggle / .summary / .step / .stream / .msg / .card 系列 / .composer* / .chip / .send / .costbar`；main.tsx 加 import）
- Test: `packages/gui/tests/session-view.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
// packages/gui/tests/session-view.test.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { Composer } from '../src/workspace/Composer';
import { SessionView } from '../src/workspace/SessionView';
import { UsageBar } from '../src/workspace/UsageBar';
import { useUiStore } from '../src/store/ui-store';

const initial = useUiStore.getState();

beforeEach(() => {
  useUiStore.setState(initial, true);
});

describe('SessionView 静态壳', () => {
  it('渲染标题与摘要开关，点击展开摘要', () => {
    render(<SessionView title="New Chat" />);
    expect(screen.getByText('New Chat')).toBeTruthy();
    fireEvent.click(screen.getByText(/摘要/));
    expect(useUiStore.getState().summaryOpen).toBe(true);
  });
});

describe('Composer', () => {
  it('输入并发送触发 onSubmit，输入框清空', () => {
    const onSubmit = vi.fn();
    render(<Composer onSubmit={onSubmit} />);
    const box = screen.getByPlaceholderText(/询问或下达任务/);
    fireEvent.change(box, { target: { value: '帮我修个 bug' } });
    fireEvent.click(screen.getByText(/发送/));
    expect(onSubmit).toHaveBeenCalledWith('帮我修个 bug');
    expect((box as HTMLTextAreaElement).value).toBe('');
  });

  it('空输入不触发 onSubmit', () => {
    const onSubmit = vi.fn();
    render(<Composer onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText(/发送/));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('UsageBar', () => {
  it('显示缓存命中率 / tokens / 人民币', () => {
    render(
      <UsageBar usage={{ inputTokens: 8100, outputTokens: 4200, cacheHitRate: 0.92, cny: 0.18 }} />
    );
    expect(screen.getByText(/92%/)).toBeTruthy();
    expect(screen.getByText(/8\.1K/)).toBeTruthy();
    expect(screen.getByText(/¥0\.18/)).toBeTruthy();
  });

  it('无数据时显示 —', () => {
    render(<UsageBar usage={{ inputTokens: 0, outputTokens: 0, cacheHitRate: -1, cny: 0 }} />);
    expect(screen.getByText('—')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 跑测试 FAIL** — Run: `pnpm --filter @bobby/gui test -- session-view`

- [ ] **Step 3: 实现四个组件**

```tsx
// packages/gui/src/workspace/UsageBar.tsx
import React from 'react';

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheHitRate: number; // 0..1；-1 表示暂无数据
  cny: number;
}

function fmtTok(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

export function UsageBar({ usage }: { usage: Usage }): JSX.Element {
  return (
    <div className="costbar">
      <span>
        CACHE <b>{usage.cacheHitRate < 0 ? '—' : `${Math.round(usage.cacheHitRate * 100)}%`}</b>
      </span>
      <span>
        IN {fmtTok(usage.inputTokens)} / OUT {fmtTok(usage.outputTokens)} TOK
      </span>
      <span>
        SESSION ≈ <b>¥{usage.cny.toFixed(2)}</b>
      </span>
    </div>
  );
}
```

```tsx
// packages/gui/src/workspace/Composer.tsx
import React from 'react';

interface ComposerProps {
  onSubmit: (input: string) => void;
  disabled?: boolean;
}

export function Composer({ onSubmit, disabled = false }: ComposerProps): JSX.Element {
  const [input, setInput] = React.useState('');

  const submit = (): void => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setInput('');
  };

  return (
    <div className="composer">
      <textarea
        className="input"
        placeholder="询问或下达任务…　@文件　/命令　粘贴图片"
        value={input}
        disabled={disabled}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <div className="tools">
        <span className="chip mono">@</span>
        <span className="chip mono">/</span>
        <span className="chip">⊞</span>
        <span className="chip model">模型 · Flash ▾</span>
        <span className="chip">权限 · 询问 ▾</span>
        <span className="chip">思考 · 关</span>
        <button className="send" onClick={submit} disabled={disabled}>
          发送 ⏎
        </button>
      </div>
    </div>
  );
}
```

```tsx
// packages/gui/src/workspace/SummaryBar.tsx
import React from 'react';
import type { PlanStep } from '@bobby/shared';

import { useUiStore } from '../store/ui-store';

interface SummaryBarProps {
  steps: PlanStep[];
  currentStepId?: string;
}

export function SummaryBar({ steps, currentStepId }: SummaryBarProps): JSX.Element {
  const open = useUiStore((s) => s.summaryOpen);
  return (
    <div className={`summary ${open ? 'open' : ''}`}>
      {steps.length === 0 && <div className="step">暂无计划 — 任务开始后显示步骤</div>}
      {steps.map((step) => (
        <div key={step.id} className={`step ${step.id === currentStepId ? 'cur' : ''}`}>
          <span className="sn">{step.id === currentStepId ? '●' : '○'}</span>
          {step.desc}
        </div>
      ))}
    </div>
  );
}
```

> `PlanStep` 字段 = `{ id, desc, satisfiesAcIds, dependsOn }`（`packages/shared/src/contracts/plan.ts`）。本组件只消费 `id/desc`。

```tsx
// packages/gui/src/workspace/SessionView.tsx — P0 静态壳；T16 接 store/client
import React from 'react';

import { Composer } from './Composer';
import { SummaryBar } from './SummaryBar';
import { UsageBar } from './UsageBar';
import { useUiStore } from '../store/ui-store';

interface SessionViewProps {
  title: string;
  branch?: string;
}

export function SessionView({ title, branch }: SessionViewProps): JSX.Element {
  const toggleSummary = useUiStore((s) => s.toggleSummary);
  const summaryOpen = useUiStore((s) => s.summaryOpen);

  return (
    <div className="session-view">
      <div className="ws-top">
        <span className="ws-title">{title}</span>
        {branch && <span className="git-chip">⎇ {branch}</span>}
        <button className={`summary-toggle ${summaryOpen ? 'open' : ''}`} onClick={toggleSummary}>
          ▤ 摘要
        </button>
      </div>
      <SummaryBar steps={[]} />
      <div className="stream" />
      <div className="composer-wrap">
        <Composer onSubmit={() => undefined} />
        <UsageBar usage={{ inputTokens: 0, outputTokens: 0, cacheHitRate: -1, cny: 0 }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 移植 CSS（`.session-view` 即 mockup 的工作区列布局：`display:flex;flex-direction:column;flex:1;overflow:hidden`）**
- [ ] **Step 5: 跑测试 PASS** — Run: `pnpm --filter @bobby/gui test -- session-view`
- [ ] **Step 6: 提交**

```bash
git add packages/gui/src/workspace/ packages/gui/src/main.tsx packages/gui/tests/session-view.test.tsx
git commit -m "feat(gui): static session view shell (header/summary/composer/usage bar)"
```

### T9：AppShell 装配 + main.tsx 重写（P0 收口）

**Files:**
- Create: `packages/gui/src/shell/AppShell.tsx`
- Modify: `packages/gui/src/main.tsx`（整文件重写）
- Modify: `packages/gui/src/shell/shell.css`（`.app-grid` 布局）
- Test: `packages/gui/tests/app-shell.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
// packages/gui/tests/app-shell.test.tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { AppShell } from '../src/shell/AppShell';
import { useUiStore } from '../src/store/ui-store';

const initial = useUiStore.getState();

beforeEach(() => {
  useUiStore.setState(initial, true);
});

describe('AppShell', () => {
  it('默认渲染 chat 模式 + 静态会话壳', () => {
    render(<AppShell />);
    expect(screen.getByText('BOBBY')).toBeTruthy();
    expect(screen.getByText('New Chat')).toBeTruthy();
    expect(screen.getByText(/MOCK MODE/)).toBeTruthy();
  });

  it('切到 code 模式点 Loop 显示向导骨架占位页', () => {
    render(<AppShell />);
    fireEvent.click(screen.getByRole('tab', { name: /code/i }));
    fireEvent.click(screen.getByText('Loop Engineering'));
    expect(screen.getByText('验收器')).toBeTruthy();
  });

  it('Settings 视图可达', () => {
    render(<AppShell />);
    fireEvent.click(screen.getByText('Settings'));
    expect(screen.getByText('Settings 设置中心')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 跑测试 FAIL** — Run: `pnpm --filter @bobby/gui test -- app-shell`

- [ ] **Step 3: 实现 AppShell（视图路由 = 状态驱动 switch，无 router）**

```tsx
// packages/gui/src/shell/AppShell.tsx
import React from 'react';

import { EmptyState } from '../modes/EmptyState';
import { LoopPlaceholder } from '../modes/LoopPlaceholder';
import { PLACEHOLDERS } from '../modes/placeholder-config';
import { RightPanel } from '../panels/RightPanel';
import { SessionView } from '../workspace/SessionView';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { TitleBar } from './TitleBar';
import { useUiStore } from '../store/ui-store';

function MainView(): JSX.Element {
  const mode = useUiStore((s) => s.mode);
  const view = useUiStore((s) => s.view);

  if (view === 'session') {
    return mode === 'chat' ? (
      <SessionView title="New Chat" />
    ) : (
      <SessionView title="New Session" branch="main" />
    );
  }
  if (view === 'loop') return <LoopPlaceholder />;
  const ph = PLACEHOLDERS[view];
  return <EmptyState glyph={ph.glyph} title={ph.title} desc={ph.desc} tag={ph.tag} />;
}

export function AppShell(): JSX.Element {
  return (
    <div className="app-grid">
      <TitleBar projectName="bobby" />
      <Sidebar />
      <main className="main">
        <MainView />
      </main>
      <RightPanel />
      <StatusBar kernelConnected model="FLASH" contextPct={0} mock />
    </div>
  );
}
```

- [ ] **Step 4: 重写 main.tsx（保留全部 import 的 css/字体；删除 TopNav/Screen 路由；不再 import 旧 screens）**

```tsx
// packages/gui/src/main.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import './lib/theme.css';
import './shell/shell.css';
import './panels/panels.css';
import './modes/modes.css';
import './workspace/workspace.css';
import './app.css';

import { AppShell } from './shell/AppShell';

const root = document.getElementById('root');

if (root) {
  createRoot(root).render(<AppShell />);
}
```

`.app-grid`（shell.css 新增）：

```css
.app-grid {
  height: 100vh;
  display: grid;
  grid-template-rows: 44px 1fr 26px;
  grid-template-columns: 280px 1fr auto;
  grid-template-areas:
    'title title title'
    'side  main  right'
    'status status status';
  overflow: hidden;
}
.app-grid > .titlebar { grid-area: title; }
.app-grid > .side { grid-area: side; }
.app-grid > .main { grid-area: main; display: flex; flex-direction: column; overflow: hidden; }
.app-grid > .right { grid-area: right; }
.app-grid > .status { grid-area: status; }
```

- [ ] **Step 5: 全量验证**

Run: `pnpm --filter @bobby/gui test && pnpm --filter @bobby/gui typecheck && pnpm lint && pnpm -r build`
Expected: 全绿。注意：旧 screens 文件保留但 main.tsx 不再引用 —— 若 lint 报 unused，**不许删 screens 文件**，在该文件顶部现有 import 不动的前提下确认 eslint 对未引用文件不报错（eslint 只查被引用文件的话自然通过；若全量扫描报错，把旧 screens 的处置上报总工程师裁决，不要自作主张）。

- [ ] **Step 6: 提交**

```bash
git add packages/gui/src/shell/AppShell.tsx packages/gui/src/main.tsx packages/gui/src/shell/shell.css packages/gui/tests/app-shell.test.tsx
git commit -m "feat(gui): assemble five-region app shell, replace top-nav layout"
```

### 2.10 P0 验收清单（总工程师亲自执行）

命令验收（全部真实输出）：

- [ ] `pnpm --filter @bobby/gui test` 全绿（含既有 9 个测试文件 + P0 新增 8 个）
- [ ] `pnpm lint` 0 警告；`pnpm -r build` 成功；`pnpm --filter @bobby/gui typecheck` 通过

浏览器演练（`pnpm --filter @bobby/gui dev` → http://localhost:5173）：

- [ ] 外观与 mockup 一致：深色 Deep Glow、玻璃面板、青色辉光、Chakra Petch 品牌字（对照 mockup 同屏比对）
- [ ] 分段切换器：Chat ↔ Code 滑块动画、Code 角标可见；切换后侧边栏功能项与列表随之变化
- [ ] Chat 模式 4 个功能项、Code 模式 4 个功能项全部可点，各自显示占位页或会话壳；Loop 占位页有四步向导骨架
- [ ] 右侧面板 4 个 tab 可切换（下划线滑动），折叠按钮可收起/展开
- [ ] 摘要栏开关可用；Composer 可输入（发送无后果，P1 接通）；UsageBar 显示 `CACHE — · 0 TOK · ¥0.00`
- [ ] 底部 Settings 可达；状态栏显示 `KERNEL CONNECTED / DEEPSEEK · FLASH / CTX 0% / MOCK MODE`

---

## 3. P1 工单：Mock 数据流（T10–T17）

> P1 完成形态：浏览器（无 Electron、无 kernel、无 key）走完 `code-gate-evidence` 剧本全流程：发任务 → 计划出现在摘要栏 → 工具卡 → 闸口卡（允许/拒绝）→ 证据卡 → Pro 复核 verdict → 完成；侧边栏列表与右侧审查面板均为 mock 数据驱动。

### T10：KernelClient 接口（UI 的唯一后端契约）

**Files:**
- Create: `packages/gui/src/kernel/client.ts`
- Test: `packages/gui/tests/kernel-client-types.test.ts`

- [ ] **Step 1: 写测试（类型 + 纯函数）**

```ts
// packages/gui/tests/kernel-client-types.test.ts
import { describe, expect, it } from 'vitest';

import { emptyUsage, addUsage } from '../src/kernel/client';

describe('usage 工具函数', () => {
  it('emptyUsage 缓存命中率为 -1（无数据）', () => {
    expect(emptyUsage().cacheHitRate).toBe(-1);
  });

  it('addUsage 累计 token 与费用，取最新命中率', () => {
    const merged = addUsage(
      { inputTokens: 100, outputTokens: 50, cacheHitRate: 0.5, cny: 0.01 },
      { inputTokens: 200, outputTokens: 100, cacheHitRate: 0.9, cny: 0.02 }
    );
    expect(merged).toEqual({ inputTokens: 300, outputTokens: 150, cacheHitRate: 0.9, cny: 0.03 });
  });
});
```

- [ ] **Step 2: 跑测试 FAIL** → **Step 3: 实现**

```ts
// packages/gui/src/kernel/client.ts
import type { KernelEvent } from '@bobby/shared';

export type SessionMode = 'chat' | 'code';
export type SessionStatus = 'idle' | 'running' | 'gate' | 'done' | 'failed';

export interface SessionMeta {
  id: string;
  mode: SessionMode;
  title: string;
  /** chat: Project 名；code: 仓库名。无归属为 undefined */
  project?: string;
  /** code 模式 git 分支 */
  branch?: string;
  pinned: boolean;
  status: SessionStatus;
  updatedAt: string; // ISO 8601
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  /** 0..1；-1 = 暂无数据 */
  cacheHitRate: number;
  cny: number;
}

export function emptyUsage(): Usage {
  return { inputTokens: 0, outputTokens: 0, cacheHitRate: -1, cny: 0 };
}

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheHitRate: b.cacheHitRate >= 0 ? b.cacheHitRate : a.cacheHitRate,
    cny: Number((a.cny + b.cny).toFixed(4))
  };
}

/** GUI 层事件信封：kernel 事件 + GUI 专属增量（用量/会话元数据） */
export type GuiEvent =
  | { kind: 'kernel'; sessionId: string; event: KernelEvent }
  | { kind: 'usage'; sessionId: string; usage: Usage }
  | { kind: 'session_meta'; session: SessionMeta };

export interface KernelClient {
  listSessions(mode: SessionMode): Promise<SessionMeta[]>;
  createSession(mode: SessionMode): Promise<SessionMeta>;
  startTask(sessionId: string, input: string): Promise<void>;
  approveGate(sessionId: string, gateId: string, decision: 'allow' | 'deny'): Promise<void>;
  /** 订阅全部会话的事件流；返回退订函数 */
  onEvent(cb: (e: GuiEvent) => void): () => void;
}
```

- [ ] **Step 4: 跑测试 PASS + typecheck** → **Step 5: 提交**

```bash
git add packages/gui/src/kernel/client.ts packages/gui/tests/kernel-client-types.test.ts
git commit -m "feat(gui): KernelClient interface + GuiEvent envelope + usage helpers"
```

> 同步删除约定：T8 的 `UsageBar.tsx` 里临时定义了 `Usage` 接口 —— 本 Task **顺带**把 `workspace/UsageBar.tsx` 的本地 `Usage` 改为 `import type { Usage } from '../kernel/client';`（属声明文件范围内，允许）。

### T11：剧本 fixtures（4 套）

**Files:**
- Create: `packages/gui/src/kernel/mock/fixtures.ts`
- Test: `packages/gui/tests/fixtures.test.ts`

剧本数据结构与 4 套剧本（**完整照抄**，事件 payload 必须能通过 `KernelEventSchema.parse`）：

- [ ] **Step 1: 写失败测试**

```ts
// packages/gui/tests/fixtures.test.ts
import { describe, expect, it } from 'vitest';
import { KernelEventSchema } from '@bobby/shared';

import { FIXTURES } from '../src/kernel/mock/fixtures';

describe('mock fixtures', () => {
  it('包含 4 套剧本', () => {
    expect(Object.keys(FIXTURES)).toEqual([
      'chat-basic',
      'code-gate-evidence',
      'loop-converge',
      'multi-session'
    ]);
  });

  it('所有 kernel 步骤事件通过 shared schema 校验', () => {
    for (const script of Object.values(FIXTURES)) {
      for (const step of script.steps) {
        if (step.emit.kind === 'kernel') {
          expect(() => KernelEventSchema.parse(step.emit.event)).not.toThrow();
        }
      }
    }
  });

  it('code-gate-evidence 含一次 gate_request 且其后存在 evidence_produced', () => {
    const steps = FIXTURES['code-gate-evidence'].steps;
    const gateIdx = steps.findIndex(
      (s) => s.emit.kind === 'kernel' && s.emit.event.type === 'gate_request'
    );
    const evidenceIdx = steps.findIndex(
      (s) => s.emit.kind === 'kernel' && s.emit.event.type === 'evidence_produced'
    );
    expect(gateIdx).toBeGreaterThan(-1);
    expect(evidenceIdx).toBeGreaterThan(gateIdx);
  });
});
```

- [ ] **Step 2: 跑测试 FAIL** → **Step 3: 实现 fixtures**

```ts
// packages/gui/src/kernel/mock/fixtures.ts
import type { KernelEvent } from '@bobby/shared';

import type { SessionMeta, Usage } from '../client';

export interface ScriptStep {
  afterMs: number;
  emit:
    | { kind: 'kernel'; event: KernelEvent }
    | { kind: 'usage'; usage: Usage };
}

export interface SessionScript {
  meta: SessionMeta;
  steps: ScriptStep[];
  /** multi-session 用：不播剧本、只提供列表条目 */
  listOnly?: boolean;
}

const k = (event: KernelEvent): ScriptStep['emit'] => ({ kind: 'kernel', event });
const u = (usage: Usage): ScriptStep['emit'] => ({ kind: 'usage', usage });

const chatBasic: SessionScript = {
  meta: {
    id: 'chat-basic',
    mode: 'chat',
    title: 'New Chat',
    pinned: false,
    status: 'idle',
    updatedAt: '2026-06-13T10:00:00.000Z'
  },
  steps: [
    {
      afterMs: 400,
      emit: k({
        type: 'direct_answer',
        taskId: 't-chat-1',
        text: 'pnpm workspace 的依赖提升由 .npmrc 的 shamefully-hoist 与 public-hoist-pattern 控制……（mock 回答）'
      })
    },
    {
      afterMs: 200,
      emit: u({ inputTokens: 850, outputTokens: 420, cacheHitRate: 0.62, cny: 0.01 })
    },
    { afterMs: 100, emit: k({ type: 'final_result', taskId: 't-chat-1', status: 'done' }) }
  ]
};

const codeGateEvidence: SessionScript = {
  meta: {
    id: 'code-gate',
    mode: 'code',
    title: '修复 updater 校验失败',
    project: 'bobby',
    branch: 'fix/updater-sig',
    pinned: false,
    status: 'idle',
    updatedAt: '2026-06-13T11:00:00.000Z'
  },
  steps: [
    {
      afterMs: 300,
      emit: k({
        type: 'plan_ready',
        taskId: 't-code-1',
        steps: [
          { id: 's1', desc: '复现校验失败并取证', satisfiesAcIds: ['ac1'], dependsOn: [] },
          { id: 's2', desc: '定位 latest.yml 签名字段缺失', satisfiesAcIds: ['ac1'], dependsOn: ['s1'] },
          { id: 's3', desc: '修改 electron-builder.yml 并重新打包验证', satisfiesAcIds: ['ac1', 'ac2'], dependsOn: ['s2'] },
          { id: 's4', desc: 'Pro 复核 + 产出证据报告', satisfiesAcIds: ['ac1'], dependsOn: ['s3'] }
        ]
      })
    },
    { afterMs: 200, emit: k({ type: 'step_started', taskId: 't-code-1', stepId: 's1' }) },
    { afterMs: 300, emit: k({ type: 'tool_called', taskId: 't-code-1', stepId: 's1', tool: 'read_file' }) },
    { afterMs: 400, emit: k({ type: 'step_started', taskId: 't-code-1', stepId: 's3' }) },
    {
      afterMs: 300,
      emit: k({
        type: 'gate_request',
        taskId: 't-code-1',
        gateId: 'g1',
        reason: '修改 packages/gui/electron-builder.yml（+3 −1）并执行 pnpm --filter @bobby/gui package'
      })
    },
    // —— MockKernelClient 在 gate_request 处暂停，approveGate('allow') 后才继续 ——
    {
      afterMs: 500,
      emit: k({
        type: 'evidence_produced',
        taskId: 't-code-1',
        evidence: {
          claimId: 'c1',
          acId: 'ac1',
          evidenceType: 'command_output',
          payload: { command: 'pnpm --filter @bobby/gui package', exitCode: 0, stdout: '✓ built in 42.3s · latest.yml sha512 字段已生成' },
          producedBy: 'tool'
        }
      })
    },
    {
      afterMs: 300,
      emit: k({
        type: 'evidence_produced',
        taskId: 't-code-1',
        evidence: {
          claimId: 'c1',
          acId: 'ac2',
          evidenceType: 'file_diff',
          payload: { path: 'packages/gui/electron-builder.yml', plus: 3, minus: 1, diff: '+ generateUpdatesFilesForAllChannels: true\n+ verifyUpdateCodeSignature: true' },
          producedBy: 'tool'
        }
      })
    },
    {
      afterMs: 400,
      emit: k({
        type: 'verdict',
        taskId: 't-code-1',
        verdict: { claimId: 'c1', acId: 'ac1', result: 'pass', oracleTier: 'T2', detail: 'Pro 复核：sha512 校验链完整' }
      })
    },
    { afterMs: 200, emit: u({ inputTokens: 8100, outputTokens: 4200, cacheHitRate: 0.92, cny: 0.18 }) },
    { afterMs: 100, emit: k({ type: 'final_result', taskId: 't-code-1', status: 'done' }) }
  ]
};

const loopConverge: SessionScript = {
  meta: {
    id: 'loop-converge',
    mode: 'code',
    title: 'Loop: 单测覆盖率达到 90%',
    project: 'bobby',
    branch: 'loop/coverage',
    pinned: false,
    status: 'idle',
    updatedAt: '2026-06-13T09:00:00.000Z'
  },
  steps: [
    { afterMs: 200, emit: k({ type: 'step_started', taskId: 't-loop-1', stepId: 'iter-1' }) },
    {
      afterMs: 300,
      emit: k({
        type: 'verdict',
        taskId: 't-loop-1',
        verdict: { claimId: 'lc1', acId: 'cov', result: 'fail', oracleTier: 'T1', detail: '第 1 轮：覆盖率 71% < 90%' }
      })
    },
    { afterMs: 200, emit: k({ type: 'step_started', taskId: 't-loop-1', stepId: 'iter-2' }) },
    {
      afterMs: 300,
      emit: k({
        type: 'verdict',
        taskId: 't-loop-1',
        verdict: { claimId: 'lc1', acId: 'cov', result: 'fail', oracleTier: 'T1', detail: '第 2 轮：覆盖率 84% < 90%' }
      })
    },
    { afterMs: 200, emit: k({ type: 'step_started', taskId: 't-loop-1', stepId: 'iter-3' }) },
    {
      afterMs: 300,
      emit: k({
        type: 'verdict',
        taskId: 't-loop-1',
        verdict: { claimId: 'lc1', acId: 'cov', result: 'pass', oracleTier: 'T1', detail: '第 3 轮：覆盖率 92% ≥ 90%，收敛' }
      })
    },
    { afterMs: 200, emit: u({ inputTokens: 21000, outputTokens: 9800, cacheHitRate: 0.88, cny: 0.46 }) },
    { afterMs: 100, emit: k({ type: 'final_result', taskId: 't-loop-1', status: 'done' }) }
  ]
};

const multiSession: SessionScript = {
  meta: {
    id: 'multi-1',
    mode: 'code',
    title: 'kernel 事件总线单测补全',
    project: 'bobby',
    branch: 'main',
    pinned: false,
    status: 'done',
    updatedAt: '2026-06-13T03:20:00.000Z'
  },
  steps: [],
  listOnly: true
};

export const FIXTURES: Record<string, SessionScript> = {
  'chat-basic': chatBasic,
  'code-gate-evidence': codeGateEvidence,
  'loop-converge': loopConverge,
  'multi-session': multiSession
};
```

> `PlanStep` 真实字段 = `{ id, desc, satisfiesAcIds, dependsOn }`（见 `packages/shared/src/contracts/plan.ts`），上面剧本已按真实 schema 写好；fixtures 测试里的 `KernelEventSchema.parse` 会兜底验证。

- [ ] **Step 4: 跑测试 PASS** → **Step 5: 提交**

```bash
git add packages/gui/src/kernel/mock/fixtures.ts packages/gui/tests/fixtures.test.ts
git commit -m "feat(gui): four mock session scripts validated against shared schema"
```

### T12：MockKernelClient（剧本播放器）

**Files:**
- Create: `packages/gui/src/kernel/mock/mock-client.ts`
- Create: `packages/gui/src/kernel/index.ts`（client 单例解析）
- Test: `packages/gui/tests/mock-client.test.ts`

- [ ] **Step 1: 写失败测试（核心：gate 暂停/恢复语义）**

```ts
// packages/gui/tests/mock-client.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FIXTURES } from '../src/kernel/mock/fixtures';
import { MockKernelClient } from '../src/kernel/mock/mock-client';
import type { GuiEvent } from '../src/kernel/client';

describe('MockKernelClient', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function collect(client: MockKernelClient): GuiEvent[] {
    const events: GuiEvent[] = [];
    client.onEvent((e) => events.push(e));
    return events;
  }

  it('listSessions 按模式过滤', async () => {
    const client = new MockKernelClient(FIXTURES);
    const chat = await client.listSessions('chat');
    const code = await client.listSessions('code');
    expect(chat.map((s) => s.id)).toEqual(['chat-basic']);
    expect(code.map((s) => s.id).sort()).toEqual(['code-gate', 'loop-converge', 'multi-1']);
  });

  it('startTask 顺序播放剧本直到 gate_request 暂停', async () => {
    const client = new MockKernelClient(FIXTURES);
    const events = collect(client);
    await client.startTask('code-gate', '修一下');
    await vi.advanceTimersByTimeAsync(60_000);

    const kernelTypes = events
      .filter((e): e is Extract<GuiEvent, { kind: 'kernel' }> => e.kind === 'kernel')
      .map((e) => e.event.type);
    expect(kernelTypes).toEqual(['plan_ready', 'step_started', 'tool_called', 'step_started', 'gate_request']);
  });

  it('approveGate(allow) 后继续播完：证据→verdict→usage→final', async () => {
    const client = new MockKernelClient(FIXTURES);
    const events = collect(client);
    await client.startTask('code-gate', '修一下');
    await vi.advanceTimersByTimeAsync(60_000);
    await client.approveGate('code-gate', 'g1', 'allow');
    await vi.advanceTimersByTimeAsync(60_000);

    const types = events.map((e) => (e.kind === 'kernel' ? e.event.type : e.kind));
    expect(types).toContain('evidence_produced');
    expect(types).toContain('verdict');
    expect(types).toContain('usage');
    expect(types[types.length - 1]).toBe('final_result');
  });

  it('approveGate(deny) 直接产出 blocked 终态，不再播剩余步骤', async () => {
    const client = new MockKernelClient(FIXTURES);
    const events = collect(client);
    await client.startTask('code-gate', '修一下');
    await vi.advanceTimersByTimeAsync(60_000);
    await client.approveGate('code-gate', 'g1', 'deny');
    await vi.advanceTimersByTimeAsync(60_000);

    const kernelEvents = events.filter(
      (e): e is Extract<GuiEvent, { kind: 'kernel' }> => e.kind === 'kernel'
    );
    const last = kernelEvents[kernelEvents.length - 1];
    expect(last.event).toMatchObject({ type: 'final_result', status: 'blocked' });
    expect(kernelEvents.some((e) => e.event.type === 'evidence_produced')).toBe(false);
  });

  it('createSession 返回新会话并出现在 listSessions', async () => {
    const client = new MockKernelClient(FIXTURES);
    const created = await client.createSession('chat');
    const chat = await client.listSessions('chat');
    expect(chat.some((s) => s.id === created.id)).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试 FAIL** → **Step 3: 实现**

```ts
// packages/gui/src/kernel/mock/mock-client.ts
import type { GuiEvent, KernelClient, SessionMeta, SessionMode } from '../client';
import type { SessionScript } from './fixtures';

export class MockKernelClient implements KernelClient {
  private listeners = new Set<(e: GuiEvent) => void>();
  private scripts: Map<string, SessionScript>;
  private extraSessions: SessionMeta[] = [];
  /** sessionId → 暂停点恢复函数 */
  private paused = new Map<string, { taskId: string; resume: () => void }>();
  private seq = 0;

  constructor(fixtures: Record<string, SessionScript>) {
    this.scripts = new Map(Object.entries(fixtures).map(([, s]) => [s.meta.id, s]));
  }

  async listSessions(mode: SessionMode): Promise<SessionMeta[]> {
    const fromScripts = [...this.scripts.values()].map((s) => s.meta);
    return [...fromScripts, ...this.extraSessions].filter((m) => m.mode === mode);
  }

  async createSession(mode: SessionMode): Promise<SessionMeta> {
    this.seq += 1;
    const meta: SessionMeta = {
      id: `new-${this.seq}`,
      mode,
      title: mode === 'chat' ? 'New Chat' : 'New Session',
      pinned: false,
      status: 'idle',
      updatedAt: new Date().toISOString()
    };
    this.extraSessions.push(meta);
    this.emit({ kind: 'session_meta', session: meta });
    return meta;
  }

  async startTask(sessionId: string, _input: string): Promise<void> {
    const script = this.scripts.get(sessionId);
    if (!script || script.listOnly) return; // 新建会话/listOnly 会话没有剧本：静默
    this.playFrom(sessionId, script, 0);
  }

  async approveGate(sessionId: string, _gateId: string, decision: 'allow' | 'deny'): Promise<void> {
    const pause = this.paused.get(sessionId);
    if (!pause) return;
    this.paused.delete(sessionId);
    if (decision === 'allow') {
      pause.resume();
      return;
    }
    this.emit({
      kind: 'kernel',
      sessionId,
      event: { type: 'final_result', taskId: pause.taskId, status: 'blocked' }
    });
  }

  onEvent(cb: (e: GuiEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(e: GuiEvent): void {
    for (const cb of this.listeners) cb(e);
  }

  private playFrom(sessionId: string, script: SessionScript, index: number): void {
    if (index >= script.steps.length) return;
    const step = script.steps[index];
    setTimeout(() => {
      if (step.emit.kind === 'kernel') {
        this.emit({ kind: 'kernel', sessionId, event: step.emit.event });
        if (step.emit.event.type === 'gate_request') {
          const taskId = step.emit.event.taskId;
          this.paused.set(sessionId, {
            taskId,
            resume: () => this.playFrom(sessionId, script, index + 1)
          });
          return; // 暂停：等 approveGate
        }
      } else {
        this.emit({ kind: 'usage', sessionId, usage: step.emit.usage });
      }
      this.playFrom(sessionId, script, index + 1);
    }, step.afterMs);
  }
}
```

```ts
// packages/gui/src/kernel/index.ts — client 单例。P1 一律 mock；P2 在此加 IPC 解析
import { FIXTURES } from './mock/fixtures';
import { MockKernelClient } from './mock/mock-client';
import type { KernelClient } from './client';

let client: KernelClient | null = null;

export function getKernelClient(): KernelClient {
  if (!client) {
    client = new MockKernelClient(FIXTURES);
  }
  return client;
}

/** 测试注入用 */
export function setKernelClient(next: KernelClient | null): void {
  client = next;
}
```

- [ ] **Step 4: 跑测试 PASS**（5 个用例）→ **Step 5: 提交**

```bash
git add packages/gui/src/kernel/ packages/gui/tests/mock-client.test.ts
git commit -m "feat(gui): MockKernelClient script player with gate pause/resume"
```

### T13：session-store（事件 → 状态）

**Files:**
- Create: `packages/gui/src/store/session-store.ts`
- Test: `packages/gui/tests/session-store.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// packages/gui/tests/session-store.test.ts
import { beforeEach, describe, expect, it } from 'vitest';

import { useSessionStore } from '../src/store/session-store';

const initial = useSessionStore.getState();

beforeEach(() => {
  useSessionStore.setState(initial, true);
});

describe('session-store', () => {
  it('addUserMessage 追加用户消息并置状态 running', () => {
    useSessionStore.getState().addUserMessage('s1', '修一下 bug');
    const s = useSessionStore.getState();
    expect(s.timelines['s1']).toEqual([{ kind: 'user', text: '修一下 bug' }]);
  });

  it('gate_request 事件登记 pendingGate；final_result 清除并记终态', () => {
    const apply = useSessionStore.getState().applyGuiEvent;
    apply({
      kind: 'kernel',
      sessionId: 's1',
      event: { type: 'gate_request', taskId: 't1', gateId: 'g1', reason: '要写文件' }
    });
    expect(useSessionStore.getState().pendingGates['s1']).toEqual({ gateId: 'g1', reason: '要写文件' });

    apply({
      kind: 'kernel',
      sessionId: 's1',
      event: { type: 'final_result', taskId: 't1', status: 'done' }
    });
    const s = useSessionStore.getState();
    expect(s.pendingGates['s1']).toBeUndefined();
    expect(s.statuses['s1']).toBe('done');
  });

  it('usage 事件累计用量', () => {
    const apply = useSessionStore.getState().applyGuiEvent;
    apply({ kind: 'usage', sessionId: 's1', usage: { inputTokens: 100, outputTokens: 50, cacheHitRate: 0.5, cny: 0.01 } });
    apply({ kind: 'usage', sessionId: 's1', usage: { inputTokens: 100, outputTokens: 50, cacheHitRate: 0.9, cny: 0.01 } });
    expect(useSessionStore.getState().usages['s1']).toEqual({
      inputTokens: 200,
      outputTokens: 100,
      cacheHitRate: 0.9,
      cny: 0.02
    });
  });

  it('kernel 事件进入 timeline；plan_ready 记录计划，step_started 记录当前步骤', () => {
    const apply = useSessionStore.getState().applyGuiEvent;
    apply({
      kind: 'kernel',
      sessionId: 's1',
      event: { type: 'step_started', taskId: 't1', stepId: 's-3' }
    });
    const s = useSessionStore.getState();
    expect(s.timelines['s1'].length).toBe(1);
    expect(s.currentStepIds['s1']).toBe('s-3');
  });
});
```

- [ ] **Step 2: 跑测试 FAIL** → **Step 3: 实现**

```ts
// packages/gui/src/store/session-store.ts
import { create } from 'zustand';
import type { KernelEvent, PlanStep } from '@bobby/shared';

import { addUsage, emptyUsage } from '../kernel/client';
import type { GuiEvent, SessionMeta, SessionStatus, Usage } from '../kernel/client';

export type TimelineItem =
  | { kind: 'user'; text: string }
  | { kind: 'kernel'; event: KernelEvent };

interface SessionState {
  sessions: Record<string, SessionMeta>;
  timelines: Record<string, TimelineItem[]>;
  usages: Record<string, Usage>;
  plans: Record<string, PlanStep[]>;
  currentStepIds: Record<string, string>;
  pendingGates: Record<string, { gateId: string; reason: string } | undefined>;
  statuses: Record<string, SessionStatus>;
  activeSessionId?: string;
  setSessions: (list: SessionMeta[]) => void;
  setActiveSession: (id: string) => void;
  addUserMessage: (sessionId: string, text: string) => void;
  applyGuiEvent: (e: GuiEvent) => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  sessions: {},
  timelines: {},
  usages: {},
  plans: {},
  currentStepIds: {},
  pendingGates: {},
  statuses: {},
  activeSessionId: undefined,

  setSessions: (list) =>
    set((s) => ({
      sessions: { ...s.sessions, ...Object.fromEntries(list.map((m) => [m.id, m])) }
    })),

  setActiveSession: (id) => set({ activeSessionId: id }),

  addUserMessage: (sessionId, text) =>
    set((s) => ({
      timelines: {
        ...s.timelines,
        [sessionId]: [...(s.timelines[sessionId] ?? []), { kind: 'user', text }]
      },
      statuses: { ...s.statuses, [sessionId]: 'running' }
    })),

  applyGuiEvent: (e) =>
    set((s) => {
      if (e.kind === 'session_meta') {
        return { sessions: { ...s.sessions, [e.session.id]: e.session } };
      }
      if (e.kind === 'usage') {
        const prev = s.usages[e.sessionId] ?? emptyUsage();
        return { usages: { ...s.usages, [e.sessionId]: addUsage(prev, e.usage) } };
      }
      const { sessionId, event } = e;
      const next: Partial<SessionState> = {
        timelines: {
          ...s.timelines,
          [sessionId]: [...(s.timelines[sessionId] ?? []), { kind: 'kernel', event }]
        }
      };
      if (event.type === 'plan_ready') {
        next.plans = { ...s.plans, [sessionId]: event.steps };
      }
      if (event.type === 'step_started') {
        next.currentStepIds = { ...s.currentStepIds, [sessionId]: event.stepId };
      }
      if (event.type === 'gate_request') {
        next.pendingGates = { ...s.pendingGates, [sessionId]: { gateId: event.gateId, reason: event.reason } };
        next.statuses = { ...s.statuses, [sessionId]: 'gate' };
      }
      if (event.type === 'final_result') {
        next.pendingGates = { ...s.pendingGates, [sessionId]: undefined };
        next.statuses = {
          ...s.statuses,
          [sessionId]: event.status === 'done' ? 'done' : 'failed'
        };
      }
      return next;
    })
}));
```

- [ ] **Step 4: 跑测试 PASS** → **Step 5: 提交**

```bash
git add packages/gui/src/store/session-store.ts packages/gui/tests/session-store.test.ts
git commit -m "feat(gui): session-store mapping GuiEvent stream to UI state"
```

### T14：Timeline 卡片组件（消息 / 工具 / 闸口 / 证据 / 复核）

**Files:**
- Create: `packages/gui/src/workspace/TimelineCards.tsx`
- Modify: `packages/gui/src/workspace/workspace.css`（卡片样式已在 T8 移植，本 Task 补 `.card.verdict`：复用 `.card.evid` 规则、左侧条颜色 `var(--blue)`）
- Test: `packages/gui/tests/timeline-cards.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
// packages/gui/tests/timeline-cards.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { TimelineCard } from '../src/workspace/TimelineCards';

describe('TimelineCard', () => {
  it('用户消息右侧气泡', () => {
    render(<TimelineCard item={{ kind: 'user', text: '你好' }} onGateDecision={vi.fn()} />);
    expect(screen.getByText('你好').className).toContain('user');
  });

  it('gate_request 渲染审批卡，点允许回调 allow', () => {
    const onDecide = vi.fn();
    render(
      <TimelineCard
        item={{
          kind: 'kernel',
          event: { type: 'gate_request', taskId: 't1', gateId: 'g1', reason: '要执行打包命令' }
        }}
        onGateDecision={onDecide}
        gatePending
      />
    );
    expect(screen.getByText(/要执行打包命令/)).toBeTruthy();
    fireEvent.click(screen.getByText('允许'));
    expect(onDecide).toHaveBeenCalledWith('g1', 'allow');
  });

  it('已决策的 gate 卡不再显示按钮', () => {
    render(
      <TimelineCard
        item={{
          kind: 'kernel',
          event: { type: 'gate_request', taskId: 't1', gateId: 'g1', reason: 'x' }
        }}
        onGateDecision={vi.fn()}
        gatePending={false}
      />
    );
    expect(screen.queryByText('允许')).toBeNull();
  });

  it('evidence_produced 渲染证据卡（类型 + payload 摘要）', () => {
    render(
      <TimelineCard
        item={{
          kind: 'kernel',
          event: {
            type: 'evidence_produced',
            taskId: 't1',
            evidence: {
              claimId: 'c1',
              acId: 'a1',
              evidenceType: 'command_output',
              payload: { stdout: '✓ built in 42.3s' },
              producedBy: 'tool'
            }
          }
        }}
        onGateDecision={vi.fn()}
      />
    );
    expect(screen.getByText(/command_output/)).toBeTruthy();
    expect(screen.getByText(/built in 42.3s/)).toBeTruthy();
  });

  it('verdict 渲染复核卡', () => {
    render(
      <TimelineCard
        item={{
          kind: 'kernel',
          event: {
            type: 'verdict',
            taskId: 't1',
            verdict: { claimId: 'c1', acId: 'a1', result: 'pass', oracleTier: 'T2', detail: 'Pro 复核通过' }
          }
        }}
        onGateDecision={vi.fn()}
      />
    );
    expect(screen.getByText(/Pro 复核通过/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: 跑测试 FAIL** → **Step 3: 实现（DOM/class 对照 mockup 卡片区）**

```tsx
// packages/gui/src/workspace/TimelineCards.tsx
import React from 'react';

import type { TimelineItem } from '../store/session-store';

interface TimelineCardProps {
  item: TimelineItem;
  onGateDecision: (gateId: string, decision: 'allow' | 'deny') => void;
  /** 该 gate 是否仍在等待决策（已决策则隐藏按钮显示结果行） */
  gatePending?: boolean;
}

export function TimelineCard({ item, onGateDecision, gatePending = false }: TimelineCardProps): JSX.Element | null {
  if (item.kind === 'user') {
    return <div className="msg user">{item.text}</div>;
  }

  const ev = item.event;

  if (ev.type === 'direct_answer') return <div className="msg bot">{ev.text}</div>;

  if (ev.type === 'tool_called') {
    return (
      <div className="card tool">
        <div className="ch">
          ⚙ 工具调用 <span className="tag">{ev.tool}</span>
        </div>
      </div>
    );
  }

  if (ev.type === 'gate_request') {
    return (
      <div className="card gate">
        <div className="ch">
          ⛔ 闸口审批 <span className="tag">gate</span>
        </div>
        <pre>{ev.reason}</pre>
        {gatePending ? (
          <div className="gate-btns">
            <button className="allow" onClick={() => onGateDecision(ev.gateId, 'allow')}>允许</button>
            <button className="deny" onClick={() => onGateDecision(ev.gateId, 'deny')}>拒绝</button>
          </div>
        ) : (
          <div className="gate-done" style={{ display: 'block' }}>✓ 已决策 · 已记录</div>
        )}
      </div>
    );
  }

  if (ev.type === 'evidence_produced') {
    return (
      <div className="card evid">
        <div className="ch">
          ◈ 证据 <span className="tag">{ev.evidence.evidenceType}</span>
        </div>
        <pre>{JSON.stringify(ev.evidence.payload, null, 2)}</pre>
      </div>
    );
  }

  if (ev.type === 'verdict') {
    return (
      <div className="card verdict">
        <div className="ch">
          🛡 复核 <span className="tag">{ev.verdict.oracleTier}</span>
          <span className="tag">{ev.verdict.result}</span>
        </div>
        {ev.verdict.detail && <pre>{ev.verdict.detail}</pre>}
      </div>
    );
  }

  if (ev.type === 'error') {
    return (
      <div className="card gate">
        <div className="ch">⚠ 错误</div>
        <pre>{ev.message}</pre>
      </div>
    );
  }

  // plan_ready / step_started / final_result / intent_proposed 不在流中渲染卡片
  // （plan 走摘要栏，final 走状态点）
  return null;
}
```

- [ ] **Step 4: 跑测试 PASS** → **Step 5: 提交**

```bash
git add packages/gui/src/workspace/TimelineCards.tsx packages/gui/src/workspace/workspace.css packages/gui/tests/timeline-cards.test.tsx
git commit -m "feat(gui): timeline cards for messages, tools, gates, evidence, verdicts"
```

### T15：SessionView 接通 store + client（活的会话视图）

**Files:**
- Modify: `packages/gui/src/workspace/SessionView.tsx`（整文件重写）
- Test: `packages/gui/tests/session-view-live.test.tsx`（新文件；T8 的 session-view.test.tsx 中 SessionView 用例同步更新 props）

- [ ] **Step 1: 写失败测试**

```tsx
// packages/gui/tests/session-view-live.test.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { SessionView } from '../src/workspace/SessionView';
import { setKernelClient } from '../src/kernel';
import { useSessionStore } from '../src/store/session-store';
import type { KernelClient } from '../src/kernel/client';

const initialSession = useSessionStore.getState();

function stubClient(overrides: Partial<KernelClient> = {}): KernelClient {
  return {
    listSessions: vi.fn(async () => []),
    createSession: vi.fn(async () => ({
      id: 'x', mode: 'chat' as const, title: 'New Chat', pinned: false,
      status: 'idle' as const, updatedAt: ''
    })),
    startTask: vi.fn(async () => undefined),
    approveGate: vi.fn(async () => undefined),
    onEvent: vi.fn(() => () => undefined),
    ...overrides
  };
}

beforeEach(() => {
  useSessionStore.setState(initialSession, true);
  setKernelClient(null);
});

describe('SessionView（live）', () => {
  it('发送输入：先进 timeline 再调 client.startTask', async () => {
    const client = stubClient();
    setKernelClient(client);
    useSessionStore.getState().setSessions([
      { id: 's1', mode: 'code', title: '修复 updater', branch: 'fix/u', pinned: false, status: 'idle', updatedAt: '' }
    ]);
    render(<SessionView sessionId="s1" />);
    fireEvent.change(screen.getByPlaceholderText(/询问或下达任务/), { target: { value: '开始吧' } });
    fireEvent.click(screen.getByText(/发送/));
    expect(useSessionStore.getState().timelines['s1'][0]).toEqual({ kind: 'user', text: '开始吧' });
    expect(client.startTask).toHaveBeenCalledWith('s1', '开始吧');
  });

  it('pendingGate 时点击允许调用 client.approveGate', () => {
    const client = stubClient();
    setKernelClient(client);
    useSessionStore.getState().setSessions([
      { id: 's1', mode: 'code', title: 't', pinned: false, status: 'gate', updatedAt: '' }
    ]);
    useSessionStore.getState().applyGuiEvent({
      kind: 'kernel',
      sessionId: 's1',
      event: { type: 'gate_request', taskId: 't1', gateId: 'g9', reason: '要执行命令' }
    });
    render(<SessionView sessionId="s1" />);
    fireEvent.click(screen.getByText('允许'));
    expect(client.approveGate).toHaveBeenCalledWith('s1', 'g9', 'allow');
  });

  it('usage 显示在 UsageBar', () => {
    setKernelClient(stubClient());
    useSessionStore.getState().setSessions([
      { id: 's1', mode: 'chat', title: 't', pinned: false, status: 'idle', updatedAt: '' }
    ]);
    useSessionStore.getState().applyGuiEvent({
      kind: 'usage', sessionId: 's1',
      usage: { inputTokens: 8100, outputTokens: 4200, cacheHitRate: 0.92, cny: 0.18 }
    });
    render(<SessionView sessionId="s1" />);
    expect(screen.getByText(/92%/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: 跑测试 FAIL** → **Step 3: 重写 SessionView**

```tsx
// packages/gui/src/workspace/SessionView.tsx
import React from 'react';

import { Composer } from './Composer';
import { SummaryBar } from './SummaryBar';
import { TimelineCard } from './TimelineCards';
import { UsageBar } from './UsageBar';
import { emptyUsage } from '../kernel/client';
import { getKernelClient } from '../kernel';
import { useSessionStore } from '../store/session-store';
import { useUiStore } from '../store/ui-store';

export function SessionView({ sessionId }: { sessionId: string }): JSX.Element {
  const session = useSessionStore((s) => s.sessions[sessionId]);
  const timeline = useSessionStore((s) => s.timelines[sessionId] ?? []);
  const usage = useSessionStore((s) => s.usages[sessionId]) ?? emptyUsage();
  const plan = useSessionStore((s) => s.plans[sessionId] ?? []);
  const currentStepId = useSessionStore((s) => s.currentStepIds[sessionId]);
  const pendingGate = useSessionStore((s) => s.pendingGates[sessionId]);
  const addUserMessage = useSessionStore((s) => s.addUserMessage);
  const toggleSummary = useUiStore((s) => s.toggleSummary);
  const summaryOpen = useUiStore((s) => s.summaryOpen);

  const handleSubmit = (input: string): void => {
    addUserMessage(sessionId, input);
    void getKernelClient().startTask(sessionId, input);
  };

  const handleGate = (gateId: string, decision: 'allow' | 'deny'): void => {
    void getKernelClient().approveGate(sessionId, gateId, decision);
  };

  return (
    <div className="session-view">
      <div className="ws-top">
        <span className="ws-title">{session?.title ?? 'New Chat'}</span>
        {session?.branch && <span className="git-chip">⎇ {session.branch}</span>}
        <button className={`summary-toggle ${summaryOpen ? 'open' : ''}`} onClick={toggleSummary}>
          ▤ 摘要
        </button>
      </div>
      <SummaryBar steps={plan} currentStepId={currentStepId} />
      <div className="stream">
        {timeline.map((item, i) => (
          <TimelineCard
            key={i}
            item={item}
            onGateDecision={handleGate}
            gatePending={
              item.kind === 'kernel' &&
              item.event.type === 'gate_request' &&
              pendingGate?.gateId === item.event.gateId
            }
          />
        ))}
      </div>
      <div className="composer-wrap">
        <Composer onSubmit={handleSubmit} disabled={Boolean(pendingGate)} />
        <UsageBar usage={usage} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 更新 T8 旧测试**：`tests/session-view.test.tsx` 中 `SessionView` 的两个用例改为传 `sessionId`（store 里先 `setSessions` 一条），断言不变。Composer/UsageBar 用例不动。
- [ ] **Step 5: 跑全量测试 PASS** — Run: `pnpm --filter @bobby/gui test`
- [ ] **Step 6: 提交**

```bash
git add packages/gui/src/workspace/SessionView.tsx packages/gui/tests/session-view-live.test.tsx packages/gui/tests/session-view.test.tsx
git commit -m "feat(gui): wire SessionView to session-store and KernelClient"
```

### T16：Sidebar 列表 + 审查面板接 mock；AppShell 事件订阅

**Files:**
- Modify: `packages/gui/src/shell/Sidebar.tsx`（列表区改为 store 数据）
- Modify: `packages/gui/src/shell/sidebar-config.ts`（删除 `STATIC_GROUPS`）
- Create: `packages/gui/src/panels/ReviewPanel.tsx`；Modify: `packages/gui/src/panels/RightPanel.tsx`（review tab 换成 ReviewPanel）
- Modify: `packages/gui/src/shell/AppShell.tsx`（启动时 listSessions + onEvent 订阅 → session-store；session 视图渲染 activeSessionId）
- Test: `packages/gui/tests/sidebar-live.test.tsx`、`packages/gui/tests/review-panel.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
// packages/gui/tests/sidebar-live.test.tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { Sidebar } from '../src/shell/Sidebar';
import { useSessionStore } from '../src/store/session-store';
import { useUiStore } from '../src/store/ui-store';

const initialUi = useUiStore.getState();
const initialSession = useSessionStore.getState();

beforeEach(() => {
  useUiStore.setState(initialUi, true);
  useSessionStore.setState(initialSession, true);
});

describe('Sidebar（live 列表）', () => {
  it('按模式显示 store 里的会话，置顶分组在前，状态点映射 status', () => {
    useSessionStore.getState().setSessions([
      { id: 'a', mode: 'code', title: '修复 updater', project: 'bobby', pinned: true, status: 'gate', updatedAt: '2026-06-13T11:00:00Z' },
      { id: 'b', mode: 'code', title: '单测补全', project: 'bobby', pinned: false, status: 'done', updatedAt: '2026-06-13T03:00:00Z' },
      { id: 'c', mode: 'chat', title: '闲聊', pinned: false, status: 'idle', updatedAt: '2026-06-13T01:00:00Z' }
    ]);
    useUiStore.getState().setMode('code');
    render(<Sidebar />);
    expect(screen.getByText('修复 updater')).toBeTruthy();
    expect(screen.getByText('单测补全')).toBeTruthy();
    expect(screen.queryByText('闲聊')).toBeNull();
  });

  it('点击会话条目设为 activeSession 并切到 session 视图', () => {
    useSessionStore.getState().setSessions([
      { id: 'a', mode: 'chat', title: '闲聊', pinned: false, status: 'idle', updatedAt: '' }
    ]);
    useUiStore.getState().setView('projects');
    render(<Sidebar />);
    fireEvent.click(screen.getByText('闲聊'));
    expect(useSessionStore.getState().activeSessionId).toBe('a');
    expect(useUiStore.getState().view).toBe('session');
  });
});
```

```tsx
// packages/gui/tests/review-panel.test.tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { ReviewPanel } from '../src/panels/ReviewPanel';
import { useSessionStore } from '../src/store/session-store';

const initial = useSessionStore.getState();

beforeEach(() => {
  useSessionStore.setState(initial, true);
});

describe('ReviewPanel', () => {
  it('从 timeline 提取 file_diff 列出变更文件，并列出全部证据', () => {
    const apply = useSessionStore.getState().applyGuiEvent;
    useSessionStore.getState().setActiveSession('s1');
    apply({
      kind: 'kernel', sessionId: 's1',
      event: {
        type: 'evidence_produced', taskId: 't1',
        evidence: {
          claimId: 'c1', acId: 'a1', evidenceType: 'file_diff',
          payload: { path: 'packages/gui/electron-builder.yml', plus: 3, minus: 1, diff: '+x' },
          producedBy: 'tool'
        }
      }
    });
    apply({
      kind: 'kernel', sessionId: 's1',
      event: {
        type: 'evidence_produced', taskId: 't1',
        evidence: {
          claimId: 'c1', acId: 'a2', evidenceType: 'command_output',
          payload: { stdout: 'ok' }, producedBy: 'tool'
        }
      }
    });
    render(<ReviewPanel />);
    expect(screen.getByText(/electron-builder\.yml/)).toBeTruthy();
    expect(screen.getByText(/CHANGES · 1/)).toBeTruthy();
    expect(screen.getByText(/EVIDENCE · 2/)).toBeTruthy();
  });

  it('无活动会话时显示空状态', () => {
    render(<ReviewPanel />);
    expect(screen.getByText(/暂无变更与证据/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: 跑测试 FAIL** → **Step 3: 实现**

Sidebar 列表区替换（其余结构不动）：分组规则 = `pinned` 在 `PINNED` 组；其余按 `project ?? '未分组'` 分组；状态点映射 `running→run / gate→gate / done→ok / failed→err / idle→none`；条目 `onClick` = `setActiveSession(id) + setView('session')`。时间列显示 `updatedAt` 的 `HH:mm`（用 `slice(11, 16)`，mock 数据即 ISO 串，不引日期库）。

```tsx
// packages/gui/src/panels/ReviewPanel.tsx
import React from 'react';

import { useSessionStore } from '../store/session-store';

export function ReviewPanel(): JSX.Element {
  const activeId = useSessionStore((s) => s.activeSessionId);
  const timeline = useSessionStore((s) => (activeId ? s.timelines[activeId] ?? [] : []));

  const evidences = timeline.flatMap((item) =>
    item.kind === 'kernel' && item.event.type === 'evidence_produced' ? [item.event.evidence] : []
  );
  const diffs = evidences.filter((e) => e.evidenceType === 'file_diff');

  if (evidences.length === 0) {
    return <div className="rp-empty">暂无变更与证据 — 会话产生 file_diff / 证据后显示</div>;
  }

  return (
    <div>
      <div className="rp-sec-h">CHANGES · {diffs.length}</div>
      {diffs.map((e, i) => (
        <div className="file-row" key={i}>
          <span className="m M">M</span>
          <span>{String((e.payload as { path?: unknown }).path ?? '')}</span>
        </div>
      ))}
      <div className="rp-sec-h">EVIDENCE · {evidences.length}</div>
      {evidences.map((e, i) => (
        <div className="evid-row" key={i}>
          <span className="ck">✓</span>
          <span>{e.evidenceType}</span>
        </div>
      ))}
      <button className="review-btn" disabled title="P3 接通">◈ 用 Pro 复核本次变更</button>
    </div>
  );
}
```

AppShell 接线（替换 T9 版本的对应部分）：

```tsx
// AppShell 内新增（组件顶部）：
const setSessions = useSessionStore((s) => s.setSessions);
const applyGuiEvent = useSessionStore((s) => s.applyGuiEvent);
const activeSessionId = useSessionStore((s) => s.activeSessionId);

React.useEffect(() => {
  const client = getKernelClient();
  void client.listSessions('chat').then(setSessions);
  void client.listSessions('code').then(setSessions);
  return client.onEvent(applyGuiEvent);
}, [setSessions, applyGuiEvent]);

// MainView 的 session 分支改为：
// 1) 有 activeSessionId → <SessionView sessionId={activeSessionId} />
// 2) 没有 → 调 getKernelClient().createSession(mode) 的「New Chat 空态」：
//    P1 简化：点击功能项 New Chat/New Session 时调 createSession 并 setActiveSession（在 Sidebar fn-item 的 session 项 onClick 里做）
```

RightPanel 的 review 分支改为 `<ReviewPanel />`。

- [ ] **Step 4: 跑全量测试 PASS** — Run: `pnpm --filter @bobby/gui test`
- [ ] **Step 5: 提交**

```bash
git add packages/gui/src/shell/ packages/gui/src/panels/ packages/gui/tests/sidebar-live.test.tsx packages/gui/tests/review-panel.test.tsx
git commit -m "feat(gui): live sidebar sessions + review panel fed by mock events"
```

### T17：旧件清退 + P1 收口

**Files:**
- Delete: `packages/gui/src/screens/Workspace.tsx`、`packages/gui/src/screens/History.tsx`、`packages/gui/src/store/app-store.ts`、`packages/gui/src/ipc/contract.ts`、`packages/gui/src/components/{ChatStream,CostBar,EvidencePanel,PlanView,GateDialog,ThemeToggle}.tsx`
- Delete: `packages/gui/tests/{workspace-screen.test.tsx,app-store.test.ts,gate-dialog.test.tsx,ipc.test.ts}`
- Keep: `screens/{Wizard,Settings,Plugins}.tsx` 及其依赖（`lib/key-validate.ts`、`lib/evidence-format.ts`、`lib/i18n.ts` 与相应测试）——P2/P6 迁移
- Modify: `packages/gui/src/app.css`（删除被清退组件的专属规则；保留 Wizard/Settings/Plugins 还在用的）

- [ ] **Step 1: 全文搜索确认无引用**

Run: `grep -rn "screens/Workspace\|screens/History\|store/app-store\|ipc/contract\|components/" packages/gui/src --include="*.tsx" --include="*.ts"`
Expected: 仅剩 Wizard/Settings/Plugins 内部引用（它们不引被删文件；若有，先改它们脱钩，改动点回报总工程师）

- [ ] **Step 2: 删除文件 + 对应测试**（上面清单逐个 `git rm`）
- [ ] **Step 3: 全量验证**

Run: `pnpm --filter @bobby/gui test && pnpm --filter @bobby/gui typecheck && pnpm lint && pnpm -r build`
Expected: 全绿

- [ ] **Step 4: 提交**

```bash
git commit -m "refactor(gui): retire legacy workspace/top-nav components replaced by shell"
```

### 3.9 P1 验收清单（总工程师亲自执行）

命令验收：

- [ ] `pnpm --filter @bobby/gui test`：全绿，且包含 mock-client 的 **gate 暂停/恢复/拒绝** 三条用例的真实 PASS 输出
- [ ] `pnpm lint` 0 警告；`pnpm -r build`、typecheck 通过

浏览器演练（`pnpm --filter @bobby/gui dev`，纯浏览器 = mock）：

- [ ] **主剧本**：Code 模式 → 点「修复 updater 校验失败」→ Composer 发任意文字 → 依次出现：摘要栏计划 4 步（▤ 打开可见、当前步高亮）→ 工具卡 → **闸口卡暂停**（Composer 同时禁用）→ 点「允许」→ 证据卡 ×2 → 复核卡（pass）→ UsageBar 变为 `CACHE 92% · IN 8.1K / OUT 4.2K · ¥0.18` → 完成后侧边栏该条状态点变 ✓
- [ ] **拒绝路径**：刷新重来，闸口点「拒绝」→ 不出现证据卡，会话状态变 failed（✗ 状态点）
- [ ] **审查面板**：主剧本跑完后，右侧审查 tab 显示 `CHANGES · 1`（electron-builder.yml）与 `EVIDENCE · 2`
- [ ] **多会话**：侧边栏 Code 列表显示 3 条 mock 会话（code-gate / loop-converge / multi-1），Chat 列表 1 条；点击切换工作区内容互不串台
- [ ] **chat-basic**：Chat 模式发消息 → mock 回答出现 → 用量 `¥0.01`
- [ ] **loop-converge**：点开该会话发任务 → 三轮 verdict 卡（fail→fail→pass）依次出现

---

## 4. P2–P6：里程碑级计划（开工前逐阶段补发工单书）

> 下表是**验收标准与边界**，不是工单。每阶段开工前，总工程师按 §2/§3 的格式把它细化成 T 序列（含测试代码），Codex 不得仅凭本表施工。

### P2 Chat 接通（依赖：kernel 进程可用）
- 新增 `src/kernel/ipc-client.ts`：`IpcKernelClient implements KernelClient`，把 `window.bobby.send/onEvent` 适配为 GuiEvent（kernel 暂无 sessionId → 先单会话映射，约定 sessionId='local'）；`kernel/index.ts` 解析顺序：`?mock=1` 强制 mock → `window.bobby` 存在用 IPC → 否则 mock。
- Wizard 迁移为首启全屏引导（欢迎 → key → probe → 默认模型 → 进主界面），key 校验复用 `lib/key-validate.ts`。
- **验收**：Electron 启动真 key 真对话；usage 来自真实 API 计量；浏览器 `?mock=1` 剧本演练不受影响；首启无 key 时强制走向导。

### P3 Code 核心
- code 会话走真 kernel：闸口卡接真 `gate_request`（含命令/diff 预览 payload，需 kernel 侧扩展 → 由总工程师与 kernel 排期对齐，GUI 侧先兼容 reason-only）；审查面板 diff 视图（逐行 +/− 渲染）；「用 Pro 复核」按钮启用。
- **验收**：一个真实小任务全流程产生可展开证据链；闸口拒绝后任务状态为 blocked 且有记录；diff 视图与 `git diff` 输出一致。

### P4 右侧面板补全
- 终端 tab：kernel 命令流只读渲染（等宽、autoscroll、可暂停滚动）；网页 tab：webview（`nodeIntegration:false`、`contextIsolation:true`、导航 allowlist 仅 localhost + 用户白名单）；SideChat：独立 mini 会话（chat 模式 KernelClient 复用，独立 usage 显示）。
- **验收**：终端流与主进程日志一致；webview 加载 dev server；SideChat 不写主会话 timeline。

### P5 自动化三件套（顺序：Routines → Loop → Team）
- 共同契约：**每次运行落成一条 code 会话**（详情页复用 SessionView）；KernelClient 扩展 `listRoutines/listLoops/listTeams` + 各 create/run。
- Routines：列表（cron 人话化、下次运行、上次结果、开关）+ 自然语言→cron 新建表单。
- Loop：列表（状态/轮次/费用）+ 详情（迭代时间线、收敛迷你图、暂停/介入/调预算）+ **引导式四步创建向导**（每步：写作要点 + 模板预设 + AI 辅助润写[Flash 改写并解释] + 最后 dry-run 一轮）。
- Team：模板库（执行者→复核者；规划→编码→测试→复核）+ 线性流水线编排（节点=角色卡：模型/提示词/工具权限）+ 运行泳道视图。**不做自由 DAG 画布。**
- **验收**：三模块先 mock 后真；Loop 向导四步均有质量提示与润写交互；任一自动化运行可从列表点进完整会话回放。

### P6 打磨
- Ctrl+K 命令面板（搜索会话 + 动作：新建/切换/设置）；系统通知（完成/待审批）+ 标题栏通知中心；Settings 用量 dashboard（按日/模型的 token、缓存命中趋势、¥ 累计）；快捷键体系 + Settings 可查；会话恢复（重启回放 timeline）；全量 i18n（中英文案成对入 `lib/i18n.ts`）。
- **验收**：spec §2.1 十五条逐条勾验；断网/无 key/kernel 崩溃三种降级路径都有 UI 反馈。

---

## 5. 总体 Definition of Done（P0+P1 交付门）

1. §2.10 与 §3.9 两张验收清单**全部**由总工程师亲自跑过、留真实输出。
2. `pnpm lint`（0 警告）、`pnpm -r test`、`pnpm -r build` 三连全绿。
3. 纯浏览器（无 Electron / kernel / key / 网络 API）可完整演练 4 套剧本。
4. 全部颜色/字体来自 `theme.css` tokens（抽查 `grep -rn "#[0-9a-fA-F]\{6\}" packages/gui/src --include="*.tsx"` 应为 0 命中；css 文件中允许 var 定义处出现字面量）。
5. `packages/{kernel,cli,shared}` 的 `git diff` 为空。
6. 旧测试除 T17 声明清退的 4 个文件外全部保留且通过。
