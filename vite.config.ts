import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative paths so the build works from any sub-path (a Shepherd route, a static host).
  base: './',
  build: {
    // Inline the one sprite so the game is a single JS file plus CSS.
    assetsInlineLimit: 64 * 1024,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
