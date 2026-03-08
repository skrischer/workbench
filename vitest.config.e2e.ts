import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/test/e2e/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Use default (node) environment for CLI tests
  },
});
