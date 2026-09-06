# anime_list — PROJECT STATUS
Last updated: 2026-09-02

## Why / What

**Anime List** is a production anime/manga discovery app with multi-field search, shareable URLs, personal watchlists (Google OAuth), stats, schedule, and a unified discovery area for the seasonal queue and taste quiz.

**Users:** Anime/manga fans filtering a ~35k-title catalog; signed-in users tracking watchlists and discovering seasonal picks.

**Constraints:** Operational stability over feature expansion. Keep discovery focused and remove low-signal surfaces before expanding the product.

**IN scope:** Vite SPA frontend, `mal-api` Hono worker, Cloudflare D1, daily/quarterly catalog sync, personal watchlists, schedules, and discovery tools.

**OUT of scope:** Saved-search alerts, public collections, email digests, and character quiz persistence/OG images.

## Dependencies

### External

- **Google OAuth + JWT:** `jose`; httpOnly `mal_auth_token` cookie (7d).
- **Cloudflare D1:** catalog tables + per-user watchlists, schedule, and access tokens; database `anime-list`, Worker binding `DB`. Read-only search batches use the Sessions API and are replica-ready; global replication is currently disabled at the database setting. Retired alert and collection tables remain preserved without runtime routes.
- **Relational persistence:** Cloudflare D1 is authoritative; the retired Turso database was deleted on 2026-08-02.
- **Tenrai API:** daily GH Action sync + quarterly full refresh.
- **MAL CDN:** poster images (recurring operational risk).
- **PostHog:** client analytics.
- **Cloudflare:** Pages (SPA), Workers (`mal-api`), edge caches (stats 300s, detail 24h anonymous only).
- **Worker secrets (names only):** `JWT_SECRET`, `GOOGLE_CLIENT_ID`; any legacy unused Turso credential bindings are separate credential-cleanup work.
- **Env:** `.env` from `.env.example` — `GOOGLE_CLIENT_ID`, `JWT_SECRET`, `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_SAASMAKER_API_KEY`, optional `VITE_HOME_QUIZ_ABOVE_FOLD` (forces treatment for all visitors in the homepage A/B test; the live 50/50 split uses the `ab_home` cookie — see "Engagement measurement").

### Internal (fleet)

- **SaaS Maker:** `@saas-maker/feedback` with `VITE_SAASMAKER_API_KEY` as the
  hosted project key. Submissions go to api.sassmaker.com.

### Stack & commands

**Stack:** Vite 8 SPA + TanStack Router + Tailwind v4 + TanStack Query + nuqs (frontend); Hono Cloudflare Worker `mal-api`; Cloudflare D1; Google OAuth + JWT (`jose`); PostHog; Vitest + Playwright.

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install deps |
| `pnpm dev` | Worker :8787 + Vite :5173 |
| `pnpm dev:be` / `pnpm dev:worker` | Worker only |
| `pnpm dev:fe` | Vite only |
| `pnpm build` | Vite production build → `dist/` |
| `pnpm preview` | Vite preview |
| `pnpm deploy` | Clean `main` guard + build + `wrangler pages deploy` |
| `pnpm deploy:worker` | Deploy `mal-api` worker |
| `pnpm test` | Vitest (140 tests across 32 files) |
| `pnpm test:coverage` | Whole-source coverage with explicit regression floors |
| `pnpm quality` | Aggregate Fleet code-health, build, and bundle gate |
| `pnpm test:e2e` | Playwright (desktop + mobile) |
| `pnpm typecheck` / `pnpm lint` | TS (`tsc`) + Biome |
| `pnpm db:migrate:local` / `db:migrate:remote` | Apply D1 migrations |
| `pnpm db:seed` / `db:seed:manga` | Seed D1 from scripts |
| `pnpm db:update` / `db:update:manga` | Refresh from Tenrai |
| `pnpm db:update:anime:full` / `db:update:manga:full` | Refresh complete quality-gated catalogs |
| `pnpm db:quarterly-sync` | Quarterly anime re-score |

## Timeline

- **2026-09-02** — Restored reliable catalog ingestion through Tenrai, preserved
  anime airing and manga publication date ranges during normalization, added a
  bounded full-anime refresh path, and made MCP anime/manga searches explicitly
  pageable and model-readable. The application footer now spans the content
  shell with tighter spacing while route-loading skeletons keep it below active
  loading content.
- **2026-08-14** — Reduced initial client work by deferring query/monitoring
  providers, bounded full recommendation scoring to the requested result set,
  centralized filter serialization, and simplified responsive navigation.
  Mobile destinations now meet the 44px touch floor and the disclosure exposes
  explicit Open/Close and expanded state at 390 and 768 pixels. The same pass
  patched the high-severity transitive Nano ID advisory in the development
  toolchain; production deployment remains manual.
- **2026-08-12** — Adopted the Fleet code-health contract with whole-source
  coverage, Knip unused-code and cycle analysis, Lizard complexity ceilings,
  jscpd duplication ceilings, dependency severity and suppression accounting,
  and repository hygiene. Removed retired saved-search and operator-script
  code plus unused exports and no-op Worker telemetry before recording bounded
  debt.
- **2026-08-09** — Adopted the Fleet Ultracite baseline for core TypeScript,
  React, and Vitest code. Explicit compatibility exceptions preserve current
  behavior while 200 files pass with zero diagnostics; generated catalogs and
  the hand-authored HTML shell remain outside the checked surface.
- **2026-08-06** — Consolidated the weekly queue and taste quiz under Discover,
  retired Alerts and Collections without deleting their D1 data, promoted
  catalog updates in navigation, and standardized the product name as Anime
  List by Significant Hobbies.
- **2026-07-31** — Closed the remaining manga-search accessibility review:
  visible labels now name the sort controls, expandable and selectable filters
  expose state, and the two failing text treatments now exceed WCAG AA
  contrast. Fresh 390, 768, and 1440 pixel evidence has no Axe A/AA violations
  or horizontal overflow. Production deployment remains manual.
- **2026-07-31** — Completed source-level public SEO and agent coverage from
  one 13-route registry: accurate static-route metadata, 7,607 canonical
  sitemap URLs, 7,607 source-derived Markdown companions, and compact anime
  and manga catalog collections. Deployed to production on 2026-07-31.
- **2026-07-29** — Added an owned, editorial `/changelog` for verified product
  releases and preserved daily title-ingestion history at `/catalog-updates`.
  Roadmap and source links now point directly to the repository.
- **2026-07-25** — Closed MCP implementation planning after confirming the
  Streamable HTTP endpoint, read-only catalog/watchlist tools, hashed personal
  access tokens, `/mcp` setup page, tests, and durable base specifications.
  Production deployment remains manual.
- **2026-07-17** — Crawlable detail pages: Pages Functions rewrite `/anime/:malId` and `/manga/:malId` HTML with unique title, meta, canonical, OG, JSON-LD (TVSeries/Movie/Book), and hidden SSR summary for 5,306 anime + 2,288 manga. Unknown IDs get noindex. Chunked sitemaps (`sitemap-index.xml` + `sitemap-anime-N.xml` + `sitemap-manga-N.xml`) generated at build time. Deployed on 2026-07-31.
- **2026-07-11** — Search reliability pass shipped: debounced and abortable anime/manga requests, a bounded SQL fast path for simple numeric anime searches, production Google sign-in fallback configuration, and non-fatal quarterly Jikan fallback failures.
- **2026-07-03** — Shipped engagement telemetry for the quiz/collections/homepage funnels (`lib/engagement.ts`), the `VITE_HOME_QUIZ_ABOVE_FOLD` A/B switch (`lib/flags.ts`, default off), and a "Copy link" share button on `/collections`.
- **2026-07-04** — Upgraded the homepage A/B test from a build-time toggle to a live 50/50 cookie-based split (`ab_home`, 14-day expiry). Added `homepage_variant_seen` impression tracking, `quiz_result_shown`, `collection_created`, and `collection_viewed` events. See "Engagement measurement" below.
- **2026-07-02** — Added `app.onError()` global error handler to `mal-api` worker (catches unhandled Hono errors → 500 JSON + console.error logging).
- **2026-06-20** — De-OpenNext migration: rewritten from Next.js+OpenNext to Vite SPA + TanStack Router; `mal-api` worker unchanged; removed 17MB `cleaned_anime_data.json` from SPA.
- **2026-06-20** — Shipped PRD batch (2026-06-12): watchlist import/export, saved search alerts (in-app MVP), public collections.
- **2026-06-12** — PRD batch defined: watchlist import/export, saved search alerts, public collections.
- **Ongoing** — Daily GH Action Tenrai sync (00:00 UTC); quarterly anime/manga full refresh; worker cron `0 3 * * *` cache reload.

## Products

- **SPA (Pages):** https://anime.significanthobbies.com - project `anime-list`, branch `main`; PR previews remain on `pr-{N}.anime-list-9lk.pages.dev`.
- **API (Worker):** https://mal-api.sarthakagrawal927.workers.dev — Hono worker `mal-api`, cron `0 3 * * *`.
- **Local dev:** Vite :5173 + Worker :8787.

## Features (shipped)

### Public SEO and agent coverage (deployed)

- One registry owns 13 public static routes across metadata, Markdown,
  sitemaps, and the machine-readable agent catalog.
- The 5,306 crawlable anime and 2,288 crawlable manga detail routes each have a
  source-derived Markdown companion; personal and signed-in routes stay out of
  public discovery.
- `/api/ai` advertises two templated catalog collections separately from API
  and MCP resources, while static SPA routes receive route-specific canonical
  and social metadata.

### MCP access (shipped)

- `POST /api/mcp` provides Streamable HTTP MCP over the existing catalog and
  watchlist read paths; catalog tools are public and watchlist tools require a
  bearer token.
- Anime and manga search tools return bounded pages with totals, page number,
  `hasMore`, and `nextOffset`. The sanitized payload is present in both MCP text
  content and structured content for clients that support only one response form.
- New personal access tokens use an `anime_list_` prefix, are SHA-256 hashed at
  rest, shown only once, scoped to their owner, and revocable. Existing
  `shelf_` tokens remain valid for backward compatibility.
- `/mcp` provides anonymous setup documentation and signed-in token management.
- The agent-edge catalog advertises the live MCP surface.

### SEO: crawlable detail pages (deployed 2026-07-31)

- **Pages Functions** (`functions/anime/[malId].ts`, `functions/manga/[malId].ts`) intercept detail routes before the SPA catch-all.
- **HTML rewriting**: unique `<title>`, meta description, canonical, OG/Twitter tags, JSON-LD (`TVSeries`/`Movie` for anime, `Book` for manga), and a `<div hidden data-ssr>` summary with h1 + synopsis + facts table.
- **SEO dataset**: `scripts/build-seo-dataset.mjs` (prebuild) filters 14,841 anime → 5,306 (members ≥ 20k) and 20,656 manga → 2,288 (members ≥ 10k) into compact `src/data/seo-{anime,manga}.json`.
- **Sitemaps**: `scripts/build-sitemaps.mjs` (postbuild) emits chunked XML (`sitemap-index.xml` + `sitemap-anime-{1,2}.xml` + `sitemap-manga-1.xml`, ≤5000 urls per chunk).
- **Unknown IDs**: served with `<meta name="robots" content="noindex">`.
- **Pure rewrite function**: `src/seoRewrite.ts` with HTML escaping, `</script>` injection protection, 17 vitest tests.
- **e2e tests**: unique title assertion + app mounts + noindex on unknown id.

### Frontend routes (21 paths, TanStack Router `src/router.tsx`)

- `/` HomePage (marketing/FAQ), `/about`, `/privacy`, `/terms`, `/changelog`.
- `/search` — advanced anime filter search with URL-encoded state (nuqs).
- `/discover` — signed-in seasonal queue + privacy-safe anime taste quiz.
- `/anime/$malId`, `/manga/$malId` — detail pages with relations/recommendations.
- `/genre/$genre`, `/random` — discovery pickers.
- `/schedule` — episode pacing schedule.
- `/watchlist` — anime watchlist + import/export.
- `/stats`, `/manga`, `/manga/stats`, `/manga/watchlist` — manga surfaces.
- `/quiz` — legacy entry into the unified `/discover` quiz panel.

### Worker API (`src/worker.ts` + `src/worker/mangaRoutes.ts`, 50+ endpoints)

- Auth: `POST /api/auth/google`, `POST /api/auth/logout`.
- Catalog: `POST /api/search`, `GET /api/stats`, `GET /api/anime/random`, `GET /api/anime/:malId`, `GET /api/fields`, `GET /api/filters`, `GET /api/last-updated`, `GET /api/changelog`.
- Watchlist: full CRUD, tags, taste recommendations (`buildTasteRecommendations`), enriched view, import preview/apply (MAL XML/CSV, AniList JSON, Anime List JSON), export (JSON/CSV/AniList).
- Schedule: timeline, add/update/remove/reorder.
- Discover: `GET /api/discover/queue` (taste-weighted seasonal + manga interleave 1:5), `POST /api/discover/dismiss`.
- Manga: parallel search/stats/random/watchlist/detail routes under `/api/manga/*`.

### Architecture

- Vite SPA calls `mal-api` through a same-origin `/api/*` Worker Route;
  TanStack Query caches responses client-side, while Pages previews retain the
  Function proxy as a fallback.
- Worker loads full anime (~14.8k) + manga (~20.7k) catalogs into in-memory stores with 1hr stale-while-revalidate.
- D1 stores catalog tables + per-user watchlists, schedule, and access tokens through the `DB` Worker binding. Retired alert and collection tables remain dormant.
- Google OAuth → JWT in httpOnly `mal_auth_token` cookie (7d).
- Worker cron `0 3 * * *` reloads catalog caches after the GitHub Action refresh.
- GitHub Actions: daily Tenrai sync (00:00 UTC), quarterly anime/manga full refresh, and a manual (`workflow_dispatch`) Pages deploy — no auto-deploy on push.
- Edge caches: stats 300s, detail 24h (anonymous only); catalog search is D1-first and uncached.
- CORS allowlist for Pages, worker, localhost, PR previews.
- Deploy branch guard on `pnpm deploy` (clean `main` only).

### Catalog & search

- ~14.8k anime + ~20.7k manga with quality gates (score, scored_by, members, favorites, year).
- Advanced multi-field filters with active filter explanation chips (`ActiveFilterChip`).
- Smart ranking: log-scale popularity + MAL score balance.
- Common searches use indexed count/page statements in one D1 batch call, with
  no response-cache dependency; weighted or personalized searches retain the
  in-memory fallback.
- Daily GH Action Tenrai sync + quarterly full anime/manga metadata refresh + worker cron 03:00 UTC cache reload.

### Personal & discovery

- Watchlist statuses: Watching, Completed, Deferred, Avoiding, BRR + custom tags.
- Discover queue: current/previous season scoring, taste-weighted genres/themes, quick add/dismiss/skip, signed-in gating.
- Quiz: 4 questions → 4 anime archetypes → prefilled search URLs; privacy-safe, no persistence.
- First-screen polish: live counts, skeletons, poster grids.

### Watchlist portability

- Watchlist import/export with conflict preview; merge/replace/skip modes on `/watchlist`.

Saved-search alerts and public collections were removed from the runtime on
2026-08-06. Their D1 tables remain preserved so the retirement is reversible
without deleting user data.

### Database tables (Cloudflare D1, explicit Wrangler migrations)

- `users`, `user_tags`, `anime_watchlist`, `manga_watchlist`, `anime_dismissals`, `anime_schedule`, `anime_data`, `manga_data`, `anime_relations_cache`, `anime_recommendations_cache`, `saved_searches`, `saved_search_alerts`, `collections`, `collection_items`.

### Tests & ops

- Shared Ultracite lint baseline with a clean 200-file check, plus one aggregate
  Fleet quality gate for formatting, types, tests, unused code, complexity,
  duplication, dependency risk/cycles, suppressions, build, size, and hygiene.
- Vitest: 140 tests across 32 files (D1, API proxy, import/export, filters,
  recommendations, schedule, SEO rewrite, detail cache).
- Playwright: anime detail load, mobile touch targets, no horizontal scroll,
  plus hermetic signed-in coverage for discovery and watchlist import preview.
- PostHog analytics.

### Engagement measurement

Instrumentation lives in `lib/engagement.ts` (surface funnels) and `lib/analytics.ts` (fixed 4-event fleet taxonomy). All events route through `posthog-js` (lazy-loaded, fail-silent) and carry `project_id: "anime_list"`.

**Quiz funnel** (`/discover#quiz`; `/quiz` remains a legacy entry):
- `quiz_viewed` → `quiz_started` (first answer) → `quiz_completed` (all answered, archetype id only) → `quiz_result_shown` (result card displayed) → `quiz_result_clicked` (clickthrough to search or exemplar detail).
- Privacy: only the derived archetype id is sent — never individual answers.

**Homepage A/B test** (`/`):
- 50/50 cookie-based split (`ab_home`, 14-day expiry) via `homeVariant()` in `lib/flags.ts`.
  - `control` — current homepage (quiz CTA only in footer).
  - `treatment` — quiz CTA promoted into the hero, above the fold.
- `homepage_variant_seen` fires on each homepage mount (impression).
- `home_surface_click` fires on every CTA click with `home_variant` + `placement`.
- Every funnel event carries `home_variant` so PostHog can split results by variant.
- Manual override: `?ff_quiz_home=1` (treatment) / `=0` (control). Build-time `VITE_HOME_QUIZ_ABOVE_FOLD=true` forces treatment for all visitors (use for full rollout, not the test).

**Fleet taxonomy** (`lib/analytics.ts`):
- `signup` (first Google sign-in for an account) → `activated` (first watchlist add) → `core_action` (watchlist add / anime search / manga search) → `returned` (later session for a user with prior activity).

**Decision rule (2-week window):** After 2 weeks of data, compare control vs treatment on `homepage_variant_seen` → `home_surface_click` (quiz) → `quiz_started` → `quiz_completed` → `quiz_result_clicked` → `signup`. Keep only the winner; park the loser. If no statistically meaningful lift, keep control (less surface area) and park the quiz-above-fold variant.

## Work queue

Open work is tracked only in [GitHub Issues](https://github.com/Significant-Hobbies/anime-list/issues).
An open issue is a to-do, a linked pull request is in progress, and merge plus
issue closure makes the work done.
