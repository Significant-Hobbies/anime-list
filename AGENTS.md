# agents.md — anime_list (Shelf)

## Shared Fleet Standard

Also read and follow the shared fleet-level agent standard at `../AGENTS.md`. Treat this repository as owned product code: protect production stability, keep changes scoped, verify work, and record durable follow-up tasks when something remains incomplete or blocked.

## Purpose
Anime/manga discovery platform with multi-field filtering, personal watchlists, schedule tracking, and daily auto-sync from MyAnimeList via Jikan API.

## Stack
- Framework: Vite SPA + TanStack Router (React 19) + Cloudflare Worker API (Hono)
- Language: TypeScript (full stack)
- Styling: Tailwind CSS v4 + shadcn/ui
- DB: Turso (libSQL) — anime + manga catalogs, users, watchlists (single DB in prod; optional `TURSO_MANGA_*` override)
- Auth: Google OAuth 2.0 + JWT (`jose`)
- Testing: Vitest (unit), Playwright (e2e)
- Deploy: Cloudflare Pages (`anime.significanthobbies.com`, Vite static build) + Worker `mal-api` (`wrangler deploy`)
- Package manager: pnpm

## Repo structure
```
src/                     # Vite SPA routes (TanStack Router file-based)
components/              # FilterBuilder, MangaFilterBuilder, cards, charts
  discover/              # Shared discover filter UI
  ui/                    # shadcn/ui primitives
lib/                     # auth, api client, types, brand
src/
  worker.ts              # Cloudflare Worker API + daily cron @ 3 AM UTC
  worker/mangaRoutes.ts  # Manga API routes
  config.ts              # Enums, Jikan config, distribution ranges
  filterEngine.ts        # Pure filter logic
  dataProcessor.ts       # Jikan transforms, manga/anime helpers
  statistics.ts          # Aggregation/analytics
  db/                    # Turso: anime_data, manga_data, watchlists, users
  store/                 # In-memory cache (stale-while-revalidate)
  services/              # schedule, anilistStatusSync
  scripts/               # db seed/update/quarterly scripts
cleaned_anime_data.json  # Bootstrap seed for anime
cleaned_manga_data.json  # Bootstrap seed for manga
```

## Key commands
```bash
pnpm dev                  # Worker (:8787) + Vite (:5173)
pnpm dev:be               # Worker only
pnpm dev:fe               # Frontend only
pnpm build                # Vite production build
pnpm test                 # Vitest unit tests
pnpm test:e2e:anime-detail
pnpm db:seed              # Seed anime catalog from JSON
pnpm db:seed:manga        # Seed manga catalog from JSON
pnpm db:update            # Daily anime refresh (current + previous season)
pnpm db:update:manga      # Daily manga refresh (top ~100 pages)
pnpm db:update:manga:full # Full top-list manga refresh (~25k titles)
pnpm db:quarterly-sync    # Quarterly anime status/score sync
pnpm deploy               # Cloudflare Pages
pnpm deploy:worker        # Cloudflare Worker
```

## Architecture notes
- **Backend**: Worker `mal-api` serves all API traffic; cron reloads anime + manga caches from Turso daily.
- **Catalog quality gate** (anime + manga): Jikan rows must have `score`, `scored_by`, `members`, `favorites`, and `year`. Discover UI defaults to min popularity (100k anime / 50k manga members).
- **Manga scope**: ~25k top/popular titles from Jikan `/top/manga`, not the full MAL catalog.
- **Daily sync**: `update-anime-data.yml` — anime seasons + manga top pages @ midnight UTC.
- **Quarterly sync**: `quarterly-anime-sync.yml` (anime), `quarterly-manga-sync.yml` (manga full top-list).
- **Watch statuses**: `Watching`, `Completed`, `Deferred`, `Avoiding`, `BRR`.
- **Worker secrets**: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `JWT_SECRET`, `GOOGLE_CLIENT_ID` (optional `TURSO_MANGA_*`).

<!-- FLEET-GUIDANCE:START -->

## Fleet Guidance

### Adding Tasks
- Add durable work items in SaaS Maker Cockpit Tasks when the task affects product behavior, deployment, user feedback, or fleet maintenance.
- Include the project slug, a concise title, acceptance criteria, priority/status, and links to relevant code, issues, traces, or dashboards.
- If task discovery starts locally in an editor or agent session, mirror the durable next step back into SaaS Maker before handoff.

### Using SaaS Maker
- Treat SaaS Maker as the system of record for project metadata, feedback, tasks, analytics, testimonials, changelog, and fleet visibility.
- Prefer API-first workflows through `fnd api`, the SDK, or widgets instead of one-off scripts when interacting with SaaS Maker features.
- Keep this agent file aligned with the project record when operating rules, integrations, or deployment conventions change.

### Free AI First
- Prefer free/local AI paths for routine development and analysis: the `free-ai` gateway, local models, provider free tiers, and cached context.
- Escalate to paid models only when complexity, correctness risk, or missing capability justifies the cost.
- Note any paid-AI use in the task or handoff when it materially affects cost, reproducibility, or future maintenance.

<!-- FLEET-GUIDANCE:END -->

## Active context


<claude-mem-context>
# Memory Context

# [anime_list] recent context, 2026-05-03 9:35am GMT+5:30

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 4 obs (1,681t read) | 54,515t work | 97% savings

### May 2, 2026
715 7:51p 🔵 anime-list CF Pages returning HTTP 500 "Internal Server Error"
716 10:03p 🔵 anime-list-9lk.pages.dev Production 500 — Latest Deploy Broken, Previous Works
717 10:05p 🔵 swe-interview-prep Has 120 ESLint Warnings — All Non-Blocking
721 10:11p 🔵 anime-list-9lk.pages.dev — MyAnimeList CDN images return 403

Access 55k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
