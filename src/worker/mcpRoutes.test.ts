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
  return handleMcpRequest(request, fetch, authHeader ?? null, federated);
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

  it('lists the catalog and watchlist tools', async () => {
    const res = await mcpCall('tools/list');
    expect(res.status).toBe(200);
    const body = await res.json();
    const tools = body.result?.tools ?? body.tools ?? [];
    const names = tools.map((t: { name: string }) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'search_anime',
        'search_manga',
        'list_search_fields',
        'list_filter_actions',
        'get_manga_watchlist_enriched',
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
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('upsert_watchlist_entries');
    for (const tool of tools) {
      expect(typeof tool.annotations?.readOnlyHint).toBe('boolean');
      if (!tool.annotations.readOnlyHint)
        expect(tool.inputSchema.required).toContain('user_authorized');
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
      new Response(JSON.stringify({ items: [], total: 0, nextOffset: null }), {
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
    const res = await handleMcpRequest(request, fetch, null);
    expect(res.status).toBeLessThan(500);
  });

  it('normalizes successful reads and strips credential-shaped upstream fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          anime: { mal_id: 1, title: 'Cowboy Bebop', token: 'upstream-secret' },
          relations: [],
          recommendations: [],
          watchlistEntry: null,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await mcpCall('tools/call', {
      name: 'get_anime_detail',
      arguments: { mal_id: 1 },
    });
    const body = await res.json();

    expect(body.result.isError).not.toBe(true);
    expect(body.result.structuredContent.data.anime).toMatchObject({
      mal_id: 1,
      canonicalUrl: 'https://anime.significanthobbies.com/anime/1',
    });
    expect(body.result.content[0].text).toContain('Cowboy Bebop');
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

  it('retries a transient dispatch failure once', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('connection interrupted'))
      .mockResolvedValueOnce(Response.json({ totalAnime: 2 }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await mcpCall('tools/call', { name: 'get_anime_stats', arguments: {} });
    expect(await res.json()).toMatchObject({
      result: { structuredContent: { ok: true, data: { totalAnime: 2 } } },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('classifies timeout and malformed JSON without leaking upstream details', async () => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValueOnce(controller.signal);
    const timeoutFetch = vi.fn(() => {
      controller.abort(new DOMException('private timeout', 'TimeoutError'));
      return new Promise<Response>(() => {});
    });
    vi.stubGlobal('fetch', timeoutFetch);
    const timeoutRes = await mcpCall('tools/call', {
      name: 'get_anime_stats',
      arguments: {},
    });
    const timeoutBody = await timeoutRes.json();
    expect(timeoutFetch).toHaveBeenCalledTimes(1);
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

  it('exposes model-readable continuation metadata for catalog searches', async () => {
    const filteredList = Array.from({ length: 50 }, (_, index) => ({
      id: index + 1,
      name: `Anime ${index + 1}`,
    }));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ totalFiltered: 123, filteredList }))
    );

    const res = await mcpCall('tools/call', {
      name: 'search_anime',
      arguments: { filters: [], pagesize: 50, offset: 0, airing: 'any' },
    });
    const body = await res.json();
    const result = body.result;

    expect(result.structuredContent.truncated).toBe(true);
    expect(result.structuredContent.data.pageInfo).toEqual({
      limit: 50,
      offset: 0,
      returned: 50,
      total: 123,
      page: 1,
      totalPages: 3,
      hasMore: true,
      nextOffset: 50,
    });
    const textPayload = JSON.parse(result.content[0].text);
    expect(textPayload.data.filteredList).toHaveLength(50);
    expect(textPayload.data.pageInfo.nextOffset).toBe(50);
  });

  it('marks the final manga catalog page as complete', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          totalFiltered: 123,
          filteredList: Array.from({ length: 23 }, (_, index) => ({
            id: 101 + index,
            name: `Manga ${101 + index}`,
          })),
        })
      )
    );

    const res = await mcpCall('tools/call', {
      name: 'search_manga',
      arguments: { filters: [], pagesize: 50, offset: 100 },
    });
    const body = await res.json();

    expect(body.result.structuredContent.truncated).toBe(false);
    expect(body.result.structuredContent.data.pageInfo).toMatchObject({
      returned: 23,
      total: 123,
      hasMore: false,
      nextOffset: null,
    });
  });

  it.each([
    ['search_anime', 'pagesize'],
    ['search_manga', 'pagesize'],
    ['list_watchlist', 'limit'],
    ['list_watchlist_tags', 'limit'],
    ['list_manga_watchlist', 'limit'],
    ['get_watchlist_enriched', 'limit'],
    ['get_manga_watchlist_enriched', 'limit'],
  ])('follows %s nextCall across 100 rows through the terminal page', async (name, sizeKey) => {
    const rows = Array.from({ length: 223 }, (_, index) => ({
      id: name === 'list_watchlist_tags' ? String(index + 1) : index + 1,
      name: 'tag',
    }));
    const fetchMock = vi.fn((url: string, init: RequestInit) => {
      const search = init.method === 'POST';
      const args = search
        ? JSON.parse(String(init.body))
        : Object.fromEntries(new URL(url).searchParams);
      const start = Number(args.offset);
      const items = rows.slice(start, start + Number(args[sizeKey]));
      const end = start + items.length;
      return Response.json(
        search
          ? { filteredList: items, totalFiltered: rows.length }
          : {
              items,
              total: rows.length,
              nextOffset: end < rows.length ? end : null,
              hasMore: end < rows.length,
            }
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const found: (number | string)[] = [];
    let call = { name, arguments: { [sizeKey]: 100 } };
    for (const offset of [0, 100, 200]) {
      const { result } = await (
        await mcpCall('tools/call', call, 'Bearer anime_list_fixture')
      ).json();
      expect(result.isError).not.toBe(true);
      const { data, nextCall } = result.structuredContent;
      const text = JSON.parse(result.content[0].text);
      expect(text.nextCall).toEqual(nextCall);
      found.push(...(data.filteredList ?? data.items).map((item: { id: number }) => item.id));
      if (offset === 200) expect(nextCall).toBeNull();
      else
        expect(nextCall).toMatchObject({
          name,
          arguments: { [sizeKey]: 100, offset: offset + 100 },
        });
      call = nextCall;
    }
    expect(found).toEqual(rows.map((row) => row.id));
  });

  it('authenticates only personalized anime search and carries the sort and filters forward', async () => {
    const fetchMock = vi.fn(() => Response.json({ filteredList: [{ id: 1 }], totalFiltered: 2 }));
    vi.stubGlobal('fetch', fetchMock);
    const filters = [{ field: 'year', action: 'GREATER_THAN', value: 2010 }];
    const call = {
      name: 'search_anime',
      arguments: { sortBy: 'recommended', filters, pagesize: 1 },
    };
    expect(await (await mcpCall('tools/call', call)).json()).toMatchObject({
      result: { isError: true, structuredContent: { error: { code: 'unauthorized' } } },
    });
    expect(fetchMock).not.toHaveBeenCalled();
    const auth = 'Bearer anime_list_fixture';
    const { result } = await (await mcpCall('tools/call', call, auth)).json();
    expect(result.structuredContent).toMatchObject({
      retrievalMode: 'owner-watchlist',
      nextCall: { name: 'search_anime', arguments: { filters, sortBy: 'recommended', offset: 1 } },
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: auth }) })
    );
    await mcpCall('tools/call', { name: 'search_anime', arguments: {} }, auth);
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ headers: expect.not.objectContaining({ Authorization: auth }) })
    );
  });

  it('rejects oversized catalog inputs before any upstream request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await mcpCall('tools/call', {
      name: 'search_anime',
      arguments: { filters: [], pagesize: 101, offset: 0, airing: 'any' },
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
