import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/test/e2e/**/*.test.ts', 'src/test/e2e/**/*.test.tsx'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Use default (node) environment for CLI tests
    // Individual test files can override with // @vitest-environment jsdom
  },
});
