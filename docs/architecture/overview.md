# Architecture overview

## System shape

```
Browser (Vite SPA, Cloudflare Pages)
   │  TanStack Query (client cache) + nuqs (URL state)
   ▼
mal-api (Cloudflare Worker, Hono)  ── cron 0 3 * * * ──▶ reload caches + saved-search alerts
   │  in-memory animeStore / mangaStore (stale-while-revalidate, 1h TTL)
   │  edge Cache API (search 180s, stats 300s, detail 24h anonymous)
   ▼
Turso (libSQL)  ──  anime_data, manga_data, watchlists, schedule, saved_searches, collections, users
   ▲
   │  GitHub Actions (daily 00:00 UTC, quarterly) — Jikan API fetch + upsert
Jikan API (MyAnimeList)
```

Pages Functions (`functions/anime/[malId].ts`, `functions/manga/[malId].ts`)
sit on Cloudflare Pages in front of the SPA shell and rewrite detail-page HTML
for crawlable SEO (see
[`decisions/0003-crawlable-detail-pages.md`](decisions/0003-crawlable-detail-pages.md)).

## Layers

- **Frontend (Cloudflare Pages, project `anime-list`):** Vite 8 SPA +
  TanStack Router + Tailwind v4 + shadcn/ui + TanStack Query + nuqs. Routes
  in `src/router.tsx`; route files under `src/pages/`. Components in
  `components/` (FilterBuilder, MangaFilterBuilder, cards, charts,
  `components/discover/`, `components/ui/`).
- **API (Cloudflare Worker `mal-api`):** Hono app in `src/worker.ts` +
  `src/worker/mangaRoutes.ts`. Handles HTTP routes and a `scheduled` cron
  entry from the same module. Pure filter logic in `src/filterEngine.ts`;
  transforms in `src/dataProcessor.ts`; aggregation in `src/statistics.ts`.
- **Persistence (Turso libSQL):** single DB in prod; optional
  `TURSO_MANGA_*` override for a separate manga catalog DB. Client uses
  `@libsql/client/web` (Workers-compatible). Inline migrations at worker
  startup (`src/db/migrations.ts`, `src/db/mangaMigrations.ts`).
- **In-memory cache (`src/store/`):** `animeStore` / `mangaStore` load the
  full catalog from Turso with a 1h stale-while-revalidate TTL and a shared
  `coldLoadPromise` to dedupe cold-start stampede across concurrent requests
  in the same isolate.
- **Auth:** Google OAuth 2.0 → JWT signed with `jose`; httpOnly
  `mal_auth_token` cookie (7d). Google JWKS fetched remotely at verify time
  via `createRemoteJWKSet`.
- **Analytics:** PostHog (`lib/analytics.ts`, `lib/engagement.ts`).

## Key non-obvious constraints

- **Workers bundling:** the libSQL client must be imported from
  `@libsql/client/web`; the Node client does not bundle in the Workers
  runtime.
- **Filter engine purity:** `src/filterEngine.ts` has zero file-system or
  native-module dependencies so it is safe to import from both the Worker and
  scripts/tests.
- **Edge cache keys use a fake host** (`https://mal-cache.local/...`) to
  avoid URL collisions in the Cloudflare Edge Cache API.
- **`VITE_*` build vars** are inlined into the client bundle at build time
  via `import.meta.env`; `wrangler.toml` `[vars]` only applies at runtime to
  the worker. The deploy workflow sets the client vars explicitly.
- **Deploy branch guard:** `pnpm deploy` refuses unless on a clean `main`.
- **CORS allowlist** (`src/corsOrigins.ts`): Pages, worker, localhost, and
  PR preview origins.

## Caching strategy

| Surface | TTL | Notes |
| --- | --- | --- |
| Worker in-memory catalog | 1h stale-while-revalidate | Cron reloads daily at 03:00 UTC |
| `/api/search` edge | 180s | keyed by encoded filter + auth flag |
| `/api/stats` edge | 300s | |
| `/api/last-updated` edge | cached only on the uncached public read path | |
| Detail page HTML | `max-age=300, s-maxage=86400` | content changes only on dataset refresh |
| Sitemaps | `s-maxage=86400` | |

## Decisions

Durable technical decisions are recorded as ADRs in
[`decisions/`](decisions/):

- [`0001-vite-spa-migration.md`](decisions/0001-vite-spa-migration.md) — migrate off Next.js + OpenNext to a Vite SPA.
- [`0002-cloudflare-workers-migration.md`](decisions/0002-cloudflare-workers-migration.md) — replace the Render/Express backend with a Hono Worker.
- [`0003-crawlable-detail-pages.md`](decisions/0003-crawlable-detail-pages.md) — Pages Functions rewrite detail HTML for SEO.
- [`0004-engagement-measurement.md`](decisions/0004-engagement-measurement.md) — quiz/collections funnels + homepage A/B test.

Reusable implementation tricks and failed approaches live in
[`../knowledge/`](../knowledge/).
