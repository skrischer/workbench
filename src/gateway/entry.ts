// src/gateway/entry.ts — Thin entry point for `tsx watch` dev auto-reload
import { createGateway } from './index.js';

const args = process.argv.slice(2);
const dev = args.includes('--dev');
const portIdx = args.indexOf('--port');
const port = portIdx !== -1 ? Number(args[portIdx + 1]) : 3000;
const hostIdx = args.indexOf('--host');
const host = hostIdx !== -1 ? args[hostIdx + 1] ?? '127.0.0.1' : '127.0.0.1';

const { close } = await createGateway({ dev, port, host });

const shutdown = async (): Promise<void> => {
  console.log('\nShutting down gateway...');
  await close();
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
