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

## 2.1 Screenshot-To-Module Mapping

This plan treats each visible Codex Desktop region as an explicit Bobby module. Work should not proceed as generic "polish"; every screenshot-observed region must map to a stable owner in code.

| Screenshot area | Bobby target module | Primary files likely involved |
|---|---|---|
| Left icon rail | `ActivityRail` | `packages/gui/src/components/Sidebar.tsx`, shell layout files |
| Project tree + task rows | `ProjectTaskNavigator` | `packages/gui/src/components/Sidebar.tsx`, `packages/gui/src/store/chat-store.ts` |
| Center transcript | `MainTaskWorkspace` | `packages/gui/src/screens/Workspace.tsx`, chat block components |
| Task header bar | `TaskHeader` | `packages/gui/src/screens/Workspace.tsx` |
| Floating composer | `ComposerConsole` | `packages/gui/src/screens/Workspace.tsx`, composer-related components/store wiring |
| Environment info card | `EnvironmentPopover` | GUI shell files, IPC bridge, git/progress/browser/source state |
| Right tool shortcuts | `ToolDockLauncher` | workspace shell and dock components |
| Review panel | `ReviewPanel` | proposal/review UI, dispatch/apply components |
| Terminal panel | `TerminalPanel` | terminal IPC surface and dock UI |
| Browser panel | `BrowserPanel` | preview/browser state and dock UI |
| Files panel | `FilesPanel` | workspace tree IPC, file viewer UI |
| Plugins menu/page | `PluginsWorkbench` | plugin settings page, composer menu, MCP status views |

## 2.2 Current Gap Matrix

The screenshots show that Bobby is still behind Codex Desktop in both structure and behavior. The following matrix is the authoritative gap list for the next implementation wave.

| Area | Codex screenshot behavior | Bobby current state | Gap class | Required outcome |
|---|---|---|---|---|
| Shell hierarchy | Three-column workbench with floating overlays | Partially split, still reads as custom dashboard | Structural | Land stable Codex-style shell primitives |
| Left navigation | Activity rail separate from project/task tree | Mixed sidebar responsibilities | IA | Split rail vs navigator cleanly |
| Project model | Tasks nested under projects, searchable picker | Basic project handling, not first-class in navigation | Product | Make project selection and grouping central |
| Task transcript | Dense task stream with explicit command/evidence blocks | Chat stream exists, but still simplified | Behavioral | Upgrade transcript semantics without hiding evidence |
| Composer | Unified control console with modes, plugins, permissions, project, branch | Partially redesigned, not yet feature-complete parity | Product | Finish integrated console contract |
| Environment card | Unified git/progress/browser/sources surface | Missing as a first-class surface | Structural | Add floating context popover |
| Files tool | Docked split view with tree + preview | Presently not parity-grade | Functional | Build right-side files workspace |
| Terminal tool | Docked terminal bound to project root | Limited/current placeholder behavior | Functional | Provide command execution panel with evidence |
| Review flow | Review is a visible first-class dock path | Present but not yet Codex-grade workflow | High-risk | Keep gate authority and upgrade UX |
| Plugin surface | Composer plugin menu and plugin management page | Fragmented | Product | Unify menu, page, and evidence surfacing |
| Automation surface | Left entry with runnable history and jump-back | Not yet parity-grade | Product | Integrate automations into shell and history |
| Desktop persistence | Dock/tool/project/task state persists | Partial | Usability | Persist and restore full workspace state |

## 2.3 Guardrails For This UI Program

These rules apply to every parity slice:

1. No screenshot-only rewrites. Every visual change must preserve or improve the current typed state model.
2. No fake controls. Buttons or menus visible in the UI must either work end-to-end or be explicitly marked unavailable.
3. No renderer-owned business rules. Gate authority, git actions, session state, apply/rewind, and automation constraints stay outside presentational components.
4. No evidence regression. Command output, reasoning, review status, and source visibility remain inspectable after any redesign.
5. No broad refactor without slice acceptance. Each module lands behind passing tests and smoke coverage, then commit and push.

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

Status:

- Completed on 2026-06-12.
- Implemented with current project path, project-root command execution, local rerun control, local clear-history control, and preserved task evidence stream.
- Verified with focused GUI tests, GUI package tests, Electron smoke, and full workspace tests.

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

Status:

- Completed on 2026-06-12.
- Implemented with docked local browser target input, refresh control, iframe-backed preview surface, preview-target synchronization, preview-server handoff, and explicit error cards for unsupported external targets.
- Verified with focused GUI tests, GUI package tests, Electron smoke, and full workspace tests.

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

Status:

- Completed on 2026-06-12.
- Implemented with review readiness statuses, changed-file listing, proposal diff visibility, gated apply/discard actions, and git commit flow inside the review dock.
- Verified with focused GUI tests, GUI package tests, Electron smoke, and full workspace tests.

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

## 4.1 Cross-Module Dependency Notes

The UI workstreams are not independent. The following dependencies should shape implementation order:

| Depends on | Why it must come first |
|---|---|
| Shell layout before tool parity | Review/files/browser/terminal all need a stable dock host and region sizing model |
| Per-thread session routing before task visuals | Navigator, progress surfaces, and task header state will be wrong if task ownership is still ambiguous |
| Composer console before plugin/command parity | Plugins, custom commands, plan mode, and permission flows all enter through the composer |
| Environment popover before git/progress parity claims | Branch, dirty state, progress, and sources need one shared state surface |
| Review dock before apply/commit UX parity | Completion gate cannot be represented cleanly without a review-first panel |

## 5. Delivery Batches

The work should now be executed as parity batches rather than ad hoc GUI edits.

### Batch A: Shell Foundation

- Activity rail
- Project/task navigator
- centered empty state
- task header framing
- right dock launcher strip
- floating composer baseline

Exit criteria:

- Shell regions match screenshot hierarchy at 1366 px and 1440 px
- Active task switching still works
- No regression in send flow or transcript rendering

### Batch B: Task And Composer Behavior

- per-thread status rendering
- command/evidence/reasoning cards
- plan mode / goal tracking / permissions wiring
- project picker / branch context row
- plugin menu surface

Exit criteria:

- Two concurrent tasks remain visually and logically isolated
- Composer controls affect real store/backend behavior
- Screenshot parity for the lower-third control area is credible

### Batch C: Right Dock Workspace

- Review panel
- Terminal panel
- Browser panel
- Files panel
- dock persistence and shortcuts

Exit criteria:

- Every right-side shortcut opens a real working panel
- Panels follow active project/task context
- Errors surface as cards, not silent failures

### Batch D: Context And Git Surface

- environment popover
- branch switcher
- dirty counts
- progress list
- sources list
- commit/push and PR affordances

Exit criteria:

- Git context is accurate and actionable
- Progress follows the active task only
- No action bypasses completion gate discipline

### Batch E: Plugins, Automations, Search, Persistence

- plugin workbench
- automations page/history/jump
- global search
- desktop state restore
- final visual system pass

Exit criteria:

- Plugin, automation, and search entries are first-class shell citizens
- App restart restores meaningful workspace state
- Final screenshot audit is mostly green except explicitly deferred items

## 6. Recommended Execution Order

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

## 7. Immediate Next Slice

### E1-UIA: Shell And Left Navigation Hardening

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

### E1-UIB: Center Workspace And Composer Completion

Task:

- Finish the Codex-style center workspace and composer contract:
  - remove non-parity header clutter from empty-state mode
  - finalize composer menu structure
  - ensure project picker, plan mode, goal tracking, and permission chips have correct real behavior
  - keep right dock shortcuts visible in empty and active states

Files likely touched:

- `packages/gui/src/screens/Workspace.tsx`
- `packages/gui/tests/workspace-screen.test.tsx`
- composer-related component files if extracted

Acceptance:

- Empty state has one dominant centered focal prompt
- Composer controls remain functional in empty and active task states
- Right dock shortcuts remain visible with or without an active transcript
- `pnpm --filter @bobby/gui test -- workspace-screen.test.tsx`
- `pnpm -r test`
- Electron smoke
- Commit and push immediately

## 8. Per-Module Acceptance Matrix

This matrix is the working definition of "done enough" for each surface.

| Module | Minimum acceptance |
|---|---|
| `ActivityRail` | icons/labels render, active state works, settings stays bottom-anchored |
| `ProjectTaskNavigator` | project grouping, active task highlight, running state icon, scroll usability |
| `MainTaskWorkspace` | active transcript correct, empty state distinct, evidence visible |
| `TaskHeader` | title/status accurate per thread, does not pollute empty-state focal hierarchy |
| `ComposerConsole` | send, stop, plan mode, goal tracking, permission chip, project picker all wired |
| `EnvironmentPopover` | git counts, branch, progress, browser, sources render from real state |
| `ReviewPanel` | diff/proposal state visible, apply respects all gates |
| `TerminalPanel` | runs command in project root, shows stdout/stderr/exit code |
| `BrowserPanel` | opens preview target, shows load/error state |
| `FilesPanel` | searchable tree, preview, file selection, insert reference |
| `PluginsWorkbench` | installed plugins visible, capability state accurate, tool calls evidenced |
| `Automations` | list/create/run/history/jump flow works end-to-end |

## 9. Final Desktop Parity Acceptance Script

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

## 10. Commit Discipline

For every sub-work item:

1. Implement the smallest real capability increment.
2. Add or update tests.
3. Run targeted tests.
4. Run `pnpm -r test` before claiming acceptance.
5. Run Electron smoke for shell/composer/dock/IPC changes.
6. Commit and push immediately.
7. Report exact commands and results.

No work item is accepted based on screenshots, subjective similarity, or "it should work." Evidence must be machine-verifiable where possible and manually reproducible where the feature is visual.
