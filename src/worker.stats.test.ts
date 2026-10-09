// @vitest-environment node
/// <reference types="@cloudflare/workers-types" />
import { SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './worker';
import { animeStore } from './store/animeStore';
import { mangaStore } from './store/mangaStore';
import * as statistics from './statistics';
import * as watchlists from './db/watchlist';

const JWT_SECRET = 'worker-stats-test-secret';
const catalog = [1, 2].map((mal_id) => ({
  mal_id,
  url: `https://example.com/${mal_id}`,
  title: `Title ${mal_id}`,
  score: 8,
  members: 100_000,
  favorites: 100,
  year: 2020,
  genres: { Action: 1 },
  themes: {},
  demographics: {},
}));

const cacheEntries = new Map<string, Response>();
const match = vi.fn(async (request: Request) => cacheEntries.get(request.url)?.clone());
const put = vi.fn(async (request: Request, response: Response) => {
  cacheEntries.set(request.url, response.clone());
});
const fetchMock = vi.fn(
  async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 202 })
);

async function call(
  path: string,
  options: { token?: string; key?: string; rate?: string; colo?: string } = {}
) {
  const pending: Promise<unknown>[] = [];
  const request = new Request(`https://anime.example${path}`, {
    headers: options.token ? { authorization: `Bearer ${options.token}` } : undefined,
  });
  Object.defineProperty(request, 'cf', { value: { colo: options.colo } });
  const response = await worker.fetch(
    request,
    {
      DB: { prepare: vi.fn() } as unknown as D1Database,
      JWT_SECRET,
      GOOGLE_CLIENT_ID: 'test-google-client',
      APP_HEALTH_INGEST_KEY: options.key,
      APP_HEALTH_STAGE_SAMPLE_RATE: options.rate,
    },
    { waitUntil: (promise: Promise<unknown>) => pending.push(promise) } as ExecutionContext
  );
  await Promise.all(pending);
  return response;
}

async function signedToken() {
  return new SignJWT({ userId: 'private-user', email: 'private@example.com', name: 'Private' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(JWT_SECRET));
}

function stageLogs() {
  return fetchMock.mock.calls
    .map((call) => JSON.parse(String(call[1]?.body)))
    .flatMap((batch) => batch.logs ?? []);
}

beforeEach(() => {
  cacheEntries.clear();
  match.mockClear();
  put.mockClear();
  fetchMock.mockClear();
  vi.stubGlobal('caches', { default: { match, put } });
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(animeStore, 'getAnimeList').mockResolvedValue(catalog);
  vi.spyOn(mangaStore, 'getMangaList').mockResolvedValue(catalog);
  vi.spyOn(statistics, 'getAnimeStats');
  vi.spyOn(statistics, 'getMangaStats');
  vi.spyOn(watchlists, 'getAnimeWatchlist').mockResolvedValue({
    user: { id: 'private-user', name: 'Private' },
    anime: { '1': { id: '1', status: 'Completed' }, '2': { id: '2', status: 'Watching' } },
  });
  vi.spyOn(watchlists, 'getMangaWatchlist').mockResolvedValue({
    user: { id: 'private-user', name: 'Private' },
    manga: { '1': { id: '1', status: 'Completed' }, '2': { id: '2', status: 'Watching' } },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe.each(['/api/stats', '/api/manga/stats'])('%s edge cache and stages', (route) => {
  it('caches a MISS and serves a HIT without loading or computing again', async () => {
    const miss = await call(route, { key: 'test-key', rate: '1', colo: 'BOM' });
    const expected = await miss.json();
    expect(expected.totalAnime).toBe(2);
    expect(miss.headers.get('X-Stats-Cache')).toBe('MISS');
    expect(miss.headers.get('Cache-Control')).toBe('public, max-age=0, s-maxage=300');
    expect(put.mock.calls[0][0].url).toBe(`https://mal-cache.local${route}?v=1`);
    const hit = await call(`${route}?ignored=private-query`, { key: 'test-key', rate: '1' });
    expect(hit.headers.get('X-Stats-Cache')).toBe('HIT');
    expect(await hit.json()).toEqual(expected);
    expect(
      route === '/api/stats' ? statistics.getAnimeStats : statistics.getMangaStats
    ).toHaveBeenCalledTimes(1);
    expect(
      route === '/api/stats' ? animeStore.getAnimeList : mangaStore.getMangaList
    ).toHaveBeenCalledTimes(1);
    expect(hit.headers.get('Server-Timing')).toContain('edge_cache;desc="HIT"');
    expect(hit.headers.get('Server-Timing')).not.toContain('store;');
    const logs = stageLogs();
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({
      event: 'api.stage_timing',
      level: 'debug',
      props: {
        route,
        status: 200,
        total_ms: expect.any(Number),
        edge_cache: 'MISS',
        inner_cache: 'NONE',
        colo: 'BOM',
        store_ms: expect.any(Number),
        compute_ms: expect.any(Number),
      },
    });
    expect(logs[1].props).toEqual({
      route,
      status: 200,
      total_ms: expect.any(Number),
      edge_cache: 'HIT',
      inner_cache: 'NONE',
      colo: 'unknown',
    });
    expect(JSON.stringify(logs)).not.toContain('private-query');
    const logRequest = fetchMock.mock.calls.find(
      (call) => call[0] === 'https://ingest.sassmaker.com/v1/logs'
    );
    expect(logRequest?.[1]?.headers).toMatchObject({ authorization: 'Bearer test-key' });
  });

  it('bypasses shared cache for a signed-in user', async () => {
    await call(route);
    match.mockClear();
    put.mockClear();
    const response = await call(route, { token: await signedToken(), key: 'test-key', rate: '1' });
    expect(response.headers.get('X-Stats-Cache')).toBe('BYPASS');
    expect(response.headers.has('Cache-Control')).toBe(false);
    expect(match).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    expect(stageLogs()[0].props.edge_cache).toBe('BYPASS');
    expect(JSON.stringify(stageLogs())).not.toContain('private-user');
    expect(JSON.stringify(stageLogs())).not.toContain('private@example.com');
  });

  it('bypasses shared cache for hideWatched and preserves signed-in filtering', async () => {
    const anonymous = await call(`${route}?hideWatched=Completed`);
    expect(anonymous.headers.get('X-Stats-Cache')).toBe('BYPASS');
    expect((await anonymous.json()).totalAnime).toBe(2);
    const personal = await call(`${route}?hideWatched=Completed`, { token: await signedToken() });
    expect(personal.headers.get('X-Stats-Cache')).toBe('BYPASS');
    expect((await personal.json()).totalAnime).toBe(1);
    expect(match).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it('falls through a cache lookup outage and ignores failed background puts', async () => {
    match.mockRejectedValueOnce(new Error('cache offline'));
    put.mockRejectedValueOnce(new Error('cache write offline'));
    const response = await call(route);
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Stats-Cache')).toBe('MISS');
    expect((await response.json()).totalAnime).toBe(2);
  });

  it('survives missing cache APIs and synchronous cache failures', async () => {
    vi.stubGlobal('caches', undefined);
    expect((await call(route)).status).toBe(200);
    vi.stubGlobal('caches', { default: { match, put } });
    put.mockImplementationOnce(() => {
      throw new Error('cache write failed');
    });
    expect((await call(route)).status).toBe(200);
  });

  it('samples no stage logs at rate zero and no telemetry without an ingest key', async () => {
    await call(route, { key: 'test-key', rate: '0' });
    expect(stageLogs()).toEqual([]);
    fetchMock.mockClear();
    await call(route, { rate: '1' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the default sample rate, clamps rates, and sanitizes colo', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.05);
    await call(route, { key: 'test-key', colo: 'private-colo' });
    expect(stageLogs()[0].props.colo).toBe('unknown');
    fetchMock.mockClear();
    vi.mocked(Math.random).mockReturnValue(0.2);
    await call(route, { key: 'test-key' });
    expect(stageLogs()).toEqual([]);
    await call(route, { key: 'test-key', rate: '-1' });
    expect(stageLogs()).toEqual([]);
    await call(route, { key: 'test-key', rate: '2' });
    expect(stageLogs()).toHaveLength(1);
  });

  it('never fails a stats response when log transport fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('collector offline'));
    expect((await call(route, { key: 'test-key', rate: '1' })).status).toBe(200);
  });
});

describe('stats route-specific behavior', () => {
  it('keeps empty manga catalogs uncached and logs the 404 stage outcome', async () => {
    vi.mocked(mangaStore.getMangaList).mockResolvedValue([]);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await call('/api/manga/stats', { key: 'test-key', rate: '1' });
      expect(response.status).toBe(404);
      expect(response.headers.get('X-Stats-Cache')).toBe('MISS');
      expect(response.headers.has('Cache-Control')).toBe(false);
    }
    expect(put).not.toHaveBeenCalled();
    expect(mangaStore.getMangaList).toHaveBeenCalledTimes(2);
    expect(statistics.getMangaStats).not.toHaveBeenCalled();
    expect(stageLogs()[0].props).toMatchObject({ status: 404, compute_ms: 0 });
  });

  it('bypasses manga stats for even an empty hideWatched query', async () => {
    const response = await call('/api/manga/stats?hideWatched=');
    expect(response.headers.get('X-Stats-Cache')).toBe('BYPASS');
    expect(put).not.toHaveBeenCalled();
  });

  it('preserves includeWatched anime filtering and cache bypass', async () => {
    const response = await call('/api/stats?includeWatched=Completed', {
      token: await signedToken(),
    });
    expect(response.headers.get('X-Stats-Cache')).toBe('BYPASS');
    expect((await response.json()).totalAnime).toBe(1);
    expect(put).not.toHaveBeenCalled();
  });
});
