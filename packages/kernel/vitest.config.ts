import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts']
  },
  resolve: {
    alias: {
      '@bobby/shared': resolve(__dirname, '../shared/src/index.ts')
    }
  }
});
