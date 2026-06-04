import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@bobby/shared': resolve(__dirname, '../shared/src/index.ts'),
      '@bobby/kernel': resolve(__dirname, '../kernel/src/index.ts')
    }
  },
  build: {
    outDir: 'dist'
  }
});
