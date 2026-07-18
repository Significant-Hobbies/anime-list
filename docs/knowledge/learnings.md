# Learnings — non-obvious implementation tricks

Short notes on non-standard techniques used in this repo, with code anchors.
Code anchors use symbol/path references rather than exact line numbers
because lines drift; grep the symbol to find the current location.

## Jikan rate limiting with parallel delay

- **What:** Running the API delay concurrently with the fetch instead of
  blocking before it.
- **Why here:** Jikan enforces rate limits; we still want max throughput
  without serializing the wait behind the request.
- **Anchor:** `src/api.ts` — `await Promise.all([axios.get(url), delay(API_CONFIG.rateLimit)])`
  runs the 1s delay in parallel with the API call.
- **Source:** https://docs.jikan.moe/

## MAL data quality gates

- **What:** Filtering out incomplete anime records before storage — missing
  any required field drops the record.
- **Why here:** Keeps the catalog credible; the discover UI and ranking
  assume every row has score/members/favorites/year.
- **Anchor:** `src/api.ts` — the fetch loop requires
  `score && scored_by && members && favorites && year`; missing any one
  drops the row entirely.
- **Source:** https://myanimelist.net/

## Turso + libSQL on Cloudflare Workers

- **What:** Using `@libsql/client/web` instead of the Node client for the
  Workers runtime.
- **Why here:** The Node libSQL client depends on native modules that do not
  bundle in the Workers runtime.
- **Anchor:** `src/db/client.ts` — imports from `@libsql/client/web`.
- **Source:** https://docs.turso.tech/sdk/ts/quickstart

## Cloudflare Worker cron triggers

- **What:** Scheduled tasks via wrangler cron syntax — a Hono app that
  handles both HTTP and `scheduled` events from one module.
- **Why here:** Replaces `node-cron` (unreliable on Render) with a
  first-class Cloudflare trigger; the same entry reloads caches and
  evaluates saved-search alerts.
- **Anchor:** `wrangler.cron.toml` (`crons = ["0 3 * * *"]`) and the
  `scheduled` export in `src/worker.ts`.
- **Source:** https://developers.cloudflare.com/workers/configuration/cron-triggers/

## Stale-while-revalidate with cold-start deduping

- **What:** Preventing stampede when many requests hit a cold cache
  simultaneously.
- **Why here:** On a cold isolate, 50 parallel inbound requests would
  otherwise each trigger a full Turso scan.
- **Anchor:** `src/store/animeStore.ts` — `coldLoadPromise` is shared across
  all concurrent requests during cold start, so the scan runs once per
  isolate.
- **Source:** https://web.dev/articles/stale-while-revalidate

## Edge Cache API with fake-URL keys

- **What:** Using a fake domain as the cache key to avoid URL conflicts in
  the Cloudflare Edge Cache API.
- **Why here:** The Edge Cache API keys on a URL; reusing the real request
  URL would collide with the origin fetch.
- **Anchor:** `src/worker.ts` — cache keys use `https://mal-cache.local/...`
  (a fake host) mapped to the Edge Cache API.
- **Source:** https://developers.cloudflare.com/workers/runtime-apis/cache/

## Jose JWT with remote JWKS for Google OAuth

- **What:** Verifying Google ID tokens with `jose`'s remote JWK set instead
  of `google-auth-library`.
- **Why here:** Smaller, Workers-compatible dependency; Google's public keys
  are fetched and cached at verify time.
- **Anchor:** `src/worker.ts` —
  `createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))`.
- **Source:** https://github.com/panva/jose

## Batch upsert with created_at tracking

- **What:** Distinguishing inserts from updates by comparing `created_at`
  vs `updated_at` after a batch upsert.
- **Why here:** Lets the sync report how many rows were newly added vs
  updated without a separate pre-query.
- **Anchor:** `src/db/animeData.ts` — after batch upsert, queries
  `WHERE created_at = updated_at` to identify new rows.
- **Source:** https://www.sqlite.org/lang_upsert.html

## Pure filter engine for Workers

- **What:** Filter logic with zero file-system or native-module
  dependencies, safe to import from Cloudflare Workers.
- **Why here:** The same filter logic is shared by the worker, scripts, and
  tests; any Node-only import would break the worker bundle.
- **Anchor:** `src/filterEngine.ts` — header comment states the purity
  constraint explicitly.
- **Source:** https://developers.cloudflare.com/workers/reference/how-workers-work/
