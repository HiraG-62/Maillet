import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    environmentMatchGlobs: [
      ['src/hooks/**/*.test.ts', 'happy-dom'],
    ],
    deps: {
      inline: [/@asamuzakjp\/css-color/, /@csstools\/css-calc/],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    deps: {
      inline: ['@asamuzakjp/css-color', '@csstools/css-calc'],
    },
  },
});
