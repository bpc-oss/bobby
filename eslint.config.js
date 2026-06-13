import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/.bobby/**', '**/dist/**', '**/dist-electron/**', '**/release/**']
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      'max-lines-per-function': ['warn', 50]
    }
  },
  {
    files: ['packages/kernel/src/hands/tools/exec.ts'],
    rules: {
      'max-lines-per-function': 'off'
    }
  },
  {
    files: [
      'packages/gui/src/modes/LoopPlaceholder.tsx',
      'packages/gui/src/modes/placeholder-config.tsx',
      'packages/gui/src/panels/ReviewPanel.tsx',
      'packages/gui/src/panels/RightPanel.tsx',
      'packages/gui/src/screens/Settings.tsx',
      'packages/gui/src/shell/Sidebar.tsx',
      'packages/gui/src/shell/TitleBar.tsx',
      'packages/gui/src/store/ui-store.ts',
      'packages/gui/src/workspace/Composer.tsx',
      'packages/gui/src/workspace/SessionView.tsx',
      'packages/gui/tests/app-shell.test.tsx',
      'packages/gui/tests/right-panel.test.tsx',
      'packages/gui/tests/titlebar-statusbar.test.tsx',
      'packages/gui/tests/ui-store.test.ts'
    ],
    rules: {
      'max-lines-per-function': 'off'
    }
  }
);
