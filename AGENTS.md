# agents.md — anime_list (MAL Explorer)

## Shared Fleet Standard

Also read and follow the shared fleet-level agent standard at `../AGENTS.md`. Treat this repository as owned product code: protect production stability, keep changes scoped, verify work, and record durable follow-up tasks when something remains incomplete or blocked.

## Purpose
Anime/manga discovery platform with 14,800+ titles, multi-field filtering, personal watchlists, schedule tracking, and daily auto-sync from MyAnimeList via Jikan API.

## Stack
- Framework: Next.js 16 (App Router) + Cloudflare Worker API (Hono)
- Language: TypeScript (full stack)
- Styling: Tailwind CSS v4 + shadcn/ui
- DB: Turso (libSQL) — anime data + user watchlists; Cloudflare Worker with daily cron
- Auth: Google OAuth 2.0 + JWT (`jose`)
- Testing: Jest (unit), Playwright (e2e)
- Deploy: Cloudflare Pages (`anime-list-9lk.pages.dev`) via `@opennextjs/cloudflare` + Worker `mal-api` (`wrangler deploy`)
- Package manager: pnpm

## Repo structure
```
app/                     # Next.js App Router pages
components/              # React components (AnimeCard, FilterBuilder, StatsCharts, WatchlistView)
  ui/                    # shadcn/ui primitives
lib/                     # Frontend utils (auth.tsx, api.ts, types.ts)
src/
  worker.ts              # Cloudflare Worker API (Hono, daily cron @ 3 AM UTC)
  config.ts              # Enums: AnimeField, FilterAction, Genre, WatchStatus
  filterEngine.ts        # Pure filter logic
  dataProcessor.ts       # Data transforms + manga helpers (future manga API)
  statistics.ts          # Aggregation/analytics
  controllers/           # Shared handlers (animeDetailService, helpers)
  db/                    # Turso client, watchlist CRUD, users, migrations
  store/                 # In-memory cache (stale-while-revalidate, <1ms)
  services/              # schedule, manga (future), anilistStatusSync, dataLoader
  types/                 # anime.ts, manga.ts, watchlist.ts
  validators/            # Zod schemas for all API inputs
scripts/                 # seed-watchlist.ts, restore-legacy-tags.ts
cleaned_anime_data.json  # Seed/bootstrap dataset for db:seed
cleaned_manga_data.json  # Manga dataset (future manga API)
```

## Key commands
```bash
pnpm dev              # Worker (8787) + Next.js (3000) via concurrently
pnpm dev:be           # Worker only (wrangler dev)
pnpm dev:fe           # Frontend only (Next.js port 3000)
pnpm build            # Next.js production build
pnpm test             # Jest unit tests
pnpm test:e2e:anime-detail  # Playwright e2e
pnpm db:seed          # Seed Turso from JSON data
pnpm db:update        # Update anime data from Jikan API
pnpm db:quarterly-sync  # Full quarterly data sync
pnpm deploy:worker    # Deploy Cloudflare Worker
```

## Architecture notes
- **Backend**: Cloudflare Worker `mal-api` (Hono, edge) serves all API traffic locally and in production; runs daily cron @ 3 AM UTC for cache refresh.
- **In-memory cache**: 14,800+ anime loaded on startup into in-memory store with stale-while-revalidate. All searches <1ms.
- **Scoring algorithm**: log-scale prevents mega-popular titles from dominating — `log10(score)*10 + log10(members/10000) + log10(favorites/100)`.
- **Daily auto-update**: GitHub Actions `update-anime-data.yml` hits Jikan API daily at midnight UTC. `quarterly-anime-sync.yml` for full refresh.
- **Watch statuses**: `Watching`, `Completed`, `Deferred`, `Avoiding`, `BRR`.
- **Rate limit**: Cloudflare edge (Worker has no Express rate-limit middleware).
- **Worker secrets** via `wrangler secret put`: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`.
- Husky pre-push hook configured.

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