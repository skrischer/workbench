// src/gateway/health.ts — Gateway Health Check + URL Helpers

const DEFAULT_GATEWAY_URL = 'ws://127.0.0.1:4800/ws';
const DEFAULT_GATEWAY_HTTP_URL = 'http://127.0.0.1:4800';

/**
 * Get the Gateway WebSocket URL from env or default.
 */
export function getGatewayWsUrl(): string {
  return process.env.WORKBENCH_GATEWAY_URL ?? DEFAULT_GATEWAY_URL;
}

/**
 * Get the Gateway HTTP base URL from env or default.
 */
export function getGatewayHttpUrl(): string {
  const wsUrl = getGatewayWsUrl();
  // Convert ws://host:port/ws → http://host:port
  return wsUrl
    .replace(/^wss:/, 'https:')
    .replace(/^ws:/, 'http:')
    .replace(/\/ws$/, '');
}

/**
 * Check if the Gateway is reachable via HTTP /health endpoint.
 */
export async function isGatewayReachable(url?: string, timeoutMs = 3000): Promise<boolean> {
  const baseUrl = url ?? getGatewayHttpUrl();
  const healthUrl = `${baseUrl}/health`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}
