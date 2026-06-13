# Bobby Project Status

## Goal

Finish the Bobby GUI shell rebuild around the Codex-style web experience, while preserving the accepted T1-T17 hosted execution baseline on `feat/gui-shell-p0p1`.

## Current State

- Branch: `feat/gui-shell-p0p1`
- T1-T17 implementation is present on this branch.
- P0 report is accepted and saved in `docs/superpowers/plans/acceptance/2026-06-13-p0-report.md`.
- P1 report is accepted and saved in `docs/superpowers/plans/acceptance/2026-06-13-p1-report.md`.
- The current working UI is the post-acceptance shell-polish pass named: `Codex-style shell parity snapshot`.
- Local preview target for manual review: `http://127.0.0.1:4173/`
- Current working tree is not clean:
  - `packages/gui/src/shell/Sidebar.tsx`
  - `packages/gui/tests/sidebar-live.test.tsx`

## This Version: Codex-style shell parity snapshot

This snapshot is the first Bobby web UI pass that consolidates the recent user feedback into one coherent shell:

- `Chat` and `代码` are treated as separate entry modes.
- `Chat` stays global by default and does not force a workspace picker for existing sessions.
- `代码` sidebar is organized closer to Codex:
  - `置顶`
  - `项目`
  - `全局通用`
- Code projects are rendered as collapsible groups with child sessions, not as a separate project landing page.
- The right-side shell and settings work were pushed toward Codex-style structure rather than the earlier stacked/duplicated controls.
- Settings was rebuilt into a grouped Codex-like screen with section navigation and bilingual copy.

## Changes In This Session

- Added the shell-parity implementation commit:
  - `c4e28d7 feat(gui): advance Codex-style shell parity`
- Added GUI reference capture assets:
  - `e0f6687 docs(gui): add GUI reference captures`
- Opened the local web UI and verified the current browser-visible state at `http://127.0.0.1:4173/`.
- Started one more sidebar polish pass that is not committed yet:
  - when a historical session is selected, the `新会话` function entry should no longer remain highlighted

## Uncommitted Delta

- `packages/gui/src/shell/Sidebar.tsx`
  - adjusts function-button active-state logic so the `session` shortcut only stays active when no concrete session is selected
- `packages/gui/tests/sidebar-live.test.tsx`
  - adds regression coverage for clearing the `新会话` highlight after selecting a history thread

## Touched Files

- `packages/gui/src/screens/Settings.tsx`
- `packages/gui/src/screens/settings-sections.ts`
- `packages/gui/src/shell/AppShell.tsx`
- `packages/gui/src/shell/Sidebar.tsx`
- `packages/gui/src/shell/shell.css`
- `packages/gui/src/app.css`
- `packages/gui/tests/app-shell.test.tsx`
- `packages/gui/tests/settings.test.tsx`
- `packages/gui/tests/sidebar-live.test.tsx`
- `docs/superpowers/specs/2026-06-13-bobby-settings-codex-parity-design.md`
- `.codex-artifacts/gui-code-projects.png`
- `packages/gui/bobby-draft-session-behavior.png`
- `packages/gui/bobby-gui-code-gate-compact-tabs.png`
- `packages/gui/bobby-gui-code-gate-responsive.png`
- `packages/gui/bobby-gui-code-gate.png`
- `packages/gui/bobby-gui-open.png`
- `packages/gui/bobby-right-panel-auto-menu.png`
- `packages/gui/bobby-right-panel-closed.png`
- `packages/gui/bobby-right-panel-deduped.png`
- `packages/gui/bobby-right-panel-menu-open.png`
- `packages/gui/bobby-summary-codex-like.png`
- `packages/gui/mockup-reference.png`

## Decisions

- Keep the accepted T1-T17 branch as the delivery base and layer shell-polish work on top of it.
- Treat `project` and `session` as different concepts in `代码` mode:
  - project = a local working directory
  - session = a thread that may belong to a project or may stay global
- Do not force workspace selection inside existing chat sessions.
- Keep the whole GUI global-first, then let project association happen inside the code-session flow.

## Verification

- `pnpm --filter @bobby/gui test`
- `pnpm --filter @bobby/gui typecheck`
- `pnpm lint`
- `pnpm -r build`
- `pnpm --filter @bobby/gui test tests/sidebar-live.test.tsx`

## Blockers

- None on the accepted T1-T17 path.
- One small uncommitted sidebar polish remains in progress and should be committed or discarded explicitly before the next milestone.

## Next Step

From the next conversation, continue from `Codex-style shell parity snapshot` and decide in this order:

1. Finish or discard the current uncommitted sidebar highlight fix.
2. Continue shell parity review in the live web UI.
3. If the next major surface is still settings, run TDD for the remaining Codex settings-page parity gaps.
