# Bobby Codex Desktop UI Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `packages/gui` to Codex Desktop / Claude Code Desktop level for desktop shell layout, module boundaries, state semantics, and end-to-end operator flow.

**Architecture:** Keep Bobby on a single persistent three-column desktop shell. The left rail owns app navigation and project/task context, the center column owns the active task transcript plus composer, and the right side owns a fixed dock with real tools only. All visible state must come from store, IPC, and kernel data; no placeholder controls, fake progress, or bypass paths are allowed.

**Tech Stack:** Electron, React, TypeScript, Zustand (`chat-store`, `app-store`), Vitest, Vite, shared IPC contracts in `packages/gui/src/ipc/contract.ts`

---

## Execution Status As Of 2026-06-12

- Completed and pushed:
  - `W6 Dock Parity and Tool Boundary Cleanup`
  - `W7 Files Panel Parity`
  - `W8 Secondary Screens Inside One Shell` (shared shell continuity portion)
- `W9 Persistence and Resume`
- In progress:
  - `W10 Visual System and Responsive Cleanup`
- Remaining after W10:
  - `Final Acceptance Sweep`

## Recent Verified Commits

- `fd0f9ca` `feat(gui): align right dock with codex toolset`
- `f90e2d8` `feat(gui): align files panel with codex layout`
- `9e326ca` `feat(gui): keep secondary pages inside shared shell`

## Immediate Next Slice

`W10 Visual System and Responsive Cleanup` is the active slice. The next implementation step is to tighten tokens, spacing, and responsive density now that session restore falls back cleanly to a meaningful working context.

Primary focus:

- normalize shell tokens and desktop density
- remove remaining web-dashboard styling drift
- validate desktop breakpoints and dock/composer fit
- preserve the already-fixed W6-W9 behavior during polish

Verification gate for this slice:

- `pnpm --filter @bobby/gui test -- workspace-screen.test.tsx smoke.test.ts`
- `pnpm --filter @bobby/gui test`
- `pnpm --filter @bobby/gui smoke:electron`

---

## Screenshot-Derived Target

The seven Codex screenshots define one coherent desktop shell, not a set of unrelated pages.

### 1. Left rail

- Stable primary entries: `New Chat`, `Search`, `Plugins`, `Automations`, `Settings`
- No dashboard-like chrome
- Switching entries must not remount the shell, dock, or environment card

### 2. Project and task tree

- Projects are first-class groups
- Tasks live under the project they belong to
- Active task highlight, recent ordering, truncation, and per-task isolation must be obvious

### 3. Center workspace

- Empty state and active task share the same shell
- Transcript reads like an execution log, not chat bubbles
- Reasoning, tool output, status, error, and final result are separate visual layers

### 4. Composer as control surface

- `+` menu exposes attachments, creation actions, plan mode, goal mode, and plugin entry points
- Bottom context row shows project, runtime mode, branch, and related task context
- Controls remain visible and stable in both empty and active task states

### 5. Environment card

- Acts as the current execution context card
- Owns git summary, local mode indicator, branch picker, commit/push, PR creation, progress checklist, browser target, and sources
- Every action must map to real capability

### 6. Fixed right dock

- Only four stable entries: `Review`, `Terminal`, `Browser`, `Files`
- Entry labels and shortcuts always visible
- Panels persist and restore active/open state across navigation

### 7. Files tool

- Split tree/preview layout
- Empty preview by default
- Filter box at top
- File opens only after explicit selection
- File reference can be written back into the composer

## Current Baseline

Completed or partially completed slices already in the branch:

- Workspace top brand bar was removed
- Sidebar density and shell framing were tightened
- Transcript moved toward task-flow sections
- Composer gained explicit control/input/context rows
- Environment progress now derives from real task state
- Right dock now exposes only `Review`, `Terminal`, `Browser`, and `Files`
- Files tool now uses split tree/preview layout with empty preview by default
- Search, plugins, automations, and history now render inside the shared shell frame

Main remaining gaps versus screenshots:

- Persistence and resume are not strong enough for desktop continuity
- Visual tokens and spacing still need final parity polish

## File Map For Remaining Work

### Core shell and routing

- `E:\ai-files\Bobby\packages\gui\src\main.tsx`
- `E:\ai-files\Bobby\packages\gui\src\components\Sidebar.tsx`
- `E:\ai-files\Bobby\packages\gui\src\screens\Workspace.tsx`
- `E:\ai-files\Bobby\packages\gui\src\store\app-store.ts`
- `E:\ai-files\Bobby\packages\gui\src\store\chat-store.ts`

### Dock and tool panels

- `E:\ai-files\Bobby\packages\gui\src\components\SessionToolDock.tsx`
- `E:\ai-files\Bobby\packages\gui\src\components\ReviewPanel.tsx`
- `E:\ai-files\Bobby\packages\gui\src\components\DiffView.tsx`
- `E:\ai-files\Bobby\packages\gui\src\components\ChangeInspector.tsx`
- `E:\ai-files\Bobby\packages\gui\src\components\EvidencePanel.tsx`

### Secondary screens that must remain inside one shell

- `E:\ai-files\Bobby\packages\gui\src\screens\Search.tsx`
- `E:\ai-files\Bobby\packages\gui\src\screens\PluginMarketplace.tsx`
- `E:\ai-files\Bobby\packages\gui\src\screens\ScheduleTasks.tsx`
- `E:\ai-files\Bobby\packages\gui\src\screens\History.tsx`
- `E:\ai-files\Bobby\packages\gui\src\screens\Commands.tsx`
- `E:\ai-files\Bobby\packages\gui\src\screens\Agents.tsx`

### Styling and contracts

- `E:\ai-files\Bobby\packages\gui\src\styles\tokens.css`
- `E:\ai-files\Bobby\packages\gui\src\app.css`
- `E:\ai-files\Bobby\packages\gui\src\ipc\contract.ts`

### Must-track tests

- `E:\ai-files\Bobby\packages\gui\tests\workspace-screen.test.tsx`
- `E:\ai-files\Bobby\packages\gui\tests\session-tool-dock.test.tsx`
- `E:\ai-files\Bobby\packages\gui\tests\chat-store.test.ts`
- `E:\ai-files\Bobby\packages\gui\tests\app-store.test.ts`
- `E:\ai-files\Bobby\packages\gui\tests\plugins.test.tsx`
- `E:\ai-files\Bobby\packages\gui\tests\automations.test.tsx`
- `E:\ai-files\Bobby\packages\gui\tests\history.test.tsx`
- `E:\ai-files\Bobby\packages\gui\tests\smoke.test.ts`

## Delivery Rules

- Keep the shell stable; do not solve parity by adding one-off page chrome
- UI must consume real store or IPC state only
- New IPC surfaces must stay Zod-backed through the existing contract discipline
- No "skip verification" path in review/apply/rewind flows
- Every completed slice must end with focused tests, `pnpm --filter @bobby/gui test`, relevant smoke, then `commit + push`
- Do not stage or commit root `AGENTS.md` or root `PROJECT_STATUS.md`

## Task 1: W6 Dock Parity and Tool Boundary Cleanup

**Files:**
- Modify: `E:\ai-files\Bobby\packages\gui\src\components\SessionToolDock.tsx`
- Modify: `E:\ai-files\Bobby\packages\gui\src\screens\Workspace.tsx`
- Modify: `E:\ai-files\Bobby\packages\gui\src\store\app-store.ts`
- Test: `E:\ai-files\Bobby\packages\gui\tests\session-tool-dock.test.tsx`
- Test: `E:\ai-files\Bobby\packages\gui\tests\workspace-screen.test.tsx`

- [x] **Step 1: Lock the visible dock contract in tests**
  - Assert that only `Review`, `Terminal`, `Browser`, and `Files` appear as visible dock entries.
  - Assert that old stored tabs such as `mission`, `plan`, `diff`, `preview`, `tasks`, and `sidechat` are normalized to a supported tab on restore.
  - Run: `pnpm --filter @bobby/gui test -- session-tool-dock.test.tsx workspace-screen.test.tsx`
  - Expected: failing assertions against the current oversized dock

- [x] **Step 2: Reduce dock navigation to the four screenshot-backed entries**
  - Remove non-parity tabs from visible navigation.
  - Fold any remaining diff/review evidence into `Review` rather than a separate dock tab.
  - Preserve real panel internals only where they still support review or future shell internals.

- [x] **Step 3: Make dock persistence restore cleanly**
  - Ensure open/closed state and active tab survive page changes and app reloads.
  - Add fallback logic so stale localStorage values do not leave the dock blank.

- [x] **Step 4: Verify dock behavior**
  - Run: `pnpm --filter @bobby/gui test -- session-tool-dock.test.tsx workspace-screen.test.tsx`
  - Run: `pnpm --filter @bobby/gui test`
  - Run: `pnpm --filter @bobby/gui smoke:electron`
  - Expected: green tests and stable dock in Electron smoke

- [x] **Step 5: Commit**
  - Commit message: `feat(gui): align right dock with codex toolset`

## Task 2: W7 Files Panel Parity

**Files:**
- Modify: `E:\ai-files\Bobby\packages\gui\src\components\SessionToolDock.tsx`
- Modify: `E:\ai-files\Bobby\packages\gui\src\ipc\contract.ts`
- Modify: `E:\ai-files\Bobby\packages\gui\src\screens\Workspace.tsx`
- Test: `E:\ai-files\Bobby\packages\gui\tests\session-tool-dock.test.tsx`
- Test: `E:\ai-files\Bobby\packages\gui\tests\workspace-screen.test.tsx`

- [x] **Step 1: Codify file tool behavior in tests**
  - Assert split tree/preview layout.
  - Assert the preview is empty before a file is selected.
  - Assert filter input narrows visible tree entries.
  - Assert file selection can produce a composer reference payload.
  - Run: `pnpm --filter @bobby/gui test -- session-tool-dock.test.tsx workspace-screen.test.tsx`
  - Expected: failures for empty-preview and reference-writeback behavior

- [x] **Step 2: Rebuild the files panel around Codex semantics**
  - Keep directories collapsible.
  - Do not auto-open the first file.
  - Render explicit empty, loading, and error states.
  - Make the selected file preview secondary to the tree, not the default shell content.

- [ ] **Step 3: Wire file reference writeback**
  - Connect selected file insertion to the composer in a deterministic format.
  - Ensure the renderer sees only file metadata needed for insertion, not business logic.
  - Status note: layout and empty-preview behavior are done; composer writeback remains to be verified or finished in a later parity slice if still absent.

- [x] **Step 4: Verify**
  - Run: `pnpm --filter @bobby/gui test -- session-tool-dock.test.tsx workspace-screen.test.tsx`
  - Run: `pnpm --filter @bobby/gui test`
  - Run: `pnpm --filter @bobby/gui smoke:electron`
  - Expected: files panel matches screenshot behavior and smoke remains stable

- [x] **Step 5: Commit**
  - Commit message: `feat(gui): align files tool with codex desktop`
  - Actual commit: `feat(gui): align files panel with codex layout`

## Task 3: W8 Search, Plugins, Automations, and History Inside One Shell

**Files:**
- Modify: `E:\ai-files\Bobby\packages\gui\src\main.tsx`
- Modify: `E:\ai-files\Bobby\packages\gui\src\components\Sidebar.tsx`
- Modify: `E:\ai-files\Bobby\packages\gui\src\screens\Search.tsx`
- Modify: `E:\ai-files\Bobby\packages\gui\src\screens\PluginMarketplace.tsx`
- Modify: `E:\ai-files\Bobby\packages\gui\src\screens\ScheduleTasks.tsx`
- Modify: `E:\ai-files\Bobby\packages\gui\src\screens\History.tsx`
- Modify: `E:\ai-files\Bobby\packages\gui\src\screens\Commands.tsx`
- Modify: `E:\ai-files\Bobby\packages\gui\src\screens\Agents.tsx`
- Test: `E:\ai-files\Bobby\packages\gui\tests\plugins.test.tsx`
- Test: `E:\ai-files\Bobby\packages\gui\tests\automations.test.tsx`
- Test: `E:\ai-files\Bobby\packages\gui\tests\history.test.tsx`
- Test: `E:\ai-files\Bobby\packages\gui\tests\workspace-screen.test.tsx`

- [x] **Step 1: Freeze shell continuity in tests**
  - Assert sidebar page switches preserve the same shell frame, environment card, and dock.
  - Assert plugin entry points from the composer and left rail remain semantically aligned.
  - Run: `pnpm --filter @bobby/gui test -- plugins.test.tsx automations.test.tsx history.test.tsx workspace-screen.test.tsx`
  - Expected: failures where screens still behave like separate pages

- [x] **Step 2: Normalize page chrome**
  - Remove any per-screen framing that competes with the shell.
  - Use one shared content container strategy across search, plugins, automations, and history.

- [ ] **Step 3: Close navigation loops**
  - Plugin screen should reflect composer plugin entry semantics.
  - Automation actions should route back to task or history context.
  - History selection should restore task context without breaking shell continuity.
  - Status note: shared-shell continuity is done; navigation-loop semantics still need explicit acceptance checks.

- [x] **Step 4: Verify**
  - Run: `pnpm --filter @bobby/gui test -- plugins.test.tsx automations.test.tsx history.test.tsx workspace-screen.test.tsx`
  - Run: `pnpm --filter @bobby/gui test`
  - Expected: shell survives page changes cleanly

- [x] **Step 5: Commit**
  - Commit message: `feat(gui): unify secondary screens under desktop shell`
  - Actual commit: `feat(gui): keep secondary pages inside shared shell`

## Task 4: W9 Persistence and Resume

**Files:**
- Modify: `E:\ai-files\Bobby\packages\gui\src\store\app-store.ts`
- Modify: `E:\ai-files\Bobby\packages\gui\src\store\chat-store.ts`
- Modify: `E:\ai-files\Bobby\packages\gui\src\main.tsx`
- Modify: `E:\ai-files\Bobby\packages\gui\src\components\SessionToolDock.tsx`
- Test: `E:\ai-files\Bobby\packages\gui\tests\app-store.test.ts`
- Test: `E:\ai-files\Bobby\packages\gui\tests\chat-store.test.ts`
- Test: `E:\ai-files\Bobby\packages\gui\tests\smoke.test.ts`

- [x] **Step 1: Define resume expectations in tests**
  - Assert restored project, active task, dock open state, active dock tab, and relevant workspace context.
  - Assert stale or invalid persisted values fail closed instead of corrupting the shell.
  - Run: `pnpm --filter @bobby/gui test -- app-store.test.ts chat-store.test.ts smoke.test.ts`
  - Expected: failures around incomplete restore behavior
  - Verified coverage now includes stale `lastActiveSessionId` fallback and App-level restore into the newest persisted session.

- [x] **Step 2: Persist only meaningful shell context**
  - Restore the last active project and task.
  - Restore dock state without reviving removed tabs.
  - Keep session restore task-scoped so parallel threads do not bleed into each other.
  - Implemented behavior: if the saved last-active session id is missing or stale, restore the most recently updated persisted session instead of dropping into a blank shell.

- [x] **Step 3: Verify resume in smoke**
  - Run: `pnpm --filter @bobby/gui test -- app-store.test.ts chat-store.test.ts smoke.test.ts`
  - Run: `pnpm --filter @bobby/gui test`
  - Run: `pnpm --filter @bobby/gui smoke:electron`
  - Expected: restart returns to a usable working context
  - Verified on 2026-06-12.

- [ ] **Step 4: Commit**
  - Commit message: `feat(gui): restore desktop shell context on resume`

## Task 5: W10 Visual System and Responsive Cleanup

**Files:**
- Modify: `E:\ai-files\Bobby\packages\gui\src\styles\tokens.css`
- Modify: `E:\ai-files\Bobby\packages\gui\src\app.css`
- Modify: `E:\ai-files\Bobby\packages\gui\src\components\Sidebar.tsx`
- Modify: `E:\ai-files\Bobby\packages\gui\src\screens\Workspace.tsx`
- Modify: `E:\ai-files\Bobby\packages\gui\src\components\SessionToolDock.tsx`
- Test: `E:\ai-files\Bobby\packages\gui\tests\workspace-screen.test.tsx`
- Test: `E:\ai-files\Bobby\packages\gui\tests\smoke.test.ts`

- [ ] **Step 1: Establish final token contract**
  - Inventory the remaining one-off colors, radii, borders, and spacing in the shell.
  - Move them to shared tokens where reuse is intentional.
  - Keep parity work dark-theme-first because the screenshots are dark desktop references.

- [ ] **Step 2: Tighten desktop density and alignment**
  - Normalize panel radius, sidebar spacing, dock spacing, transcript width, and environment card rhythm.
  - Remove any remaining "web dashboard" feel.

- [ ] **Step 3: Validate desktop breakpoints**
  - Check at least `1366x768`, `1536x960`, and `1920x1080`.
  - Ensure no clipped rail labels, overlapping composer controls, or dock overflow.

- [ ] **Step 4: Verify**
  - Run: `pnpm --filter @bobby/gui test -- workspace-screen.test.tsx smoke.test.ts`
  - Run: `pnpm --filter @bobby/gui test`
  - Run: `pnpm --filter @bobby/gui smoke:electron`
  - Expected: styling cleanup does not regress behavior

- [ ] **Step 5: Commit**
  - Commit message: `feat(gui): finalize desktop parity polish`

## Task 6: Final Acceptance Sweep

**Files:**
- Modify if needed: `E:\ai-files\Bobby\PROJECT_STATUS.md`
- Verify all previously touched GUI files only as needed

- [ ] **Step 1: Run full verification**
  - Run: `pnpm -r test`
  - Run: `pnpm build`
  - Run: `pnpm --filter @bobby/gui smoke:electron`
  - Expected: all commands pass

- [ ] **Step 2: Run the desktop acceptance script manually**
  - Open project
  - Start two tasks under one project
  - Confirm task isolation in the left tree
  - Open `Review`, `Terminal`, `Browser`, and `Files`
  - Insert a file reference into the composer
  - Review environment card actions and progress
  - Restart and confirm resume lands in meaningful context

- [ ] **Step 3: Update handoff**
  - Record completed slices, touched files, commands, blockers, and any known non-parity items

- [ ] **Step 4: Final integration commit**
  - Commit message: `feat(gui): complete codex desktop parity shell`

## Suggested Execution Order

1. Task 4: W9 Persistence and resume
2. Task 5: W10 Visual and responsive cleanup
3. Finish deferred acceptance points from W7/W8 if still open
4. Task 6: Final acceptance sweep

## Done Criteria

This plan is complete only when all of the following are true:

- Bobby uses one stable three-column desktop shell
- Left rail, project tree, center workspace, environment card, and right dock match the screenshot information architecture
- Only the four Codex-style right dock entries remain visible
- Files tool behavior matches screenshot expectations
- Search, plugins, automations, and history all live inside one shell
- Resume restores meaningful working context
- `pnpm -r test` passes
- `pnpm build` passes
- `pnpm --filter @bobby/gui smoke:electron` passes
- Manual desktop acceptance script passes end-to-end

## Non-Goals For This Plan

- Inventing new product surfaces not implied by Codex Desktop or the parity directive
- Expanding unrelated model capabilities
- Rebranding Bobby beyond the parity work needed for the desktop shell
- Reopening already-accepted E0 behavior unless a parity slice proves a regression
