import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleMcpRequest } from '../worker/mcpRoutes';

async function mcpCall(
  method: string,
  params?: unknown,
  authHeader?: string | null,
  federated = false
) {
  const request = new Request('http://localhost:8787/api/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params ?? {} }),
  });
  return handleMcpRequest(request, authHeader ?? null, federated);
}

describe('handleMcpRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('responds to initialize with server info and tools capability', async () => {
    const res = await mcpCall('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test', version: '1' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.serverInfo.name).toBe('anime-list-by-significant-hobbies');
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
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(tool.annotations?.destructiveHint).toBe(false);
      expect(tool.annotations?.idempotentHint).toBe(true);
      expect(tool.inputSchema).toBeDefined();
      expect(tool.outputSchema).toBeDefined();
    }
  });

  it('rejects an owner watchlist read before making an upstream request', async () => {
    const res = await mcpCall('tools/call', {
      name: 'list_watchlist',
      arguments: {},
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.isError).toBe(true);
    expect(body.result.structuredContent.error.code).toBe('unauthorized');
    expect(JSON.stringify(body)).not.toContain('mal_auth_token');
  });

  it('rejects browser-session JWTs for owner tools', async () => {
    const res = await mcpCall(
      'tools/call',
      { name: 'list_watchlist', arguments: {} },
      'Bearer header.payload.signature'
    );
    const body = await res.json();
    expect(body.result.isError).toBe(true);
    expect(body.result.structuredContent.error.code).toBe('unauthorized');
  });

  it('forwards only a product-verified federated bearer to owner reads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: { id: 'anime-user-1' }, anime: [] }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const bearer = 'Bearer header.payload.signature';
    const res = await mcpCall(
      'tools/call',
      { name: 'list_watchlist', arguments: {} },
      bearer,
      true
    );
    const body = await res.json();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(body.result.isError).not.toBe(true);
    expect(init?.headers).toMatchObject({
      Authorization: bearer,
    });
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

  it('normalizes successful reads and strips credential-shaped upstream fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ mal_id: 1, title: 'Cowboy Bebop', token: 'upstream-secret' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await mcpCall('tools/call', {
      name: 'get_anime_detail',
      arguments: { mal_id: 1 },
    });
    const body = await res.json();

    expect(body.result.isError).not.toBe(true);
    expect(body.result.structuredContent.data).toMatchObject({
      mal_id: 1,
      canonicalUrl: 'https://anime.significanthobbies.com/anime/1',
    });
    expect(JSON.stringify(body)).not.toContain('upstream-secret');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a rate limit once and returns a stable retryable error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('busy', { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await mcpCall('tools/call', {
      name: 'get_anime_stats',
      arguments: {},
    });
    const body = await res.json();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(body.result.structuredContent.error).toMatchObject({
      code: 'rate_limited',
      retryable: true,
    });
    expect(JSON.stringify(body)).not.toContain('busy');
  });

  it('classifies timeout and malformed JSON without leaking upstream details', async () => {
    const timeoutFetch = vi
      .fn()
      .mockRejectedValue(new DOMException('private timeout', 'TimeoutError'));
    vi.stubGlobal('fetch', timeoutFetch);
    const timeoutRes = await mcpCall('tools/call', {
      name: 'get_anime_stats',
      arguments: {},
    });
    const timeoutBody = await timeoutRes.json();
    expect(timeoutFetch).toHaveBeenCalledTimes(2);
    expect(timeoutBody.result.structuredContent.error.code).toBe('timeout');
    expect(JSON.stringify(timeoutBody)).not.toContain('private timeout');

    const malformedFetch = vi
      .fn()
      .mockResolvedValue(new Response('database password=hidden', { status: 200 }));
    vi.stubGlobal('fetch', malformedFetch);
    const malformedRes = await mcpCall('tools/call', {
      name: 'get_anime_stats',
      arguments: {},
    });
    const malformedBody = await malformedRes.json();
    expect(malformedBody.result.structuredContent.error.code).toBe('invalid_upstream_response');
    expect(JSON.stringify(malformedBody)).not.toContain('password=hidden');
  });

  it('treats a rejected owner PAT as unauthorized and never forwards cookies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('forbidden', { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await mcpCall(
      'tools/call',
      { name: 'list_watchlist', arguments: {} },
      'Bearer anime_list_revoked'
    );
    const body = await res.json();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;

    expect(body.result.structuredContent.error.code).toBe('unauthorized');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer anime_list_revoked' });
    expect(init.headers).not.toHaveProperty('Cookie');
    expect(JSON.stringify(body)).not.toContain('forbidden');
  });

  it('exposes truthful continuation metadata for authenticated watchlist pages', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        items: Array.from({ length: 23 }, (_, index) => ({
          id: String(101 + index),
          status: 'Done',
        })),
        total: 123,
        nextOffset: null,
        hasMore: false,
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await mcpCall(
      'tools/call',
      { name: 'list_watchlist', arguments: { limit: 50, offset: 100 } },
      'Bearer anime_list_valid'
    );
    const body = await res.json();
    const data = body.result.structuredContent.data;

    expect(data.items).toHaveLength(23);
    expect(data).toMatchObject({ total: 123, nextOffset: null, hasMore: false });
    expect(body.result.structuredContent.truncated).toBe(false);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://localhost:8787/api/watchlist?limit=50&offset=100'
    );
  });

  it('marks non-terminal authenticated pages as truncated', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          items: [{ id: '1', status: 'Watching' }],
          total: 2,
          nextOffset: 1,
          hasMore: true,
        })
      )
    );
    const res = await mcpCall(
      'tools/call',
      { name: 'list_watchlist', arguments: { limit: 1, offset: 0 } },
      'Bearer anime_list_valid'
    );
    const body = await res.json();
    expect(body.result.structuredContent.truncated).toBe(true);
    expect(body.result.structuredContent.data.nextOffset).toBe(1);
  });

  it('rejects oversized catalog inputs before any upstream request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await mcpCall('tools/call', {
      name: 'search_anime',
      arguments: { filters: [], pagesize: 51, offset: 0, airing: 'any' },
    });

    expect(res.status).toBeLessThan(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stops a chunked upstream response when it crosses the byte bound', async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(600_000));
      },
      cancel() {
        cancelled = true;
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream)));

    const res = await mcpCall('tools/call', {
      name: 'get_anime_stats',
      arguments: {},
    });
    const body = await res.json();

    expect(body.result.structuredContent.error.code).toBe('invalid_upstream_response');
    expect(cancelled).toBe(true);
  });
});
