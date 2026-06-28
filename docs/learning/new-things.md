# new-things — study queue

Short stubs for non-standard tech in this repo. 3–5 lines each. Fill `Why here:`
yourself after learning; never invent rationale.

## Jikan API rate limiting with parallel delay
- What: Running API delay concurrently with the fetch instead of blocking before it
- Why here: TBD
- Gotcha (from code): `src/api.ts:35` — `await Promise.all([axios.get(url), delay(API_CONFIG.rateLimit)])` runs the 1s delay in parallel with the API call, so you don't pay sequential cost
- Source: https://docs.jikan.moe/

## MAL data quality gates
- What: Filtering out incomplete anime records before storage — missing any required field drops the record
- Why here: TBD
- Gotcha (from code): `src/api.ts:90` — requires `score && scored_by && members && favorites && year`; missing any one drops the row entirely
- Source: https://myanimelist.net/

## Turso + Drizzle on Cloudflare Workers
- What: Using `@libsql/client/web` instead of the node client for the Workers runtime
- Why here: TBD
- Gotcha (from code): `src/db/client.ts:1` — imports from `@libsql/client/web` specifically; the node client won't bundle in Workers
- Source: https://docs.turso.tech/sdk/ts/quickstart

## Cloudflare Worker cron triggers
- What: Scheduled tasks via wrangler cron syntax — a Hono app that handles both HTTP and cron
- Why here: TBD
- Gotcha (from code): `wrangler.cron.toml:10` — cron runs at `0 3 * * *` (3 AM UTC daily); the same worker entry handles `scheduled` events alongside HTTP routes
- Source: https://developers.cloudflare.com/workers/configuration/cron-triggers/

## Stale-while-revalidate with cold-start deduping
- What: Preventing stampede when multiple requests hit a cold cache simultaneously
- Why here: TBD
- Gotcha (from code): `src/store/animeStore.ts:11` — `coldLoadPromise` is shared across all concurrent requests during cold start, so 50 parallel inbound requests share a single Turso scan
- Source: https://web.dev/articles/stale-while-revalidate

## Edge Cache API with fake URLs
- What: Using fake domain names as cache keys to avoid URL conflicts in the Cloudflare Edge Cache API
- Why here: TBD
- Gotcha (from code): `src/worker.ts:240` — uses `https://mal-cache.local/api/search` as cache URL — a fake domain that maps to the Edge Cache API
- Source: https://developers.cloudflare.com/workers/runtime-apis/cache/

## Jose JWT with remote JWKS for Google OAuth
- What: Using the `jose` library with remote JWK set instead of `google-auth-library`
- Why here: TBD
- Gotcha (from code): `src/worker.ts:249` — `createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))` fetches Google's public keys dynamically at verification time
- Source: https://github.com/panva/jose

## Batch upsert with created_at tracking
- What: Distinguishing inserts from updates by comparing `created_at` vs `updated_at` timestamps after a batch upsert
- Why here: TBD
- Gotcha (from code): `src/db/animeData.ts:204` — after batch upsert, queries `WHERE created_at = updated_at` to identify which rows were newly inserted vs updated
- Source: https://www.sqlite.org/lang_upsert.html

## Pure filter engine for Workers
- What: Filter logic with zero file-system or native module dependencies, safe to import from Cloudflare Workers
- Why here: TBD
- Gotcha (from code): `src/filterEngine.ts:2-4` — comment explicitly states "Pure filter/matching logic with zero file-system or native module dependencies"
- Source: https://developers.cloudflare.com/workers/reference/how-workers-work/
