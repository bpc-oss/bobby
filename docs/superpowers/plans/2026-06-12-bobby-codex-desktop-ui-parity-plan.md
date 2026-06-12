# Bobby Codex Desktop UI Follow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining Bobby GUI gap against the provided Codex Desktop screenshots by converging the shell layout, left navigation, task transcript, composer, environment popover, right dock tools, automations, and visual system into one coherent desktop workbench.

**Architecture:** Rework the GUI around Codex-style shell primitives instead of layering more one-off widgets onto the current dashboard. Keep all business authority in typed store and IPC layers, and treat the renderer as a composition layer that renders project/task state, tool state, and review state without inventing new backend rules.

**Tech Stack:** Electron, React, TypeScript, Vite, Zustand (`chat-store`, `app-store`), Vitest, typed IPC/Zod contracts, existing Bobby kernel host APIs.

---

## 1. Why This Follow-up Plan Exists

The current GUI is functionally better than before, but the user is correct: it still does not read like Codex Desktop.

The screenshots show that the parity gap is now primarily in:

- shell hierarchy
- spatial information architecture
- project/task navigation density
- centered task transcript composition
- composer-as-console behavior
- context surfaces like environment and branch state
- right-dock cohesion
- final visual system

This plan is the authoritative next-phase UI program for the Bobby GUI branch after the already landed P7-P11 slices.

## 2. Screenshot-Derived Product Model

The provided screenshots define the target product model:

1. Left icon rail for top-level app areas.
2. Separate left project/task navigator under that rail.
3. Center column for the active task transcript.
4. Floating environment card in the top-right of the center workspace.
5. Persistent right tool launcher and dock panels.
6. Large bottom composer that behaves like a task control console, not a plain chat box.
7. Empty-state mode that still preserves shell context, dock shortcuts, and project selection.

If a future GUI change does not strengthen one of those seven areas, it is probably not helping parity.

## 3. Current Bobby Baseline

These areas are already materially implemented and should be treated as baseline, not greenfield:

- `P7` terminal panel
- `P8` browser panel
- `P9` review/diff/apply/commit dock
- `P10` global search page
- `P11` plugin menu to plugins page inventory sync

These slices are useful, but they currently live inside a shell that still feels like a Bobby-specific dashboard instead of a Codex-style workbench.

## 4. File Map And Ownership

The remaining work should concentrate in these files first:

### Shell and routing

- Modify: `packages/gui/src/main.tsx`
- Modify: `packages/gui/src/components/Sidebar.tsx`
- Modify: `packages/gui/src/screens/Workspace.tsx`
- Modify: `packages/gui/src/components/SessionToolDock.tsx`
- Modify: `packages/gui/src/app.css`
- Modify: `packages/gui/src/styles/tokens.css`

### State and behavior

- Modify: `packages/gui/src/store/chat-store.ts`
- Modify: `packages/gui/src/store/app-store.ts`
- Modify: `packages/gui/src/ipc/contract.ts`

### Existing screens that need shell-level integration

- Modify: `packages/gui/src/screens/Search.tsx`
- Modify: `packages/gui/src/screens/PluginMarketplace.tsx`
- Modify: `packages/gui/src/screens/ScheduleTasks.tsx`
- Modify: `packages/gui/src/screens/History.tsx`
- Modify: `packages/gui/src/screens/ProjectHome.tsx`

### Tests that must carry parity acceptance

- Modify: `packages/gui/tests/workspace-screen.test.tsx`
- Modify: `packages/gui/tests/chat-store.test.ts`
- Modify: `packages/gui/tests/session-tool-dock.test.tsx`
- Modify: `packages/gui/tests/plugins.test.tsx`
- Modify: `packages/gui/tests/automations.test.tsx`
- Modify: `packages/gui/tests/history.test.tsx`
- Modify: `packages/gui/tests/smoke.test.ts`

## 5. Authoritative Gap Matrix

| Screenshot surface | Current Bobby state | Required follow-up |
|---|---|---|
| Left icon rail | Exists, but still reads as a feature menu rather than a Codex rail | Tighten density, labels, grouping, and active-state behavior |
| Project/task tree | Exists, but not yet visually or behaviorally aligned with Codex | Make it denser, more scrollable, and more obviously project-first |
| Center transcript | Functionally present, visually still too Bobby-specific | Reframe as task transcript with stronger header/body/composer separation |
| Empty state | Present, but still not fully Codex-like | Preserve shell, project, dock, and centered prompt hierarchy |
| Composer | Broadly capable, but still not a unified control console | Normalize menu structure, context row, permissions, model, target, and branch affordances |
| Environment card | Present, but still partial and visually rough | Unify branch, dirty counts, progress, browser target, sources, and actions |
| Right dock launcher | Present, but still more utilitarian than Codex | Make the launcher labels, shortcuts, and panel states feel first-class |
| Files panel | Functional but not parity-grade | Make split tree/preview flow match the screenshot model |
| Automations | Has core CRUD/run-now flow, but weak shell integration | Add explicit history/jump/result flow and make it a shell citizen |
| Visual system | Improved, but inconsistent | Finish dark workbench style and spacing rules across all panels |

## 6. Non-Negotiable Guardrails

1. Apply, rewind, and automation must still obey the completion gate.
2. Evidence visibility cannot regress.
3. Secrets remain out of renderer state; renderer sees `hasApiKey`, not raw key material.
4. Renderer may coordinate view state only; core logic stays in IPC/store/kernel layers.
5. New IPC must stay Zod-backed.
6. Every accepted slice must end in commit and push.
7. No fake parity controls. If a control exists, it must work or be explicitly unavailable.

## 7. Delivery Order

The remaining parity program should execute in this order:

1. Shell cohesion and left-side hierarchy
2. Center transcript and empty-state cleanup
3. Composer console completion
4. Environment popover completion
5. Files panel parity
6. Automations shell integration
7. Desktop persistence and shortcuts polish
8. Final visual-system pass and screenshot audit

This order matters because the visual/layout problems are structural. Polishing inner panels first would create churn.

## 8. Implementation Batches

### Task 1: Shell Hierarchy Refactor

**Files:**
- Modify: `packages/gui/src/main.tsx`
- Modify: `packages/gui/src/components/Sidebar.tsx`
- Modify: `packages/gui/src/screens/Workspace.tsx`
- Modify: `packages/gui/src/components/SessionToolDock.tsx`
- Test: `packages/gui/tests/workspace-screen.test.tsx`
- Test: `packages/gui/tests/session-tool-dock.test.tsx`

- [ ] Split the shell mentally and structurally into:
  - activity rail
  - project/task navigator
  - main workspace
  - right dock
- [ ] Remove remaining dashboard-style framing that makes the workspace look like one flat page.
- [ ] Ensure the right dock remains visible and usable in both empty and active task states.
- [ ] Keep current page routing in `main.tsx`, but make `chat` render as a composed workbench instead of sidebar + generic content.
- [ ] Add focused tests for:
  - empty-state shell still renders left nav and right dock
  - active task state still renders all shell regions
  - switching pages does not destroy dock state unexpectedly
- [ ] Run:
  - `pnpm --filter @bobby/gui test -- workspace-screen.test.tsx session-tool-dock.test.tsx`

**Acceptance:**
- Bobby reads as a three-region desktop workbench at first glance.
- Empty-state and active-task modes share the same shell.
- Dock shortcuts remain visible in both modes.

### Task 2: Left Navigation Parity

**Files:**
- Modify: `packages/gui/src/components/Sidebar.tsx`
- Modify: `packages/gui/src/store/chat-store.ts`
- Test: `packages/gui/tests/chat-store.test.ts`
- Test: `packages/gui/tests/workspace-screen.test.tsx`

- [ ] Tighten the left rail grouping so the top-level entries match the screenshot intent:
  - new chat
  - search
  - plugins
  - automations
  - settings
- [ ] Rework the project/task navigator density so project folders and nested tasks are visually distinct.
- [ ] Ensure per-task status is always derived from the owning thread rather than a global busy flag.
- [ ] Add or extend tests for:
  - project grouping after `loadSessions`
  - two tasks under one project keep separate statuses
  - selecting one running task does not corrupt another task
- [ ] Run:
  - `pnpm --filter @bobby/gui test -- chat-store.test.ts workspace-screen.test.tsx`

**Acceptance:**
- Left side feels project-first.
- Tasks are clearly nested under projects.
- Running, failed, blocked, and done states stay thread-local.

### Task 3: Center Transcript And Empty-State Parity

**Files:**
- Modify: `packages/gui/src/screens/Workspace.tsx`
- Modify: `packages/gui/src/components/MarkdownRenderer.tsx`
- Test: `packages/gui/tests/workspace-screen.test.tsx`

- [ ] Simplify the center column framing so the transcript becomes the dominant focal area.
- [ ] Reduce non-parity header clutter in empty state.
- [ ] Keep the large centered prompt and suggestion cards, but make them subordinate to the real Codex-like shell framing.
- [ ] Tighten transcript block spacing for:
  - user turns
  - assistant turns
  - reasoning
  - tools
  - evidence
  - status/error cards
- [ ] Add tests for:
  - empty-state centered prompt remains visible
  - transcript stays visible while reasoning and assistant streaming update
  - final result stays attached to the active thread only
- [ ] Run:
  - `pnpm --filter @bobby/gui test -- workspace-screen.test.tsx`

**Acceptance:**
- The center column reads like an active task stream, not a generic chat page.
- Empty state is centered and restrained.
- Evidence stays visible throughout live execution.

### Task 4: Composer Console Completion

**Files:**
- Modify: `packages/gui/src/screens/Workspace.tsx`
- Modify: `packages/gui/src/store/chat-store.ts`
- Modify: `packages/gui/src/ipc/contract.ts`
- Test: `packages/gui/tests/workspace-screen.test.tsx`

- [ ] Normalize the composer as one console with three layers:
  - input box
  - control/menu row
  - context row
- [ ] Keep the plus menu as the entry point for:
  - add files/images
  - create
  - plan mode
  - goal tracking
  - plugins
- [ ] Tighten the context row so project, execution target, and branch/project context read like Codex controls rather than ad hoc pills.
- [ ] Audit current labels and menu affordances for consistency between empty state and active task state.
- [ ] Add tests for:
  - plus menu sections render in the expected order
  - project picker remains searchable
  - plugin menu still opens the Plugins page
  - plan/goal controls remain visible in empty and active states
- [ ] Run:
  - `pnpm --filter @bobby/gui test -- workspace-screen.test.tsx plugins.test.tsx`

**Acceptance:**
- Composer feels like a control console, not just an input widget.
- Empty and active task states share one consistent composer contract.
- Existing file, command, and plugin entry points continue to work.

### Task 5: Environment Popover Completion

**Files:**
- Modify: `packages/gui/src/screens/Workspace.tsx`
- Modify: `packages/gui/src/ipc/contract.ts`
- Test: `packages/gui/tests/workspace-screen.test.tsx`

- [ ] Finish the floating environment card so it reliably shows:
  - added/deleted counts
  - branch and branch switcher
  - commit/push and PR actions
  - active progress steps
  - browser target
  - sources
- [ ] Remove placeholder-feeling controls and replace them with honest actions or read-only states.
- [ ] Make branch selection feel like an inline popover, matching the screenshot pattern.
- [ ] Add tests for:
  - git counts render from real summary data
  - branch list opens and highlights the current branch
  - progress steps reflect the active thread plan
- [ ] Run:
  - `pnpm --filter @bobby/gui test -- workspace-screen.test.tsx`

**Acceptance:**
- The environment card becomes the unified context surface for git, progress, browser, and sources.
- Current branch and dirty state are immediately visible.

### Task 6: Files Panel Parity

**Files:**
- Modify: `packages/gui/src/components/SessionToolDock.tsx`
- Modify: `packages/gui/src/ipc/contract.ts`
- Test: `packages/gui/tests/session-tool-dock.test.tsx`
- Test: `packages/gui/tests/workspace-screen.test.tsx`

- [ ] Rework the files dock into a clearer split tree/preview layout.
- [ ] Make the empty preview state explicitly tell the user to select a file from the workspace tree.
- [ ] Tighten tree filtering, selection focus, and folder expansion behavior to better match the screenshot flow.
- [ ] Ensure file insertion back into the composer still works from the dock.
- [ ] Add tests for:
  - file tree filter narrows results
  - selecting a file updates the preview pane
  - empty preview state renders before selection
- [ ] Run:
  - `pnpm --filter @bobby/gui test -- session-tool-dock.test.tsx workspace-screen.test.tsx`

**Acceptance:**
- Files panel reads like a real right-side workspace tool, not a utility drawer.
- Tree and preview panes are clearly separated.

### Task 7: Automations Shell Integration

**Files:**
- Modify: `packages/gui/src/screens/ScheduleTasks.tsx`
- Modify: `packages/gui/src/screens/History.tsx`
- Modify: `packages/gui/src/main.tsx`
- Test: `packages/gui/tests/automations.test.tsx`
- Test: `packages/gui/tests/history.test.tsx`

- [ ] Add an explicit jump path from automations into history/task results.
- [ ] Make the automations page expose result visibility instead of only CRUD/run-now controls.
- [ ] Ensure notification and history routing agree on where automation output lives.
- [ ] Add tests for:
  - run-now failure still surfaces as error card
  - clicking the automation result/history action opens the expected page
  - resumed history entry can return to the owning task
- [ ] Run:
  - `pnpm --filter @bobby/gui test -- automations.test.tsx history.test.tsx`

**Acceptance:**
- Automations become part of the shell workflow, not an isolated settings page.
- Automation output has a visible path back into history/task context.

### Task 8: Desktop Persistence And Visual System

**Files:**
- Modify: `packages/gui/src/store/app-store.ts`
- Modify: `packages/gui/src/store/chat-store.ts`
- Modify: `packages/gui/src/styles/tokens.css`
- Modify: `packages/gui/src/app.css`
- Test: `packages/gui/tests/app-store.test.ts`
- Test: `packages/gui/tests/smoke.test.ts`

- [ ] Persist the remaining high-value shell state:
  - active project
  - active task
  - open dock tab
  - dock open/closed
  - left/right widths if introduced
- [ ] Finish the dark workbench visual pass:
  - near-black background
  - softer elevated surfaces
  - thin borders
  - larger composer/popover rounding
  - compact list rows
  - consistent focus/active colors
- [ ] Verify keyboard shortcuts still behave around the composer.
- [ ] Add tests for:
  - restored dock state
  - restored active task/project where applicable
  - smoke-visible shell regions after reload
- [ ] Run:
  - `pnpm --filter @bobby/gui test -- app-store.test.ts smoke.test.ts`

**Acceptance:**
- Bobby reopens into a coherent previous workspace state.
- The whole app feels visually like one system instead of mixed generations of UI.

## 9. Cross-Batch Verification Rules

After each accepted batch:

- [ ] Run the narrowest relevant GUI tests first.
- [ ] Run `pnpm --filter @bobby/gui test`.
- [ ] Run `pnpm --filter @bobby/gui smoke:electron` for shell/composer/dock/IPC changes.
- [ ] Commit immediately.
- [ ] Push immediately.

For milestone completion:

- [ ] Run `pnpm -r test`
- [ ] Run `pnpm build`

## 10. Final Screenshot Parity Audit

The final manual audit must validate all of the following against the screenshot set:

- [ ] Left icon rail and project/task navigator feel like one coherent navigation system.
- [ ] Empty state keeps left rail, project list, composer, and right shortcuts visible.
- [ ] The center column keeps task transcript density and hierarchy.
- [ ] Environment popover exposes git, branch, progress, browser, and sources in one surface.
- [ ] Files panel behaves as split tree + preview.
- [ ] Right tool shortcuts remain visible and useful during active task work.
- [ ] Composer menus and context row match the screenshot structure closely enough that the difference is polish-level, not architecture-level.

## 11. Final Acceptance Script

- [ ] Open a project.
- [ ] Start two tasks under the same project.
- [ ] Confirm the left navigator shows both tasks with separate statuses.
- [ ] Use global search and jump back into one task.
- [ ] Open the files dock and insert a file reference.
- [ ] Use the plugin menu and open the Plugins page.
- [ ] Open the environment popover and inspect branch and git counts.
- [ ] Open terminal, browser, review, and files from the right dock.
- [ ] Trigger one automation and jump to its resulting history/task surface.
- [ ] Restart the app and confirm meaningful shell state is restored.
- [ ] Run `pnpm -r test`.
- [ ] Run `pnpm --filter @bobby/gui smoke:electron`.

## 12. Recommended First Execution Slice

Start with **Task 1: Shell Hierarchy Refactor** and **Task 2: Left Navigation Parity** together, because the screenshots show the biggest mismatch on the left side and overall shell composition.

Do not start with more inner-panel work until the shell stops looking structurally different from Codex Desktop.

Plan complete and saved to `docs/superpowers/plans/2026-06-12-bobby-codex-desktop-ui-parity-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
