import { describe, it, expect } from 'vitest';
import { handleMcpRequest } from '../worker/mcpRoutes';

async function mcpCall(method: string, params?: unknown, authHeader?: string | null) {
  const request = new Request('http://localhost:8787/api/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params ?? {} }),
  });
  return handleMcpRequest(request, authHeader ?? null);
}

describe('handleMcpRequest', () => {
  it('responds to initialize with server info and tools capability', async () => {
    const res = await mcpCall('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test', version: '1' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.serverInfo.name).toBe('shelf');
    expect(body.result.capabilities.tools).toBeDefined();
  });

  it('lists all 10 tools (6 public + 4 auth-gated)', async () => {
    const res = await mcpCall('tools/list');
    expect(res.status).toBe(200);
    const body = await res.json();
    const tools = body.result?.tools ?? body.tools ?? [];
    const names = tools.map((t: { name: string }) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'search_anime',
        'search_manga',
        'get_anime_detail',
        'get_manga_detail',
        'get_anime_stats',
        'get_random_anime',
        'list_watchlist',
        'list_manga_watchlist',
        'list_watchlist_tags',
        'get_watchlist_enriched',
      ])
    );
    expect(names).toHaveLength(10);
  });

  it('returns 405-equivalent for unsupported methods via the transport', async () => {
    // The transport handles method validation; a non-JSON-RPC POST should
    // produce an error response, not crash.
    const request = new Request('http://localhost:8787/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'nonexistent/method' }),
    });
    const res = await handleMcpRequest(request, null);
    expect(res.status).toBeLessThan(500);
  });
});
