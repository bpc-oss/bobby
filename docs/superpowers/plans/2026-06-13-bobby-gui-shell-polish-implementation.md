# Bobby GUI Shell Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the current Bobby GUI materially closer to `docs/superpowers/specs/2026-06-13-bobby-gui-shell-mockup.html` across shell chrome, session stage, and placeholder pages while keeping the existing mock workflow intact.

**Architecture:** Keep the existing React component structure and push the fidelity upgrade through focused presentational changes in `packages/gui/src/shell`, `packages/gui/src/workspace`, `packages/gui/src/panels`, and `packages/gui/src/modes`. Add targeted DOM-shape tests that lock the new mockup-aligned structure before changing production code.

**Tech Stack:** React 18, Vite, Vitest, Testing Library, CSS modules-by-file pattern via shared `theme.css` variables.

---

### Task 1: Lock shell chrome to the mockup structure

**Files:**
- Modify: `packages/gui/tests/sidebar-live.test.tsx`
- Modify: `packages/gui/src/shell/Sidebar.tsx`
- Modify: `packages/gui/src/shell/TitleBar.tsx`
- Modify: `packages/gui/src/shell/StatusBar.tsx`
- Modify: `packages/gui/src/shell/shell.css`

- [ ] **Step 1: Write the failing test**

```tsx
it('renders shell chrome with mockup-aligned structural markers', () => {
  useSessionStore.getState().setSessions([
    {
      id: 'a',
      mode: 'chat',
      title: 'New Chat',
      pinned: false,
      status: 'idle',
      updatedAt: '2026-06-13T10:00:00Z'
    }
  ]);

  render(<Sidebar />);

  expect(document.querySelector('.side-shell')).toBeTruthy();
  expect(document.querySelector('.side-fn .fn-item.active .soon')).toBeNull();
  expect(document.querySelector('.item .item-meta')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bobby/gui test -- sidebar-live.test.tsx`
Expected: FAIL because `.side-shell` / `.item-meta` do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
<aside className="side side-shell">
  ...
  <span className="item-meta">
    <span className="time">{...}</span>
  </span>
</aside>
```

```css
.side-shell { background: rgba(5, 9, 14, 0.35); }
.item-meta { display: inline-flex; align-items: center; gap: 6px; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @bobby/gui test -- sidebar-live.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/gui/tests/sidebar-live.test.tsx packages/gui/src/shell/Sidebar.tsx packages/gui/src/shell/TitleBar.tsx packages/gui/src/shell/StatusBar.tsx packages/gui/src/shell/shell.css
git commit -m "feat(gui): polish shell chrome to match mockup"
```

### Task 2: Lock session stage hierarchy to the mockup structure

**Files:**
- Modify: `packages/gui/tests/session-view-live.test.tsx`
- Modify: `packages/gui/src/workspace/SessionView.tsx`
- Modify: `packages/gui/src/workspace/TimelineCards.tsx`
- Modify: `packages/gui/src/workspace/SummaryBar.tsx`
- Modify: `packages/gui/src/workspace/workspace.css`

- [ ] **Step 1: Write the failing test**

```tsx
it('renders the mockup-aligned session stage containers', () => {
  useSessionStore.getState().setSessions([
    { id: 's1', mode: 'code', title: 'fix updater', branch: 'fix/u', pinned: false, status: 'idle', updatedAt: '' }
  ]);

  render(<SessionView sessionId="s1" />);

  expect(document.querySelector('.session-stage')).toBeTruthy();
  expect(document.querySelector('.summary .row')).toBeTruthy();
  expect(document.querySelector('.composer-wrap .costbar')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bobby/gui test -- session-view-live.test.tsx`
Expected: FAIL because `.session-stage` and summary metadata row are not rendered.

- [ ] **Step 3: Write minimal implementation**

```tsx
<div className="session-view session-stage">
  ...
</div>
```

```tsx
<div className="row">
  <span>FILES {steps.length}</span>
  <span>SUMMARY LIVE</span>
</div>
```

```css
.session-stage { background: radial-gradient(...), transparent; }
.summary .row { display: flex; gap: 16px; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @bobby/gui test -- session-view-live.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/gui/tests/session-view-live.test.tsx packages/gui/src/workspace/SessionView.tsx packages/gui/src/workspace/TimelineCards.tsx packages/gui/src/workspace/SummaryBar.tsx packages/gui/src/workspace/workspace.css
git commit -m "feat(gui): polish session stage to match mockup"
```

### Task 3: Lock review panel and placeholder family to the mockup structure

**Files:**
- Modify: `packages/gui/tests/review-panel.test.tsx`
- Create: `packages/gui/tests/placeholders.test.tsx`
- Modify: `packages/gui/src/panels/RightPanel.tsx`
- Modify: `packages/gui/src/panels/panels.css`
- Modify: `packages/gui/src/modes/EmptyState.tsx`
- Modify: `packages/gui/src/modes/LoopPlaceholder.tsx`
- Modify: `packages/gui/src/modes/placeholder-config.tsx`
- Modify: `packages/gui/src/modes/modes.css`

- [ ] **Step 1: Write the failing tests**

```tsx
it('renders right panel tab chrome with mockup-aligned body sections', () => {
  render(<ReviewPanel />);
  expect(document.querySelector('.rp-empty-state')).toBeTruthy();
});
```

```tsx
it('renders placeholder skeleton surfaces instead of plain empty copy', () => {
  render(<EmptyState glyph="S" title="Search" desc="desc" tag="P6" />);
  expect(document.querySelector('.placeholder-shell')).toBeTruthy();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @bobby/gui test -- review-panel.test.tsx placeholders.test.tsx`
Expected: FAIL because `.rp-empty-state` and `.placeholder-shell` do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
<div className="rp-empty rp-empty-state">...</div>
```

```tsx
<div className="placeholder placeholder-shell">
  <div className="placeholder-copy">...</div>
  {children}
</div>
```

```css
.placeholder-shell { max-width: 980px; gap: 18px; }
.rp-empty-state { display: grid; place-items: center; min-height: 100%; }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @bobby/gui test -- review-panel.test.tsx placeholders.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/gui/tests/review-panel.test.tsx packages/gui/tests/placeholders.test.tsx packages/gui/src/panels/RightPanel.tsx packages/gui/src/panels/panels.css packages/gui/src/modes/EmptyState.tsx packages/gui/src/modes/LoopPlaceholder.tsx packages/gui/src/modes/placeholder-config.tsx packages/gui/src/modes/modes.css
git commit -m "feat(gui): polish review and placeholder surfaces"
```

### Task 4: Verify the full polish pass

**Files:**
- Modify: `PROJECT_STATUS.md`

- [ ] **Step 1: Run focused GUI tests**

Run: `pnpm --filter @bobby/gui test`
Expected: PASS

- [ ] **Step 2: Run type and repo verification**

Run: `pnpm --filter @bobby/gui typecheck && pnpm lint && pnpm -r build`
Expected: PASS

- [ ] **Step 3: Run scope guard**

Run: `git diff master...HEAD --stat -- packages/kernel packages/cli packages/shared`
Expected: no output

- [ ] **Step 4: Run visual QA**

Run: `pnpm --filter @bobby/gui dev -- --host localhost --port 5173`
Expected: local app opens and visually matches the mockup more closely across shell, session stage, right panel, and placeholders.

- [ ] **Step 5: Commit handoff**

```bash
git add PROJECT_STATUS.md
git commit -m "docs(gui): record shell polish handoff"
```
