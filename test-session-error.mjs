import { SessionStorage } from './src/storage/session-storage.js';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const tempDir = mkdtempSync(join(tmpdir(), 'debug-'));
const storage = new SessionStorage(join(tempDir, 'sessions'));

try {
  await storage.load('non-existent');
} catch (error) {
  console.log('Error type:', error.constructor.name);
  console.log('Error name:', error.name);
  console.log('Error message:', error.message);
  console.log('Is Error?', error instanceof Error);
  console.log('Check:', error instanceof Error && error.name === 'NotFoundError');
}
