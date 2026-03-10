import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts'],
    setupFiles: ['./vitest.setup.ts'],
    
    // ✅ Global timeout for E2E tests that spawn real CLI processes
    testTimeout: 15000, // 15s (was: 5s default)
    // Reason: E2E tests spawn real CLI processes (8-15s execution time)
    // TODO Epic 27: Reduce to 10s after async-embeddings optimization
    
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['dist', 'node_modules', '**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
