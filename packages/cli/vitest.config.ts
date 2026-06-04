import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node'
  },
  resolve: {
    alias: {
      '@bobby/shared': resolve(__dirname, '../shared/src/index.ts'),
      '@bobby/kernel': resolve(__dirname, '../kernel/src/index.ts')
    }
  }
});
