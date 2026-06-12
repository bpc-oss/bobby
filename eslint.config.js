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
  }
);
