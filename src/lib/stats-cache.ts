import type { Context } from 'hono';
import { statsStages, type StatsStages } from './app-health';

const STATS_CACHE_TTL_SECONDS = 300;

export async function withStatsCache(
  c: Context,
  route: '/api/stats' | '/api/manga/stats',
  isBaseStats: boolean,
  buildResponse: (stages: StatsStages) => Promise<Response>
): Promise<Response> {
  const stages: StatsStages = { edge_cache: isBaseStats ? 'MISS' : 'BYPASS' };
  statsStages.set(c.req.raw, stages);
  const cacheRequest = isBaseStats ? new Request(`https://mal-cache.local${route}?v=1`) : null;
  let edgeCache: Cache | undefined;
  if (cacheRequest) {
    try {
      edgeCache = (caches as unknown as { default: Cache }).default;
      const cached = await edgeCache.match(cacheRequest);
      if (cached) {
        stages.edge_cache = 'HIT';
        const response = new Response(cached.body, cached);
        response.headers.set('X-Stats-Cache', 'HIT');
        return response;
      }
    } catch {
      // Cache outages fall through to the catalog and computation.
    }
  }

  stages.store_ms = 0;
  stages.compute_ms = 0;
  const response = await buildResponse(stages);
  response.headers.set('X-Stats-Cache', stages.edge_cache);
  if (cacheRequest && response.ok) {
    response.headers.set('Cache-Control', `public, max-age=0, s-maxage=${STATS_CACHE_TTL_SECONDS}`);
    try {
      if (edgeCache) {
        c.executionCtx.waitUntil(
          edgeCache.put(cacheRequest, response.clone()).catch(() => undefined)
        );
      }
    } catch {
      // Cache writes are best effort and never fail a stats response.
    }
  }
  return response;
}
