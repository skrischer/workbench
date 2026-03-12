#!/usr/bin/env node

// Export public API
export * from './types/index.js';
export * from './agent/index.js';

// CLI bootstrap: if executed directly, run CLI
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const isMainModule = import.meta.url === `file://${resolve(process.argv[1])}` ||
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMainModule) {
  // Dynamically import CLI to avoid side effects when used as library
  import('./tui/index.js').catch((error: unknown) => {
    console.error('Failed to start CLI:', error);
    process.exit(1);
  });
}
