# anime_list — PROJECT STATUS
Last updated: 2026-07-11

## Why / What

**Shelf (MAL Explorer)** is a production anime/manga discovery app with multi-field search, shareable URLs, personal watchlists (Google OAuth), stats, schedule, and a signed-in seasonal discover queue.

**Users:** Anime/manga fans filtering 40k+ catalog titles; signed-in users tracking watchlists and discovering seasonal picks.

**Constraints:** Operational stability over feature expansion. Measure engagement on newer surfaces (quiz, collections) before expanding them.

**IN scope:** Vite SPA frontend, `mal-api` Hono worker, Turso, daily/quarterly catalog sync, in-app alerts.

**OUT of scope:** Email digest for saved searches, collection social features, character quiz persistence/OG images until engagement proves lift.

## Dependencies

### External

- **Google OAuth + JWT:** `jose`; httpOnly `mal_auth_token` cookie (7d).
- **Turso libSQL:** catalog tables + per-user watchlists, schedule, saved searches, collections.
- **Jikan API:** daily GH Action sync + quarterly full refresh.
- **MAL CDN:** poster images (recurring operational risk).
- **PostHog:** client analytics.
- **Cloudflare:** Pages (SPA), Workers (`mal-api`), edge caches (search 180s, stats 300s, detail 24h anonymous only).
- **Worker secrets (names only):** `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, optional `TURSO_MANGA_*`, `POSTHOG_API_KEY`.
- **Env:** `.env` from `.env.example` — `GOOGLE_CLIENT_ID`, `JWT_SECRET`, `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`, `TURSO_*`, `VITE_SAASMAKER_API_KEY`, optional `VITE_HOME_QUIZ_ABOVE_FOLD` (forces treatment for all visitors in the homepage A/B test; the live 50/50 split uses the `ab_home` cookie — see "Engagement measurement").

### Internal (fleet)

- **SaaS Maker:** `VITE_SAASMAKER_API_KEY` for feedback widget integration.

### Stack & commands

**Stack:** Vite 8 SPA + TanStack Router + Tailwind v4 + TanStack Query + nuqs (frontend); Hono Cloudflare Worker `mal-api`; Turso libSQL; Google OAuth + JWT (`jose`); PostHog; Vitest + Playwright.

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
| `pnpm test` | Vitest (46 tests, 11 files) |
| `pnpm test:e2e` | Playwright (desktop + mobile) |
| `pnpm typecheck` / `pnpm lint` | TS + ESLint |
| `pnpm db:seed` / `db:seed:manga` | Seed Turso from scripts |
| `pnpm db:update` / `db:update:manga` | Refresh from Jikan |
| `pnpm db:quarterly-sync` | Quarterly anime re-score |

## Timeline

- **2026-07-17** — Crawlable detail pages: Pages Functions rewrite `/anime/:malId` and `/manga/:malId` HTML with unique title, meta, canonical, OG, JSON-LD (TVSeries/Movie/Book), and hidden SSR summary for 5,306 anime + 2,288 manga. Unknown IDs get noindex. Chunked sitemaps (`sitemap-index.xml` + `sitemap-anime-N.xml` + `sitemap-manga-N.xml`) generated at build time. Deploy pending (manual).
- **2026-07-11** — Search reliability pass shipped: debounced and abortable anime/manga requests, a bounded SQL fast path for simple numeric anime searches, production Google sign-in fallback configuration, and non-fatal quarterly Jikan fallback failures.
- **2026-07-03** — Shipped engagement telemetry for the quiz/collections/homepage funnels (`lib/engagement.ts`), the `VITE_HOME_QUIZ_ABOVE_FOLD` A/B switch (`lib/flags.ts`, default off), and a "Copy link" share button on `/collections`.
- **2026-07-04** — Upgraded the homepage A/B test from a build-time toggle to a live 50/50 cookie-based split (`ab_home`, 14-day expiry). Added `homepage_variant_seen` impression tracking, `quiz_result_shown`, `collection_created`, and `collection_viewed` events. See "Engagement measurement" below.
- **2026-07-02** — Added `app.onError()` global error handler to `mal-api` worker (catches unhandled Hono errors → 500 JSON + console.error logging).
- **2026-06-20** — De-OpenNext migration: rewritten from Next.js+OpenNext to Vite SPA + TanStack Router; `mal-api` worker unchanged; removed 17MB `cleaned_anime_data.json` from SPA.
- **2026-06-20** — Shipped PRD batch (2026-06-12): watchlist import/export, saved search alerts (in-app MVP), public collections.
- **2026-06-12** — PRD batch defined: watchlist import/export, saved search alerts, public collections.
- **Ongoing** — Daily GH Action Jikan sync (00:00 UTC); quarterly anime/manga full refresh; worker cron `0 3 * * *` cache reload + saved-search alert evaluation.

## Products

- **SPA (Pages):** https://anime.significanthobbies.com - project `anime-list`, branch `main`; PR previews remain on `pr-{N}.anime-list-9lk.pages.dev`.
- **API (Worker):** https://mal-api.sarthakagrawal927.workers.dev — Hono worker `mal-api`, cron `0 3 * * *`.
- **Local dev:** Vite :5173 + Worker :8787.

## Features (shipped)

### SEO: crawlable detail pages (2026-07-17, deploy pending)

- **Pages Functions** (`functions/anime/[malId].ts`, `functions/manga/[malId].ts`) intercept detail routes before the SPA catch-all.
- **HTML rewriting**: unique `<title>`, meta description, canonical, OG/Twitter tags, JSON-LD (`TVSeries`/`Movie` for anime, `Book` for manga), and a `<div hidden data-ssr>` summary with h1 + synopsis + facts table.
- **SEO dataset**: `scripts/build-seo-dataset.mjs` (prebuild) filters 14,841 anime → 5,306 (members ≥ 20k) and 20,656 manga → 2,288 (members ≥ 10k) into compact `src/data/seo-{anime,manga}.json`.
- **Sitemaps**: `scripts/build-sitemaps.mjs` (postbuild) emits chunked XML (`sitemap-index.xml` + `sitemap-anime-{1,2}.xml` + `sitemap-manga-1.xml`, ≤5000 urls per chunk).
- **Unknown IDs**: served with `<meta name="robots" content="noindex">`.
- **Pure rewrite function**: `src/seoRewrite.ts` with HTML escaping, `</script>` injection protection, 17 vitest tests.
- **e2e tests**: unique title assertion + app mounts + noindex on unknown id.

### Frontend routes (22 paths, TanStack Router `src/router.tsx`)

- `/` HomePage (marketing/FAQ), `/about`, `/privacy`, `/terms`, `/changelog`.
- `/search` — advanced anime filter search with URL-encoded state (nuqs).
- `/discover` — signed-in seasonal discovery queue.
- `/anime/$malId`, `/manga/$malId` — detail pages with relations/recommendations.
- `/genre/$genre`, `/random` — discovery pickers.
- `/schedule` — episode pacing schedule.
- `/watchlist` — anime watchlist + import/export.
- `/stats`, `/manga`, `/manga/stats`, `/manga/watchlist` — manga surfaces.
- `/alerts` — saved search alert management.
- `/collections`, `/c/$slug` — collection editor + public view.
- `/quiz` — character identity quiz prototype (no persistence).

### Worker API (`src/worker.ts` + `src/worker/mangaRoutes.ts`, 50+ endpoints)

- Auth: `POST /api/auth/google`, `POST /api/auth/logout`.
- Catalog: `POST /api/search`, `GET /api/stats`, `GET /api/anime/random`, `GET /api/anime/:malId`, `GET /api/fields`, `GET /api/filters`, `GET /api/last-updated`, `GET /api/changelog`.
- Watchlist: full CRUD, tags, taste recommendations (`buildTasteRecommendations`), enriched view, import preview/apply (MAL XML/CSV, AniList JSON, Shelf JSON), export (JSON/CSV/AniList).
- Schedule: timeline, add/update/remove/reorder.
- Discover: `GET /api/discover/queue` (taste-weighted seasonal + manga interleave 1:5), `POST /api/discover/dismiss`.
- Saved searches: CRUD + alerts list/seen; cron creates alerts after catalog refresh.
- Collections: CRUD + public `GET /api/collections/:slug`.
- Manga: parallel search/stats/random/watchlist/detail routes under `/api/manga/*`.

### Architecture

- Vite SPA calls `mal-api` worker; TanStack Query caches responses client-side.
- Worker loads full anime (~14.8k) + manga (~25k) catalogs into in-memory stores with 1hr stale-while-revalidate.
- Turso stores catalog tables + per-user watchlists, schedule, saved searches, collections.
- Google OAuth → JWT in httpOnly `mal_auth_token` cookie (7d).
- Worker cron `0 3 * * *` reloads caches + evaluates saved-search alerts after catalog refresh.
- GitHub Actions: daily Jikan sync (00:00 UTC), quarterly anime/manga full refresh, auto Pages deploy on `main`.
- Edge caches: search 180s, stats 300s, detail 24h (anonymous only).
- CORS allowlist for Pages, worker, localhost, PR previews.
- Deploy branch guard on `pnpm deploy` (clean `main` only).

### Catalog & search

- ~14.8k anime + ~25k manga with quality gates (score, scored_by, members, favorites, year).
- Advanced multi-field filters with active filter explanation chips (`ActiveFilterChip`).
- Smart ranking: log-scale popularity + MAL score balance.
- Sub-ms worker responses via in-memory cache; removed 17MB `cleaned_anime_data.json` from SPA (2026-06-20).
- Daily GH Action Jikan sync + quarterly full manga refresh + worker cron 03:00 UTC cache reload.

### Personal & discovery

- Watchlist statuses: Watching, Completed, Deferred, Avoiding, BRR + custom tags.
- Discover queue: current/previous season scoring, taste-weighted genres/themes, quick add/dismiss/skip, signed-in gating.
- Quiz: 4 questions → 4 Shelf archetypes → prefilled search URLs; privacy-safe, no persistence.
- First-screen polish: live counts, skeletons, poster grids.

### Shipped PRD batch (2026-06-12, implemented 2026-06-20)

- Watchlist import/export with conflict preview; merge/replace/skip modes on `/watchlist`.
- Saved search alerts (in-app MVP): `saved_searches` + `saved_search_alerts` tables; save from `/search`, manage `/alerts`, nav badge.
- Public collections: create/publish at `/collections`; public pages at `/c/:slug`.

### Database tables (Turso, inline migrations at worker startup)

- `users`, `user_tags`, `anime_watchlist`, `manga_watchlist`, `anime_dismissals`, `anime_schedule`, `anime_data`, `manga_data`, `anime_relations_cache`, `anime_recommendations_cache`, `saved_searches`, `saved_search_alerts`, `collections`, `collection_items`.

### Tests & ops

- Vitest: 51 tests (import/export, filters, recommendations, schedule, detail cache).
- Playwright: anime detail load, mobile touch targets, no horizontal scroll.
- PostHog analytics.

### Engagement measurement

Instrumentation lives in `lib/engagement.ts` (surface funnels) and `lib/analytics.ts` (fixed 4-event fleet taxonomy). All events route through `posthog-js` (lazy-loaded, fail-silent) and carry `project_id: "anime_list"`.

**Quiz funnel** (`/quiz`):
- `quiz_viewed` → `quiz_started` (first answer) → `quiz_completed` (all answered, archetype id only) → `quiz_result_shown` (result card displayed) → `quiz_result_clicked` (clickthrough to search or exemplar detail).
- Privacy: only the derived archetype id is sent — never individual answers.

**Collections funnel** (`/collections`, `/c/$slug`):
- `collections_viewed` (list page, signed-in flag) → `collection_created` (new collection published, slug + item count) → `collection_share_clicked` (copy link) → `collection_viewed` / `collection_public_viewed` (public page load, `via_share` flag for `?ref=share` visits).

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

## Todo / Planned / Deferred / Blocked

### Planned

1. Operational stability — Pages 500 regressions, MAL CDN image policy.
2. **2-week A/B test in progress** — homepage control vs treatment (quiz CTA above fold). Decide winner after 2026-07-18; keep only the winner.
3. Measure `/quiz` completion-to-search clickthrough before persistence, OG images, or share analytics.
4. Measure collection share clickthrough before discovery ranking or social features.
5. Add e2e for discover, watchlist import, collections, alerts (`e2e/`).
6. **Deploy crawlable detail pages** — `pnpm deploy` (manual, per fleet policy). Post-deploy: curl two detail pages + one sitemap chunk; run `agent-index-audit.mjs --project anime-list`.
7. **GSC sitemap submission** — submit `sitemap-index.xml` to Google Search Console once the zone AI-block/GSC onboarding fleet actions land.

### Deferred

- **Character identity quiz expansion** — `/quiz` proof shipped; expansion (share URLs, persistence, OG) deferred pending engagement data.
- **Saved search email digest** — in-app MVP shipped; email deferred until engagement proves lift.
- **Collection social features** — comments, likes, follower feeds deferred.

### Blocked

- MAL CDN image policy and intermittent Pages 500s are recurring operational risks.
- No e2e for discover, watchlist import, collections, alerts, auth flows, manga routes.
