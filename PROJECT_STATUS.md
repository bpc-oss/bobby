# Bobby Project Status

## Goal

Finish the Bobby GUI shell hosted execution from T1 through T17, including P0 and P1 acceptance evidence.

## Current State

- Branch: `feat/gui-shell-p0p1`
- T1–T17 implementation is present on this branch.
- P0 gate is accepted and saved in `docs/superpowers/plans/acceptance/2026-06-13-p0-report.md`.
- P1 command acceptance is green:
  - `pnpm --filter @bobby/gui test`
  - `pnpm --filter @bobby/gui typecheck`
  - `pnpm lint`
  - `pnpm -r build`
- P1 acceptance report is saved in `docs/superpowers/plans/acceptance/2026-06-13-p1-report.md`.
- Browser rehearsal remains a manual follow-up item when the reviewer environment cannot open the local dev target; protocol treats those items as `UNVERIFIED`, not `FAIL`.

## Changes In This Session

- Separated baseline cleanup from hosted execution and re-verified the baseline independently.
- Fixed P1 acceptance visibility by making default `@bobby/gui` test output print the mock gate pause / resume / reject case names.
- Identified a false-negative browser rejection caused by stale Bobby Vite dev servers occupying ports `5173`–`5183` with mixed optimized dependency hashes.
- Cleared the stale Bobby Vite processes, re-verified a clean single-port dev instance, and recorded the acceptance adjudication.
- Saved the P1 acceptance rounds and controller adjudication in the acceptance report.

## Touched Files

- `packages/gui/src/kernel/mock/mock-client.ts`
- `packages/gui/src/panels/ReviewPanel.tsx`
- `packages/gui/src/panels/RightPanel.tsx`
- `packages/gui/src/shell/AppShell.tsx`
- `packages/gui/src/shell/Sidebar.tsx`
- `packages/gui/src/shell/sidebar-config.ts`
- `packages/gui/src/store/session-store.ts`
- `packages/gui/src/workspace/SessionView.tsx`
- `packages/gui/src/workspace/TimelineCards.tsx`
- `packages/gui/tests/fixtures.test.ts`
- `packages/gui/tests/mock-client.test.ts`
- `packages/gui/tests/review-panel.test.tsx`
- `packages/gui/tests/session-store.test.ts`
- `packages/gui/tests/session-view-live.test.tsx`
- `packages/gui/tests/sidebar-live.test.tsx`
- `packages/gui/tests/timeline-cards.test.tsx`

## Decisions

- Treat baseline cleanup as a standalone prerequisite, not as part of the directive task sequence.
- For P1 gate control, apply the user protocol literally: browser-only `UNVERIFIED` items do not block acceptance.
- Record the stale-dev-server browser false negative in the P1 report instead of treating it as a code regression.

## Verification

- `pnpm --filter @bobby/gui test`
- `pnpm --filter @bobby/gui typecheck`
- `pnpm lint`
- `pnpm -r build`
- `git diff master...HEAD --stat -- packages/kernel packages/cli packages/shared`
- P0 report: `docs/superpowers/plans/acceptance/2026-06-13-p0-report.md`
- P1 report: `docs/superpowers/plans/acceptance/2026-06-13-p1-report.md`

## Blockers

- None on the code path for T1–T17.
- Manual browser rehearsal is still the only `UNVERIFIED` class when a reviewer environment cannot open the local dev target.

## Next Step

Stop on `feat/gui-shell-p0p1` for human review. Do not merge or push.
