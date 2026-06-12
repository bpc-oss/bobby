# Bobby Codex Desktop UI Parity Plan

> Date: 2026-06-12
> Scope: Follow-up UI/IA development plan derived from the user's Codex Desktop screenshots.
> Parent directive: `docs/superpowers/plans/2026-06-11-bobby-desktop-parity-directive.md`
> Execution discipline: `docs/superpowers/plans/2026-06-04-bobby-execution-protocol.md`

## 0. Purpose

Bobby's current GUI has made functional progress, but its product shape is still far from Codex Desktop. The gap is not just visual styling. Codex Desktop is a desktop agent workbench with a strong spatial model:

1. A left-side project and conversation navigation system.
2. A central task stream with structured agent turns.
3. A right-side tool dock for review, terminal, browser, files, and side panels.
4. Floating environment/context surfaces for git, progress, browser, and sources.
5. A bottom composer that acts as a task control console, not just a text input.

This plan converts the screenshot observations into concrete implementation workstreams and acceptance gates for Bobby.

## 1. Reference Screenshot Observations

The user provided seven Codex Desktop screenshots on 2026-06-12. The screenshots should be treated as the visual and interaction reference for this plan.

### Image 1: Main Running Task Workbench

- Left rail contains primary app areas: quick/new chat, search, plugins, automations, pinned, project, conversation, settings.
- Central panel is a task transcript, not a generic chat page.
- Agent text uses high-density typography with inline code chips.
- Running status appears as "thinking" / active progress.
- Bottom composer floats above the bottom edge and includes permission, target, model, voice, send/stop, and attachment controls.
- Right side has a docked quick panel with Review, Terminal, Browser, Files, Sidebar shortcuts.
- A floating environment popover shows git changes, branch, commit/push, PR creation, progress steps, browser target, and sources.

### Image 2: Files Panel

- Files panel is split: left side empty/open-file preview, right side workspace file tree.
- File tree has search/filter, folder expansion, file icons, selected-row focus, and compact spacing.
- Empty state explicitly says to select a file from the workspace tree.
- Files are part of the right tool workspace, not a separate full-page navigation area.

### Image 3: Branch And Environment Popover

- Environment popover is compact, rounded, and floating.
- Git branch selector opens an inline branch search/list popover.
- Current branch is checked.
- Dirty state is visible.
- Actions include create/check out branch, commit/push, and PR.
- Progress list is integrated into the same context surface.

### Image 4: Terminal Panel

- Terminal opens in the right tool area.
- Terminal tab shows a shell icon and current path.
- It uses the active project working directory.
- The environment popover can remain visible while the terminal is open.

### Image 5: Composer Menus

- Composer has a plus menu with:
  - Add photos and files.
  - Create submenu.
  - Plan mode toggle.
  - Goal tracking toggle.
  - Plugins submenu.
- Plugins submenu lists installed plugins, including Browser, Chrome, Computer, and LaTeX.
- Permission mode is visible in orange.
- Model selector and send button are embedded in the same composer shell.

### Image 6: Left Project Tree And Conversation List

- Left rail has top-level actions and a project tree.
- Projects appear as folders.
- Selected task/conversation is nested under its project.
- Running task shows an activity spinner.
- Settings is anchored at the bottom.
- The panel is scrollable and dense.

### Image 7: New Task Empty State And Project Picker

- Empty state centers the question "What should we build?"
- Composer is centered and prominent.
- Project selector opens a searchable project picker.
- Picker includes recent projects, add new project, and no-project mode.
- Right tool shortcuts remain available in the empty state.

## 2. Target Information Architecture

### Shell

The Bobby GUI should be organized as:

```text
Desktop Window
  Top Menu Bar
  Left Activity Rail
  Left Project/Task Navigation
  Main Task Workspace
  Right Tool Dock
  Floating Environment Popover
  Bottom Composer Console
```

### Primary Regions

| Region | Responsibility | Current Bobby Gap |
|---|---|---|
| Activity rail | New chat, search, plugins, automations, settings | Current sidebar mixes navigation and session list |
| Project tree | Recent projects and per-project tasks | Needs Codex-style project grouping |
| Main task stream | Active thread transcript, live reasoning, evidence, results | Current chat is serviceable but not Codex-like |
| Composer console | Input plus permissions, model, mode, target, plugins, attachments | Current composer is simpler and less integrated |
| Right dock | Review, terminal, browser, files, side panels | Current dock exists but needs Codex-style integration |
| Environment popover | Git, progress, browser, sources | Missing as a unified surface |

## 3. Non-Negotiable Product Invariants

1. Completion gate remains the only authority for Apply, rewind, automation, and finish states.
2. Evidence visibility must not regress.
3. API keys never appear in renderer state; renderer only sees `hasApiKey`.
4. UI errors must surface as error cards.
5. New IPC must use Zod validation.
6. UI must not contain core business logic; renderer orchestrates display and calls typed IPC.
7. DeepSeek vision and streaming must be probe-backed before UI claims support.
8. Every accepted work item must be committed and pushed immediately.

## 4. Workstreams

### P0: Codex Shell Layout

Goal: Convert Bobby from a dashboard-like GUI into a Codex-style desktop workbench.

Scope:

- Add top menu visual area where needed.
- Split current sidebar into activity rail and project/task navigation.
- Preserve central task workspace.
- Add right tool dock host.
- Add floating environment popover host.
- Rework composer positioning into a bottom floating console.

Implementation notes:

- Keep existing data sources where possible.
- Avoid a big-bang rewrite of all panels.
- Introduce layout primitives first:
  - `AppShell`
  - `ActivityRail`
  - `ProjectTaskNavigator`
  - `MainTaskWorkspace`
  - `ToolDockHost`
  - `EnvironmentPopover`
  - `ComposerConsole`

Acceptance:

- 1366, 1440, and 1920 px widths remain usable.
- Left, center, and right regions are visually distinct.
- Existing workspace send flow still works.
- `pnpm -r test` passes.
- Electron smoke passes after layout lands.

### P1: Left Activity Rail And Project Task Navigation

Goal: Match Codex's left navigation model.

Scope:

- Activity rail entries:
  - New chat / quick chat.
  - Search.
  - Plugins.
  - Automations.
  - Settings.
- Project tree:
  - Recent projects as folders.
  - Tasks grouped by `projectDir`.
  - Active task highlight.
  - Running spinner.
  - Done / failed / blocked icons.
- Project selector:
  - Search recent projects.
  - Add new project.
  - No-project mode.

Implementation notes:

- Extend current `Sidebar` instead of duplicating navigation.
- Derive task rows from `threads`, not global `busy`.
- Group threads by `projectDir`.
- Keep `activeSessionId` as active thread identity.

Acceptance:

- Switching task changes active transcript.
- Running task remains visible while another task is active.
- One failed task does not change another task's visual status.
- Project grouping survives reload through sessions.

### P2: Main Task Stream Redesign

Goal: Make the center column feel like a Codex task transcript.

Scope:

- Add task header:
  - Title.
  - More menu.
  - Optional tool toggles.
- Redesign block rendering:
  - User turn.
  - Assistant turn.
  - Reasoning turn.
  - Command summary.
  - Evidence card.
  - Gate card.
  - Error card.
  - Final result card.
- Add "ran N commands" summary blocks.
- Add centered empty state for new chats.

Implementation notes:

- Keep `ChatBlock` as the render contract initially.
- Add renderer components before changing the store shape.
- Avoid hiding evidence inside decorative UI.

Acceptance:

- Live assistant/reasoning output remains visible while running.
- Tool/evidence blocks are clickable or expandable.
- Final result updates only the owning thread.
- Empty state matches Codex's large centered prompt pattern.

### P3: Composer Console

Goal: Replace the simple composer with a Codex-style task control console.

Scope:

- Main input:
  - Multiline input.
  - Enter send.
  - Shift+Enter newline.
  - Send/stop button.
- Bottom controls:
  - Attach files/images.
  - Create menu.
  - Permission mode.
  - Plan mode.
  - Goal tracking.
  - Model selector.
  - Voice placeholder.
  - Plugins menu.
- Context row:
  - Project picker.
  - Local mode.
  - Branch picker.

Implementation notes:

- Move existing `SessionModeSwitcher`, permission display, slash command handling, and file reference UI into `ComposerConsole`.
- `@` file references must continue to use workspace search.
- `/` command menu must read custom commands.
- Permission changes must affect backend behavior, not only labels.

Acceptance:

- `@` inserts a real file reference.
- `/` inserts or executes a real command template.
- Plan-only mode emits plan without tool execution.
- Permission mode is visible and enforced.
- Plugin menu reflects available plugin/tool capability.

### P4: Floating Environment Popover

Goal: Add the Codex-style context card for git, progress, browser, and sources.

Scope:

- Environment info:
  - Git additions and deletions.
  - Local/remote state.
  - Current branch.
  - Commit/push action.
  - Create PR action.
- Progress:
  - Active plan steps.
  - Done/running/pending statuses.
- Browser:
  - Current local preview/browser target.
- Sources:
  - Referenced files.
  - Attachments.
  - MCP/tool sources.

Implementation notes:

- Add typed IPC for git status if current coverage is insufficient.
- Reuse existing `currentPlan` and task source data.
- Treat missing browser/source info as an explicit empty state.

Acceptance:

- Git counts match `git diff --stat`/porcelain-derived data.
- Branch dropdown can search and switch branches.
- Commit/push does not bypass validation discipline.
- Progress list follows active thread.

### P5: Right Tool Dock Host

Goal: Make Review, Terminal, Browser, Files, and Sidebar first-class docked tools.

Scope:

- Tool entries:
  - Review (`Ctrl+Shift+G`).
  - Terminal.
  - Browser (`Ctrl+T`).
  - Files (`Ctrl+P`).
  - Sidebar (`Ctrl+Alt+S`).
- Dock behavior:
  - Open/close.
  - Resize.
  - Tab header.
  - Per-tool empty states.
  - Persist open tool across reload.

Implementation notes:

- Decompose current `SessionToolDock` into:
  - `ToolDockHost`
  - `ReviewPanel`
  - `TerminalPanel`
  - `BrowserPanel`
  - `FilesPanel`
  - `SourcesPanel`
- Keep panel state per active project/thread where appropriate.

Acceptance:

- Keyboard shortcuts open the right tool.
- Dock context follows active project/thread.
- Tool failures show error cards.

### P6: Files Panel

Goal: Match Codex's right-side file browser.

Scope:

- Search/filter input.
- Folder expand/collapse.
- File icons by type.
- Selected file focus state.
- Empty preview state.
- File content viewer.
- Insert file reference into composer.

Implementation notes:

- Reuse existing workspace tree IPC.
- Add lazy loading or virtualization if needed.
- Protect large/binary files with clear UI states.

Acceptance:

- Tree matches disk.
- Search returns real files.
- Selected file content is accurate.
- File reference insertion works.

### P7: Terminal Panel

Goal: Provide a real terminal-like project tool panel.

Scope:

- Terminal tab with current path.
- Project-root working directory.
- Command input.
- Real output display.
- Copy/clear/rerun controls.
- Evidence integration.

Implementation notes:

- Start with existing `runTerminalCommand` IPC if pty is not ready.
- Later upgrade to real pty tabs.
- Manual terminal commands must go through permission gates.

Acceptance:

- User can run a command in the project root.
- Exit code, stdout, and stderr are visible.
- Command output can become task evidence.

### P8: Browser Panel

Goal: Match Codex's browser/preview dock.

Scope:

- Embedded browser/preview panel.
- URL input and refresh.
- Localhost preview support.
- Preview server launch integration.
- Browser target in environment popover.

Implementation notes:

- Reuse existing preview server.
- Start with iframe/webview constrained to local targets.
- Clearly show blocked external/unsafe targets if unsupported.

Acceptance:

- Bobby can open its local preview target.
- Preview server launch updates the browser panel.
- Browser errors are visible.

### P9: Review, Diff, Apply, And Commit

Goal: Make Codex-style review the primary path for proposals and worktree changes.

Scope:

- Changed files list.
- Diff viewer.
- Proposal summary.
- Completion gate status.
- Pro review status.
- Human confirmation.
- Apply / Discard.
- Git commit.

Implementation notes:

- Preserve current proposal merge safety:
  - `gatePassed`
  - `proReviewPassed`
  - `humanConfirmed`
- Do not add any "skip validation" UI.
- Worktree tasks should land in Review by default.

Acceptance:

- Worktree proposal does not mutate main tree before Apply.
- Apply requires all gates.
- Applied proposal cleans up patch and marks dispatch applied.
- Commit only works in git projects.

### P10: Global Search

Goal: Add Codex-style search across projects, files, sessions, commands, and tools.

Scope:

- Search panel from left rail.
- Result groups:
  - Projects.
  - Files.
  - Tasks/sessions.
  - Commands.
  - Plugins/tools.
- Keyboard navigation.

Implementation notes:

- Reuse:
  - `listProjects`
  - `searchFiles`
  - `listSessions`
  - `listTasks`
  - `listCommands`
  - `listMcpServers`
  - `listSubAgents`

Acceptance:

- Selecting a project switches project.
- Selecting a task switches thread.
- Selecting a file opens Files panel.
- Selecting a command inserts or runs the command template.

### P11: Plugins And MCP Workbench

Goal: Bring plugin/MCP management into the Codex-style surface.

Scope:

- Composer plugins menu.
- Plugins page.
- Installed plugin list.
- MCP server health.
- Tool inventory.
- Enable/disable/remove.

Implementation notes:

- Continue using current MCP manager.
- Expose capability status honestly.
- Plugin tool calls must produce evidence.

Acceptance:

- Plugin menu and Plugins page agree.
- Built-in filesystem MCP appears and can be disabled.
- MCP tool calls are visible in task evidence.

### P12: Automations

Goal: Align the Automations entry with real scheduled/headless Bobby tasks.

Scope:

- Automation list.
- Create/edit/remove.
- Run now.
- Schedule/monitor/reminder types.
- Notification jump.
- History/thread artifact.

Implementation notes:

- Build on current automation IPC and timeout protection.
- A failed automation must generate a visible task/error artifact.

Acceptance:

- 1-minute scheduled automation fires.
- Notification click jumps to the relevant task/thread.
- Failure is visible in History and error card.

### P13: Shortcuts And Window State

Goal: Make Bobby feel like a desktop workbench.

Scope:

- `Ctrl+N`: new chat.
- `Ctrl+K`: global search.
- `Ctrl+T`: browser.
- `Ctrl+P`: files.
- `Ctrl+Shift+G`: review.
- `Ctrl+Alt+S`: side dock/sidebar.
- Persist:
  - Window state.
  - Left nav width.
  - Right dock width.
  - Active tool.
  - Active project.
  - Active task.

Acceptance:

- Shortcuts do not conflict with composer typing.
- Reload restores the last workspace state.

### P14: Visual System

Goal: Make Bobby visibly match the Codex Desktop workbench style.

Scope:

- Dark-first shell.
- Near-black background.
- Soft elevated panels.
- Thin borders.
- Large rounded composer and popovers.
- Compact list rows.
- Inline code chips.
- Status colors:
  - Orange for permissions/warnings.
  - Green for additions/pass.
  - Red for deletions/failures.
  - Blue for focus.
- Motion:
  - Popover fade/scale.
  - Dock slide.
  - Running spinner.

Acceptance:

- Bobby screenshot at 1440 px has the same structural hierarchy as Codex screenshots.
- Composer and popovers no longer feel like generic dashboard controls.
- Existing accessibility basics remain: focus states, labels, keyboard navigation.

## 5. Recommended Execution Order

This UI plan should be layered on top of the existing E0-E10 sequence.

```text
E1-UIA  Shell layout + left activity/project/task navigation
E1-UIB  Composer console + strict per-thread active/busy/status derivation
E2-UI   Task stream persistence and resume visual replay
E3-UI   Review/diff/apply + checkpoint timeline surfaces
E4-UI   @file, slash command, attachment, plugin composer menus
E5-UI   Permission/mode/model controls
E6-UI   Plugins/MCP workbench
E7-UI   Subagents/background tasks panel
E8-UI   Files, terminal, browser, preview right dock
E9-UI   Custom commands in composer and command manager
E10-UI  Automations page, notification jump, history artifacts
Final   Screenshot parity audit + full manual desktop acceptance script
```

## 6. Next Immediate Work Item

### E1-UIA: Shell And Left Navigation

Task:

- Build the Codex-style shell foundation:
  - `ActivityRail`
  - `ProjectTaskNavigator`
  - task grouping by project
  - per-thread status display
  - active/running/done/failed/blocked visual states

Files likely touched:

- `packages/gui/src/components/Sidebar.tsx`
- `packages/gui/src/screens/Workspace.tsx`
- `packages/gui/src/store/chat-store.ts`
- `packages/gui/tests/workspace-screen.test.tsx`
- `packages/gui/tests/chat-store.test.ts`

Acceptance:

- Two parallel tasks under one project show separate statuses.
- Failing one task does not change the other task.
- Switching tasks restores the right blocks and mode.
- Project grouping works after `loadSessions`.
- `pnpm --filter @bobby/gui test -- chat-store.test.ts workspace-screen.test.tsx`
- `pnpm -r test`
- Commit and push immediately.

## 7. Final Desktop Parity Acceptance Script

Full parity remains incomplete until this script passes on the real Electron app:

1. Open a project.
2. Start two parallel tasks.
3. Ensure one task uses worktree isolation.
4. Reference a file with `@`.
5. Run one task in plan-only mode.
6. Review a diff proposal.
7. Apply after completion gate and human confirmation.
8. Rewind to a middle checkpoint.
9. Restart app and resume the task.
10. Call an MCP tool.
11. Create and run a custom command.
12. Trigger an automation.
13. Click notification and jump to the resulting task.
14. Confirm all evidence remains visible.
15. Run `pnpm -r test`.
16. Run Electron smoke.

## 8. Commit Discipline

For every sub-work item:

1. Implement the smallest real capability increment.
2. Add or update tests.
3. Run targeted tests.
4. Run `pnpm -r test` before claiming acceptance.
5. Run Electron smoke for shell/composer/dock/IPC changes.
6. Commit and push immediately.
7. Report exact commands and results.

No work item is accepted based on screenshots, subjective similarity, or "it should work." Evidence must be machine-verifiable where possible and manually reproducible where the feature is visual.
