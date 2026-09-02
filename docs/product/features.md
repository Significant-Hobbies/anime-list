# Shipped features

This is a product-level inventory of what exists today. For *how* it works,
see [`../architecture/overview.md`](../architecture/overview.md). For the
current build/ship timeline, see [`../../PROJECT_STATUS.md`](../../PROJECT_STATUS.md).

## Frontend routes (TanStack Router, `src/router.tsx`)

- `/` HomePage (marketing/FAQ), `/about`, `/privacy`, `/terms`, `/changelog`.
- `/search` — advanced anime filter search with URL-encoded state (nuqs).
- `/discover` — signed-in seasonal queue + privacy-safe anime taste quiz.
- `/anime/$malId`, `/manga/$malId` — detail pages with relations/recommendations.
- `/genre/$genre`, `/random` — discovery pickers.
- `/schedule` — episode pacing schedule.
- `/watchlist` — anime watchlist + import/export.
- `/stats`, `/manga`, `/manga/stats`, `/manga/watchlist` — manga surfaces.
- `/quiz` — legacy entry into the unified `/discover` quiz panel.
- `/mcp` — MCP server docs + Personal Access Token management for AI tools.

## Worker API (`src/worker.ts` + `src/worker/mangaRoutes.ts`)

40+ endpoints. Auth via `requireAuth` / `optionalAuth` middleware.

- **Auth:** `POST /api/auth/google`, `POST /api/auth/logout`.
- **Catalog:** `POST /api/search`, `GET /api/stats`, `GET /api/anime/random`,
  `GET /api/anime/:malId`, `GET /api/fields`, `GET /api/filters`,
  `GET /api/last-updated`, `GET /api/changelog`.
- **Watchlist:** full CRUD, tags, taste recommendations
  (`buildTasteRecommendations`), enriched view, import preview/apply
  (MAL XML/CSV, AniList JSON, Anime List JSON), export (JSON/CSV/AniList).
- **Schedule:** timeline, add/update/remove/reorder.
- **Discover:** `GET /api/discover/queue` (taste-weighted seasonal + manga
  interleave 1:5), `POST /api/discover/dismiss`.
- **Manga:** parallel search/stats/random/watchlist/detail under `/api/manga/*`.
- **MCP server:** `POST /api/mcp` — Streamable HTTP MCP server exposing the
  catalog + watchlist as tools for AI clients. Public tools (search, detail,
  stats, random) work without auth; watchlist tools require a Personal
  Access Token. Authenticated collection tools use bounded `limit`/`offset`
  pagination with exact totals and `nextOffset` continuation. Public catalog
  searches expose the same continuation contract in both text and structured
  MCP output. User-facing docs + token management at `/mcp`.
- **Personal Access Tokens:** `POST /api/tokens`, `GET /api/tokens`,
  `POST /api/tokens/:id/revoke` — long-lived revocable bearer tokens
  (`anime_list_…`, SHA-256 hashed at rest; legacy `shelf_…` tokens remain valid)
  for MCP watchlist auth.

## Crawlable detail pages (2026-07-17, deploy pending)

- Pages Functions (`functions/anime/[malId].ts`, `functions/manga/[malId].ts`)
  intercept detail routes before the SPA catch-all and rewrite the shell with
  unique `<title>`, meta description, canonical, OG/Twitter tags, JSON-LD
  (`TVSeries`/`Movie` for anime, `Book` for manga), and a hidden SSR summary.
- SEO dataset: `scripts/build-seo-dataset.mjs` (prebuild) filters to 5,306
  anime (members ≥ 20k) + 2,288 manga (members ≥ 10k) into compact
  `src/data/seo-{anime,manga}.json`.
- Sitemaps: `scripts/build-sitemaps.mjs` (postbuild) emits chunked XML
  (`sitemap-index.xml` + per-type chunks, ≤5000 urls per chunk).
- Unknown IDs served with `<meta name="robots" content="noindex">`.
- Pure rewrite logic in `src/seoRewrite.ts` with HTML escaping and
  `</script>` injection protection; covered by vitest + playwright.
- See [`../architecture/decisions/0003-crawlable-detail-pages.md`](../architecture/decisions/0003-crawlable-detail-pages.md).

## Personal & discovery

- Watchlist statuses: `Watching`, `Completed`, `Deferred`, `Avoiding`, `BRR`
  + custom tags.
- Discover queue: current/previous season scoring, taste-weighted
  genres/themes, quick add/dismiss/skip, signed-in gating.
- Quiz: 4 questions → 4 anime archetypes → prefilled search URLs;
  privacy-safe, no persistence. Expansion deferred pending engagement data
  (see [`../archive/2026-06-04-character-identity-quiz-brief.md`](../archive/2026-06-04-character-identity-quiz-brief.md)).

## Watchlist portability

- Watchlist import/export with conflict preview; merge/replace/skip modes.

Saved-search alerts and public collections were removed from the runtime on
2026-08-06. Their D1 tables remain preserved so the retirement is reversible
without deleting user data.

## Engagement measurement

Instrumentation lives in `lib/engagement.ts` (surface funnels) and
`lib/analytics.ts` (fixed 4-event fleet taxonomy). Events route through
`posthog-js` (lazy-loaded, fail-silent) and carry `project_id: "anime_list"`.

- **Quiz funnel:** `quiz_viewed` → `quiz_started` → `quiz_completed`
  (archetype id only, never answers) → `quiz_result_shown` →
  `quiz_result_clicked`.
- **Homepage A/B test:** 50/50 cookie split (`ab_home`, 14-day expiry) via
  `homeVariant()` in `lib/flags.ts`. `control` = quiz CTA in footer;
  `treatment` = quiz CTA in hero. Manual override `?ff_quiz_home=1|0`;
  build-time `VITE_HOME_QUIZ_ABOVE_FOLD=true` forces treatment for all
  (use for full rollout, not the test).
- **Fleet taxonomy:** `signup` → `activated` → `core_action` → `returned`.
- **Decision rule:** after a 2-week window, compare variants on
  `homepage_variant_seen` → `home_surface_click` → `quiz_started` →
  `quiz_completed` → `quiz_result_clicked` → `signup`. Keep the winner; if no
  meaningful lift, keep control (less surface area).

See [`../architecture/decisions/0004-engagement-measurement.md`](../architecture/decisions/0004-engagement-measurement.md)
for the reasoning behind this instrumentation.

## Database tables (Cloudflare D1)

Deterministic migrations run before deployment. Tables: `users`, `user_tags`,
`anime_watchlist`, `manga_watchlist`, `anime_dismissals`, `anime_schedule`,
`anime_data`, `manga_data`, `anime_relations_cache`,
`anime_recommendations_cache`, `saved_searches`, `saved_search_alerts`,
`collections`, `collection_items`, `user_api_tokens`.

## Tests & ops

- Vitest (unit): import/export, filters, recommendations, schedule, SEO
  rewrite, detail cache.
- Playwright (e2e): anime detail load (unique title + app mounts + noindex on
  unknown id), mobile touch targets, no horizontal scroll.
- PostHog analytics; global `app.onError()` error handler on the worker.
