import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/dist-electron/**', '**/.bobby/**']
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      'max-lines-per-function': ['warn', 50]
    }
  }
);
