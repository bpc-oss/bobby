import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'jsdom'
  },
  resolve: {
    alias: {
      '@bobby/shared': resolve(__dirname, '../shared/src/index.ts'),
      '@bobby/kernel': resolve(__dirname, '../kernel/src/index.ts')
    }
  }
});
