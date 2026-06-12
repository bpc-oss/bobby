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
    // JSX markup inflates line counts; component size is governed by review,
    // not this cap. Logic in .ts files stays under the 50-line rule.
    files: ['**/*.tsx'],
    rules: {
      'max-lines-per-function': 'off'
    }
  },
  {
    files: ['**/tests/**', '**/*.test.*'],
    rules: {
      'max-lines-per-function': 'off'
    }
  }
);
