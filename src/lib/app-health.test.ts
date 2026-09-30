import { afterEach, describe, expect, it, vi } from 'vitest';

import { observeRequest } from './app-health';

afterEach(() => vi.unstubAllGlobals());

async function telemetryFor(path: string) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const batch = JSON.parse(String(init?.body));
    return Response.json(batch);
  });
  vi.stubGlobal('fetch', fetchMock);
  const pending: Promise<unknown>[] = [];

  observeRequest(
    new Request(`https://anime.example${path}`),
    new Response(null, { status: 200 }),
    12,
    { APP_HEALTH_INGEST_KEY: 'test-ingest-key' },
    { waitUntil: (promise: Promise<unknown>) => pending.push(promise) } as ExecutionContext
  );

  await Promise.all(pending);
  return fetchMock;
}

describe('App Health route privacy', () => {
  it('uses fixed templates for MAL, tag, and token identifiers', async () => {
    const cases = [
      ['/api/anime/12345', '/api/anime/:malId', '12345'],
      ['/api/manga/98765', '/api/manga/:malId', '98765'],
      [
        '/api/watchlist/tags/my-private-tag/update',
        '/api/watchlist/tags/:tagId/update',
        'my-private-tag',
      ],
      ['/api/tokens/pat_secret-looking/revoke', '/api/tokens/:id/revoke', 'pat_secret-looking'],
    ];

    for (const [path, route, identifier] of cases) {
      const fetchMock = await telemetryFor(path);
      const batch = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
      expect(batch.events[0].route).toBe(route);
      expect(Number.isInteger(batch.events[0].timestamp)).toBe(true);
      expect(JSON.stringify(batch)).not.toContain(identifier);
    }
  });

  it('skips unknown API paths and arbitrary username-like routes', async () => {
    for (const path of ['/api/users/private-user/token-abc', '/private-user/profile']) {
      const fetchMock = await telemetryFor(path);
      expect(fetchMock).not.toHaveBeenCalled();
    }
  });
});
