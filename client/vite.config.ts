import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'child_process';

const commitHash = (() => {
  try { return execSync('git rev-parse --short HEAD').toString().trim(); }
  catch { return 'dev'; }
})();

export default defineConfig({
  plugins: [react()],
  define: { __GIT_COMMIT_HASH__: JSON.stringify(commitHash) },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    host: true,
    port: 5174,
    proxy: { '/api': 'http://localhost:3048' },
  },
  build: { outDir: 'dist', sourcemap: true },
});
