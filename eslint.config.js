import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/dist-electron/**', '**/.bobby/**']
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      'max-lines-per-function': ['warn', 50],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true
        }
      ]
    }
  },
  {
    files: ['**/tests/**', '**/*.test.*'],
    rules: {
      'max-lines-per-function': 'off'
    }
  }
);
