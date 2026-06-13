# Bobby GUI Shell Polish Design

Date: 2026-06-13
Scope owner: Codex
Target branch: `feat/gui-shell-p0p1`
Reference artifact: `docs/superpowers/specs/2026-06-13-bobby-gui-shell-mockup.html`

## Goal

Bring the current Bobby GUI implementation materially closer to the approved mockup with a high-fidelity recreation standard. The work in this round is visual and interaction polish, not new product scope.

Success means the live GUI reads as the same design system and layout language as the mockup when comparing:

- outer shell structure
- spacing and proportions
- card and panel styling
- typography and information hierarchy
- placeholder-page skeletons
- primary mock session surfaces

## In Scope

This round may change only `packages/gui/**` and supporting handoff/spec files.

Primary polish surfaces:

1. App shell
   - `TitleBar`
   - `Sidebar`
   - `RightPanel`
   - `StatusBar`
   - `app-grid` layout and shell-level background treatment

2. Main session stage
   - `Code session` top bar
   - summary panel
   - timeline stream cards
   - composer
   - cost / usage bar
   - review panel contents and visual hierarchy

3. Placeholder pages
   - `Search`
   - `Write`
   - `Projects`
   - `Routines`
   - `Loop`
   - `Team`
   - `Settings`

4. Shared visual primitives
   - spacing rhythm
   - radius, border, and shadow treatment
   - text scale and density
   - chip / pill / tab / item states

## Out of Scope

This round does not introduce:

- new backend or kernel behavior
- new app routes or screens beyond existing placeholders
- new non-mock workflows
- new data contracts
- product-scope expansion of placeholder pages
- changes to `packages/kernel`, `packages/cli`, or `packages/shared`

Placeholder pages may be visually rebuilt to match the mockup more closely, but they remain placeholders unless they already have working behavior today.

## Design Standard

The standard for this round is "high-fidelity recreation", not loose inspiration.

That means:

- Prefer the mockup's structure over local improvisation.
- Match panel proportions before micro-styling.
- Match the mockup's density and whitespace, not just colors.
- Match interaction affordances where they already exist in the app.
- Keep all colors and fonts sourced from `src/lib/theme.css` variables.

Intentional deviations are allowed only when:

- the current implementation has a real functional constraint, or
- the mockup depends on non-existent data or future product scope.

Any intentional deviation should stay visually aligned with the mockup language.

## Implementation Approach

Work in this order:

1. Shell alignment
   - Lock the overall layout, chrome, and proportional rhythm.
   - Fix titlebar, sidebar, right panel, and status bar first.
   - Ensure the app looks recognizably like the mockup before deeper content polish.

2. Main code-session stage
   - Bring the top strip, summary tray, stream cards, composer, and cost bar into alignment.
   - Focus on the live mock flow because it is the most visible and most product-defining screen.

3. Placeholder-page skeletons
   - Rebuild the non-session pages so they carry the same visual language and structural cues as the mockup.
   - Preserve their placeholder nature while improving fidelity.

4. Final consistency pass
   - Remove local style drift between shell, session stage, and placeholder pages.
   - Align hover, active, selected, and collapsed states.

## Verification

Required verification after implementation:

1. Code health
   - `pnpm --filter @bobby/gui test`
   - `pnpm --filter @bobby/gui typecheck`
   - `pnpm lint`
   - `pnpm -r build`

2. Scope safety
   - `git diff master...HEAD --stat -- packages/kernel packages/cli packages/shared`
   - must remain empty

3. Visual QA
   - run the GUI locally
   - compare the live UI against `2026-06-13-bobby-gui-shell-mockup.html`
   - verify shell, code session, and placeholder pages against the mockup
   - note any remaining intentional deviations explicitly

4. Theme discipline
   - no new hex literals in `.tsx`
   - continue using `theme.css` variables for visual values

## Risks

1. Visual over-correction
   - Fix by preserving existing working behavior and only polishing presentation.

2. Inconsistent shell vs. stage density
   - Fix by handling shell first, then stage, then final consistency pass.

3. Placeholder pages drifting into pseudo-features
   - Fix by limiting them to mockup-faithful skeleton states only.

## Deliverable

A polished GUI that still runs the existing P0/P1 implementation, but visually reads much closer to the mockup across:

- shell
- code session
- right review panel
- placeholder-page family

The implementation is complete only after code verification and a browser-based visual comparison pass against the mockup.
