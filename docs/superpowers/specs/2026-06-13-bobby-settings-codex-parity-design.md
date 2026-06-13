# Bobby Settings Codex Parity Design

## Goal

Rebuild Bobby's settings surface so it follows the Codex desktop settings information architecture and visual density while wiring Bobby's existing real settings into the new shell first.

## Scope

This phase covers the settings shell only inside `packages/gui/`.

Included:
- Codex-like two-column settings layout
- Left navigation with grouped sections and search
- Section-based content routing inside the settings page
- Real Bobby-backed controls for language and current lightweight runtime preferences
- Structured placeholder sections for capabilities Bobby does not expose yet

Excluded:
- Electron-only native settings flows
- Real billing, profile, browser automation, or computer control backends
- Non-GUI package changes

## Information Architecture

The settings page will follow these section groups.

### Personal

- General
- Profile
- Appearance
- Agent
- Personalization
- Keyboard Shortcuts
- Usage & Billing

### Integrations

- MCP Servers
- Browser
- Computer Control

### Coding

- Hooks
- Connections
- Git
- Environment
- Working Tree

## Layout

The page will replace the old flat form with:

- a left rail containing a back action, search input, group labels, and section buttons
- a main content panel showing one active section at a time
- card-like setting groups with title, helper text, and row controls

The settings screen stays inside the current Bobby shell and does not create a separate route system.

## State Model

Settings UI state needs one local navigation layer:

- `activeSettingsSection`
- `settingsSearchQuery`

Persisted Bobby-backed state remains where it already belongs:

- language in `useUiStore`
- lightweight runtime preferences in the settings screen state for now

The screen should derive its section catalog from a single structured definition instead of hardcoding navigation and content in JSX branches.

## Real Data First

These sections should use real Bobby state in this pass:

- General
  - language mode toggle
  - current model text
  - route text
  - budget cap text
  - default permission tier
  - strong sandbox
- Git
  - current branch shown from the existing shell context when available, otherwise descriptive placeholder copy
- Working Tree
  - Bobby project/workspace framing shown as a real summary of the current local project model

These sections should be high-fidelity placeholders with clear "not connected yet" copy:

- Profile
- Appearance
- Agent
- Personalization
- Keyboard Shortcuts
- Usage & Billing
- MCP Servers
- Browser
- Computer Control
- Hooks
- Connections
- Environment

## Language Handling

The settings surface must support both Chinese and English consistently.

- Section labels, group labels, search placeholder, helper copy, and row labels must switch with `useUiStore.lang`
- Avoid extending the existing tiny global `i18n.ts` with a large unrelated blob if the copy is settings-specific; a settings-local dictionary is acceptable

## Visual Rules

- Use only theme variables from `src/lib/theme.css`
- No hex color literals in `.tsx`
- Match Codex settings density more than Bobby's existing placeholder cards
- Keep the left rail narrow and the content area readable rather than full-width prose blocks

## Testing

Add dedicated settings tests covering:

- grouped navigation renders expected sections
- clicking a nav item switches the visible section
- search filters visible sections
- language switching changes settings labels
- Bobby-backed controls still update state in the rebuilt shell

Existing shell navigation tests should continue to verify that the app can enter the settings view.

## File Plan

- Rebuild `packages/gui/src/screens/Settings.tsx`
- Add a settings section schema module under `packages/gui/src/screens/`
- Add dedicated settings styling in existing GUI CSS files
- Add `packages/gui/tests/settings.test.tsx`

