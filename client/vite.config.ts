import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'node:child_process';
import process from 'node:process';

let commitHash = process.env.GIT_COMMIT_HASH || 'dev';
if (commitHash === 'dev') {
  try {
    commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim() || 'dev';
  } catch {
    // ignore
  }
}

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
