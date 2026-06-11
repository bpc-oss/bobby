# Bobby GUI Codex Desktop Directive

Date: 2026-06-11
Branch: `codex/bobby-cli-parity`

## Mission

Upgrade Bobby GUI from a single-thread chat window into a Codex Desktop style agent workbench.

The workbench must be project-centered, settings-connected, session-aware, evidence-visible, gate-driven, and able to support multiple running tasks without claiming completion before verification.

## Non-Negotiable Rules

1. Completion gates are authoritative. The GUI must never render an unverified task as complete.
2. Worktree proposal Apply requires gate pass, professional review pass, and human confirmation. There must be no "skip validation" UI.
3. Evidence visibility must not regress. Every completed task remains inspectable down to its evidence.
4. API keys must be stored only by the main process/keychain-equivalent storage. Renderer state, JSON settings, and localStorage must never contain the key body.
5. Renderer code must not own business logic. New IPC must validate payloads with Zod.
6. UI errors must render as error cards or explicit empty/error states, not blank screens.
7. Every work order needs failing tests first, implementation, and controller-side verification with real command output.

## D0: Baseline And Cleanup

Goal: Freeze a reliable baseline before feature work.

Required:
- Add `.bobby/` to `.gitignore`.
- Run `pnpm -r test`.
- Run TypeScript no-emit checks.
- Record baseline test counts.
- Commit or otherwise preserve current work before moving forward.

Acceptance:
- Full test suite is green.
- Runtime artifacts under `.bobby/` no longer leak into the worktree.

## D1: Project-Centered Workbench

Problem:
- `main.ts` previously used `process.cwd()` as the project root.

Required:
- GUI can open/select a project.
- Main process keeps the current project root.
- Kernel host/task execution uses the selected project root.
- Recent projects are visible.

Acceptance:
- Starting tasks after project selection runs against the selected project, not the launch directory.

## D2: Settings Wiring

Problem:
- Settings UI previously wrote only renderer localStorage and did not affect the main process.

Required:
- Settings screen reads/writes via IPC.
- DeepSeek key is never exposed back to renderer.
- Public settings expose only `hasApiKey`.
- Add tests proving API key material is not serialized into settings/localStorage.

Acceptance:
- Next task uses updated model/base URL/budget/permission settings from the main process.

## D3: Parallel Task Workbench

Required:
- Composer remains usable while a task is running.
- Session/task state does not collapse into a single global busy chat.
- Current task, plan, tools, evidence, gates, and final status are visible per session.

Acceptance:
- User can launch or stage another task while one task is running.
- UI does not show an unverified running task as completed.

## D4: Persistence And History

Required:
- Sessions persist across restarts.
- History can replay session/task evidence.
- Clicking an existing session must not duplicate it.

Acceptance:
- Restart preserves sessions.
- Selecting a session loads it in place instead of creating a same-name copy.

## D5: Diff And Review Loop

Required:
- Patch proposals are visible in the session side panel.
- Diff review is separate from generic board/status panels.
- Apply requires gate pass, review pass, and human confirmation.
- Discard is available.
- Undo/restore path is visible.

Acceptance:
- Proposal Apply cannot bypass the required gates.

## D6: Desktop System Integration

Required:
- Native app menu/tray/window-state integration.
- Notifications can jump the user back to relevant Bobby work.
- App commands such as new task flow through IPC.

Acceptance:
- Integration does not break tests or headless startup.

## D7: Onboarding

Required:
- First-run setup checks configuration and capability readiness.
- Quickstart/open-doc actions are available.
- Onboarding does not hide errors as blank screens.

Acceptance:
- Missing key/capability states guide the user into setup.

## D8: Automations

Required:
- Create/list/update/toggle/remove/run-now automations from the GUI.
- Automations use configured project/settings.
- Failures surface through visible error/notification states.

Acceptance:
- Automation CRUD and run-now flow are covered by tests.

## Session-Level UI Requirements

From earlier GUI review in this session:

- Do not keep `Write` and `Code` as prominent standalone AGI modules.
- Replace weak tool-first prompts with brainstorming-style mission guidance.
- Rename Autonomy Runtime to Mission Control.
- Mission Control belongs inside each session's right side panel, not as a global standalone page.
- Side panel must separate real tools from status boards, following Codex/Claude Code style:
  - Mission
  - Plan
  - Review
  - Diff
  - Terminal
  - Files
  - Browser
  - Side Chat
  - Preview
  - Background Tasks
- Panels must be switchable/collapsible.
- Review and diff panels must use real session data, not mock findings.

## Final Completion Definition

Required verification before claiming this directive complete:

- `pnpm -r typecheck` passes.
- `pnpm -r test` passes.
- Real GUI smoke check confirms the workbench layout:
  - left sessions/project rail,
  - center workspace,
  - right session tool dock.
- Manual flow to validate before release:
  - open project,
  - run two parallel tasks,
  - inspect diff proposal,
  - review,
  - Apply,
  - Undo,
  - restart,
  - History replay,
  - notification jump.
