// App-Health endpoint telemetry: per-route method/status/duration shipped to
// the ingest collector. Dependency-free — the ingest wire format is a single
// POST. Silent no-op until APP_HEALTH_INGEST_KEY is set (secret, not vars: a
// same-name vars entry replaces the secret on deploy). Telemetry can never
// fail a request. Paths collapse to route templates — raw MAL ids and token
// ids never leave the worker.

import { createPing } from '../../lib/ping';

const INGEST_ENDPOINT = 'https://ingest.sassmaker.com/v1/ingest';

export interface StatsStages {
  edge_cache: 'HIT' | 'MISS' | 'BYPASS';
  store_ms?: number;
  compute_ms?: number;
}

// Request-scoped measurements survive Hono response wrapping, never the edge cache.
export const statsStages = new WeakMap<Request, StatsStages>();

type HealthEnv = {
  APP_HEALTH_INGEST_KEY?: string;
  APP_HEALTH_STAGE_SAMPLE_RATE?: string;
};

function boundedMs(value: number): number {
  return Number.isFinite(value) ? Math.min(600_000, Math.max(0, Math.round(value))) : 0;
}

function requestColo(request: Request): string {
  const colo = request.cf?.colo;
  return typeof colo === 'string' && /^[A-Za-z0-9]{1,8}$/.test(colo) ? colo : 'unknown';
}

function observeStats(
  request: Request,
  response: Response,
  durationMs: number,
  route: string,
  key: string,
  env: HealthEnv,
  ctx?: ExecutionContext
): void {
  const stages = statsStages.get(request);
  if (!stages || (route !== '/api/stats' && route !== '/api/manga/stats') || !ctx) return;
  const configuredRate = Number(env.APP_HEALTH_STAGE_SAMPLE_RATE ?? 0.1);
  const rate = Number.isFinite(configuredRate) ? Math.min(1, Math.max(0, configuredRate)) : 0.1;
  if (rate === 0 || Math.random() >= rate) return;

  try {
    ctx.waitUntil(
      createPing({ key })
        .debug('api.stage_timing', {
          props: {
            route,
            status: response.status,
            total_ms: boundedMs(durationMs),
            edge_cache: stages.edge_cache,
            inner_cache: 'NONE',
            colo: requestColo(request),
            store_ms: stages.store_ms === undefined ? undefined : boundedMs(stages.store_ms),
            compute_ms: stages.compute_ms === undefined ? undefined : boundedMs(stages.compute_ms),
          },
        })
        .catch(() => false)
    );
  } catch {
    // Stage logs must never take down the request path.
  }
}

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
  env: HealthEnv,
  ctx?: ExecutionContext
): void {
  const key =
    typeof env?.APP_HEALTH_INGEST_KEY === 'string' ? env.APP_HEALTH_INGEST_KEY.trim() : '';
  const route = routeFor(new URL(request.url).pathname);
  if (!key || !route) return;
  observeStats(request, response, durationMs, route, key, env, ctx);
  const batch = {
    batch_id: crypto.randomUUID(),
    schema_version: 'v1',
    runtime: 'worker',
    environment: 'production',
    events: [
      {
        event_id: crypto.randomUUID(),
        timestamp: Date.now(),
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
