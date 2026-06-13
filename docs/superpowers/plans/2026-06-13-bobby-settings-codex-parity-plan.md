# Bobby Settings Codex Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Bobby's GUI settings page into a Codex-like grouped settings workspace with real Bobby-backed controls in the first connected sections.

**Architecture:** Introduce a structured settings section catalog that drives both the left navigation and the active content panel. Keep Bobby-backed controls in the rebuilt `Settings` screen while moving section metadata and bilingual copy into focused settings modules.

**Tech Stack:** React, Zustand, Vitest, Testing Library, existing Bobby CSS with theme variables

---

## File Structure

- Modify: `packages/gui/src/screens/Settings.tsx`
  - Replace the flat form with the new settings workspace and section rendering.
- Create: `packages/gui/src/screens/settings-sections.ts`
  - Own the section catalog, group metadata, and settings-local bilingual copy.
- Modify: `packages/gui/src/app.css`
  - Remove obsolete flat settings-row styling assumptions and add shared settings layout rules.
- Modify: `packages/gui/src/shell/shell.css`
  - Add Codex-like settings rail and content styling using theme tokens.
- Create: `packages/gui/tests/settings.test.tsx`
  - Drive the rebuild with dedicated section navigation and state tests.
- Modify: `packages/gui/tests/app-shell.test.tsx`
  - Keep the existing entry-to-settings assertion aligned with the rebuilt screen.

### Task 1: Add settings navigation tests

**Files:**
- Create: `packages/gui/tests/settings.test.tsx`
- Modify: `packages/gui/tests/app-shell.test.tsx`
- Modify: `packages/gui/src/screens/Settings.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('renders grouped settings navigation and opens the general section by default', () => {
  useUiStore.setState({ ...useUiStore.getState(), lang: 'en' });
  render(<Settings />);

  expect(screen.getByRole('textbox', { name: /search settings/i })).toBeTruthy();
  expect(screen.getByText('Personal')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'General' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('heading', { name: 'General' })).toBeTruthy();
});

it('switches sections from the left navigation', () => {
  useUiStore.setState({ ...useUiStore.getState(), lang: 'en' });
  render(<Settings />);

  fireEvent.click(screen.getByRole('button', { name: 'Git' }));

  expect(screen.getByRole('heading', { name: 'Git' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'General' })).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bobby/gui test tests/settings.test.tsx`
Expected: FAIL because the current `Settings` screen has no grouped navigation or section switching.

- [ ] **Step 3: Write minimal implementation**

```tsx
const [activeSection, setActiveSection] = React.useState('general');

return (
  <section className="settings-workspace">
    <aside className="settings-nav">
      <input aria-label="Search settings" />
      <button aria-pressed={activeSection === 'general'} onClick={() => setActiveSection('general')}>
        General
      </button>
      <button aria-pressed={activeSection === 'git'} onClick={() => setActiveSection('git')}>
        Git
      </button>
    </aside>
    <div className="settings-content">
      <h2>{activeSection === 'general' ? 'General' : 'Git'}</h2>
    </div>
  </section>
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @bobby/gui test tests/settings.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/gui/tests/settings.test.tsx packages/gui/tests/app-shell.test.tsx packages/gui/src/screens/Settings.tsx
git commit -m "test(gui): add settings navigation coverage"
```

### Task 2: Extract section catalog and search filtering

**Files:**
- Create: `packages/gui/src/screens/settings-sections.ts`
- Modify: `packages/gui/src/screens/Settings.tsx`
- Test: `packages/gui/tests/settings.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('filters sections by search query', () => {
  useUiStore.setState({ ...useUiStore.getState(), lang: 'en' });
  render(<Settings />);

  fireEvent.change(screen.getByRole('textbox', { name: /search settings/i }), {
    target: { value: 'git' }
  });

  expect(screen.getByRole('button', { name: 'Git' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'General' })).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bobby/gui test tests/settings.test.tsx`
Expected: FAIL because search does not filter navigation yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export const settingsGroups = {
  en: [
    { key: 'personal', title: 'Personal', sections: [{ key: 'general', label: 'General' }, { key: 'git', label: 'Git' }] }
  ]
};
```

```tsx
const [query, setQuery] = React.useState('');
const visibleGroups = settingsGroups[lang]
  .map((group) => ({
    ...group,
    sections: group.sections.filter((section) => section.label.toLowerCase().includes(query.toLowerCase()))
  }))
  .filter((group) => group.sections.length > 0);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @bobby/gui test tests/settings.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/gui/src/screens/settings-sections.ts packages/gui/src/screens/Settings.tsx packages/gui/tests/settings.test.tsx
git commit -m "feat(gui): add structured settings section catalog"
```

### Task 3: Connect Bobby-backed general controls in the new shell

**Files:**
- Modify: `packages/gui/src/screens/Settings.tsx`
- Test: `packages/gui/tests/settings.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('updates the interface language from the general section', () => {
  useUiStore.setState({ ...useUiStore.getState(), lang: 'en' });
  render(<Settings />);

  fireEvent.change(screen.getByLabelText('Interface language'), {
    target: { value: 'zh' }
  });

  expect(useUiStore.getState().lang).toBe('zh');
  expect(screen.getByRole('heading', { name: '常规' })).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bobby/gui test tests/settings.test.tsx`
Expected: FAIL because the rebuilt shell does not wire bilingual labels and language updates yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
<label className="settings-field">
  <span>{copy.general.languageLabel}</span>
  <select value={lang} onChange={(event) => setLang(event.target.value as 'zh' | 'en')}>
    <option value="zh">{copy.languages.zh}</option>
    <option value="en">{copy.languages.en}</option>
  </select>
</label>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @bobby/gui test tests/settings.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/gui/src/screens/Settings.tsx packages/gui/tests/settings.test.tsx
git commit -m "feat(gui): wire Bobby general settings into Codex-style shell"
```

### Task 4: Add placeholder sections and Codex-style visual structure

**Files:**
- Modify: `packages/gui/src/screens/Settings.tsx`
- Modify: `packages/gui/src/app.css`
- Modify: `packages/gui/src/shell/shell.css`
- Test: `packages/gui/tests/settings.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('shows structured placeholder content for non-connected sections', () => {
  useUiStore.setState({ ...useUiStore.getState(), lang: 'en' });
  render(<Settings />);

  fireEvent.click(screen.getByRole('button', { name: 'MCP Servers' }));

  expect(screen.getByText(/not connected yet/i)).toBeTruthy();
  expect(document.querySelector('.settings-workspace')).toBeTruthy();
  expect(document.querySelector('.settings-panel-card')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bobby/gui test tests/settings.test.tsx`
Expected: FAIL because placeholder cards and styling hooks are missing.

- [ ] **Step 3: Write minimal implementation**

```tsx
<section className="settings-panel-card">
  <h3>{section.label}</h3>
  <p className="muted">{section.description}</p>
  {section.connected ? section.render() : <p className="settings-note">{copy.notConnectedYet}</p>}
</section>
```

```css
.settings-workspace {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @bobby/gui test tests/settings.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/gui/src/screens/Settings.tsx packages/gui/src/app.css packages/gui/src/shell/shell.css packages/gui/tests/settings.test.tsx
git commit -m "feat(gui): style Codex-like settings workspace"
```

### Task 5: Run the affected suite and shell regression checks

**Files:**
- Modify: `packages/gui/tests/settings.test.tsx`
- Modify: `packages/gui/tests/app-shell.test.tsx`

- [ ] **Step 1: Write the final regression assertions**

```tsx
it('still reaches the settings view from the shell', () => {
  render(<AppShell />);
  fireEvent.click(screen.getByText('Settings'));
  expect(screen.getByRole('heading', { name: /settings|设置/i })).toBeTruthy();
});
```

- [ ] **Step 2: Run targeted tests**

Run: `pnpm --filter @bobby/gui test tests/settings.test.tsx tests/app-shell.test.tsx`
Expected: PASS

- [ ] **Step 3: Run full GUI verification**

Run: `pnpm --filter @bobby/gui test && pnpm --filter @bobby/gui typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/gui/tests/settings.test.tsx packages/gui/tests/app-shell.test.tsx
git commit -m "test(gui): verify rebuilt settings shell regressions"
```
