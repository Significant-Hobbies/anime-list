// App-Health endpoint telemetry: per-route method/status/duration shipped to
// the ingest collector. Dependency-free — the ingest wire format is a single
// POST. Silent no-op until APP_HEALTH_INGEST_KEY is set (secret, not vars: a
// same-name vars entry replaces the secret on deploy). Telemetry can never
// fail a request. Paths collapse to route templates — raw MAL ids and token
// ids never leave the worker.

const INGEST_ENDPOINT = 'https://ingest.sassmaker.com/v1/ingest';

const STATIC_ROUTES = new Set([
  '/',
  '/openapi.json',
  '/openapi.yaml',
  '/llms.txt',
  '/llms-full.txt',
  '/index.md',
  '/api/auth/google',
  '/api/auth/logout',
  '/api/fields',
  '/api/filters',
  '/api/last-updated',
  '/api/changelog',
  '/api/search',
  '/api/stats',
  '/api/anime/random',
  '/api/ai',
  '/api/manga/fields',
  '/api/manga/filters',
  '/api/manga/search',
  '/api/manga/stats',
  '/api/manga/random',
  '/api/manga/watchlist/enriched',
  '/api/manga/watchlist',
  '/api/manga/watched/add',
  '/api/manga/watched/remove',
  '/api/watchlist',
  '/api/watchlist/tags',
  '/api/watchlist/recommendations',
  '/api/watchlist/enriched',
  '/api/watchlist/import/preview',
  '/api/watchlist/import/apply',
  '/api/watchlist/export/anilist',
  '/api/watchlist/export/json',
  '/api/watchlist/export/csv',
  '/api/watched/add',
  '/api/watched/remove',
  '/api/schedule/timeline',
  '/api/schedule/add',
  '/api/schedule/remove',
  '/api/schedule/reorder',
  '/api/discover/queue',
  '/api/discover/dismiss',
  '/api/mcp',
  '/api/tokens',
]);

const PARAMETERIZED_ROUTES: ReadonlyArray<[RegExp, string]> = [
  [/^\/api\/anime\/[^/]+$/, '/api/anime/:malId'],
  [/^\/api\/anime\/[^/]+\/note$/, '/api/anime/:malId/note'],
  [/^\/api\/manga\/[^/]+$/, '/api/manga/:malId'],
  [/^\/api\/watchlist\/tags\/[^/]+\/update$/, '/api/watchlist/tags/:tagId/update'],
  [/^\/api\/watchlist\/tags\/[^/]+\/delete$/, '/api/watchlist/tags/:tagId/delete'],
  [/^\/api\/schedule\/[^/]+\/update$/, '/api/schedule/:malId/update'],
  [/^\/api\/tokens\/[^/]+\/revoke$/, '/api/tokens/:id/revoke'],
];

function routeFor(pathname: string): string | null {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (STATIC_ROUTES.has(p)) return p;
  return PARAMETERIZED_ROUTES.find(([pattern]) => pattern.test(p))?.[1] ?? null;
}

export function observeRequest(
  request: Request,
  response: Response,
  durationMs: number,
  env: { APP_HEALTH_INGEST_KEY?: string },
  ctx?: ExecutionContext
): void {
  const key =
    typeof env?.APP_HEALTH_INGEST_KEY === 'string' ? env.APP_HEALTH_INGEST_KEY.trim() : '';
  const route = routeFor(new URL(request.url).pathname);
  if (!key || !route) return;
  const batch = {
    batch_id: crypto.randomUUID(),
    schema_version: 'v1',
    runtime: 'worker',
    environment: 'production',
    events: [
      {
        event_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        method: request.method,
        route,
        status_code: response.status,
        duration_ms: Math.max(0, Math.round(durationMs)),
      },
    ],
  };
  try {
    ctx?.waitUntil(
      fetch(INGEST_ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(batch),
      }).catch(() => undefined)
    );
  } catch {
    // Telemetry must never take down the request path.
  }
}
