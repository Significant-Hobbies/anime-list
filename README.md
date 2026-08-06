# Anime List by Significant Hobbies

A modern anime discovery platform that helps you find your next favorite show.

**Live Demo**: [anime.significanthobbies.com](https://anime.significanthobbies.com)

## Deployment & External Services

| Concern | Service |
|---------|---------|
| Hosting | Cloudflare Pages (`anime-list`, `anime.significanthobbies.com`) - Vite SPA static build |
| API | Cloudflare Worker (`mal-api`) — Hono, daily cron at 03:00 UTC |
| Database | Cloudflare D1 (`DB` binding) |
| Auth | Google OAuth 2.0 + JWT |
| Analytics | PostHog (`local posthog-js wrapper`) |
| CI/CD | GitHub Actions — CI (D1 migration/rehearsal + lint/test/build/size); manual Worker/Pages deploy; daily Wrangler D1 sync |

> Migration state: this branch prepares D1 and fails closed before deployment.
> Live production remains Turso-authoritative until the cutover receipt is
> explicitly approved, imported, verified, and deployed.

> Local and production API traffic is served by the `mal-api` Cloudflare Worker on port **8787** during `pnpm dev`.

## The Problem

Finding quality anime to watch is hard. MyAnimeList has thousands of titles, but the platform lacks advanced filtering, intelligent ranking, and personal tracking across multiple dimensions. Most discovery tools either overwhelm with options or oversimplify with basic genre filters.

## Features

- **Advanced Filtering**: Multi-dimensional search across score, year, genres, themes, demographics with powerful operators (includes all/any, excludes, numeric comparisons)
- **Smart Ranking**: Custom algorithm balancing quality (MAL score) and popularity (members + favorites) using logarithmic scaling to give hidden gems a chance
- **Personal Watchlists**: Track anime by status (Watching, Completed, Deferred, Avoiding, BRR) with Google authentication
- **Rich Statistics**: Explore trends, score distributions, and popular genre combinations across 14,800+ titles with watchlist filtering
- **Lightning Fast**: Edge-local D1 persistence behind a one-hour stale-while-revalidate catalog cache
- **Auto-Updates**: GitHub Actions automatically fetches latest anime seasons daily at midnight UTC

## Architecture

```mermaid
graph TB
    subgraph "Client Layer - Cloudflare Pages"
        UI[Vite SPA Frontend<br/>React 19 + TailwindCSS]
        Components[UI Components<br/>FilterBuilder, AnimeCard, Stats]
        Cache[TanStack Query<br/>Client-side Cache]
    end

    subgraph "API Layer - Cloudflare Worker"
        Worker[Hono Worker (mal-api)<br/>TypeScript]
        Routes[API Routes<br/>/search /stats /watchlist]
        Memory[In-Memory Cache<br/>14.8k Anime<br/>Stale-While-Revalidate]
    end

    subgraph "Database - Cloudflare D1"
        AnimeDB[(Anime Data<br/>14,800+ titles)]
        WatchlistDB[(User Watchlists<br/>Per-user tracking)]
    end

    subgraph "External Services"
        Jikan[Jikan API<br/>MyAnimeList Data]
        Google[Google OAuth<br/>Authentication]
    end

    subgraph "Automation - GitHub Actions"
        Cron[Daily Cron Job<br/>Midnight UTC]
        Update[Update Script<br/>Fetch Latest Seasons]
    end

    UI --> Components
    Components --> Cache
    Cache --> Worker
    Worker --> Routes
    Routes --> Memory
    Memory -.1hr cache.-> AnimeDB
    Routes --> WatchlistDB
    Routes --> Google
    Cron --> Update
    Update --> Jikan
    Jikan --> Update
    Update --> AnimeDB

    style UI fill:#3b82f6
    style Worker fill:#10b981
    style AnimeDB fill:#8b5cf6
    style Jikan fill:#f59e0b
    style Memory fill:#ef4444
    style Cron fill:#06b6d4
```

### Key Components

- **Frontend (Cloudflare Pages)**: Vite SPA + TanStack Router, React 19, TailwindCSS 4 + shadcn/ui components
- **Backend (Cloudflare Worker `mal-api`)**: Hono API with stale-while-revalidate in-memory cache for <1ms response times
- **Database (Cloudflare D1)**: one project-owned database for anime/manga catalogs and user state
- **Caching Strategy**: 1-hour TTL with background refresh - 100% of requests served instantly from memory
- **Automation (GitHub Actions)**: Daily cron at midnight UTC fetches latest anime seasons from Jikan API
- **External APIs**: Jikan API for MyAnimeList data, Google OAuth for authentication

## Quick Start

### Prerequisites
- Node.js 18+
- Wrangler 4.x (installed through the pinned project dependencies)
- Google OAuth credentials

### Setup

1. Clone and install:
```bash
git clone <repository-url>
cd mal
pnpm install
```

2. Create `.env` from `.env.example` for frontend/Google OAuth values. Local persistence uses isolated Wrangler D1 and does not need production database credentials.

3. Start development:
```bash
pnpm dev
```

This runs the Cloudflare Worker API (port 8787) and Vite dev server (port 5173) together.

4. Open http://localhost:5173

### Available Commands

```bash
pnpm dev           # Worker + frontend
pnpm dev:be        # Worker only (port 8787)
pnpm dev:fe        # Frontend only
pnpm build         # Vite production build
pnpm test          # Vitest unit tests
pnpm db:seed       # Migrate and seed local D1 from JSON
pnpm db:update     # Update anime data from Jikan API
pnpm db:rehearse   # Isolated D1 catalog + ownership rehearsal
```

## Deployment

**Frontend (Cloudflare Pages — project `anime-list`)**
- Manual deploy only: run `pnpm deploy` locally (clean-`main` guard + build +
  `wrangler pages deploy`), or trigger the `workflow_dispatch` deploy workflow
  (`.github/workflows/deploy.yml`). There is no auto-deploy on push.
- `VITE_*` client vars are inlined at build time (`import.meta.env`) and set
  explicitly by the deploy workflow. `wrangler.toml` `[vars]` only apply at
  runtime to the worker, not to the client bundle.

**API Worker (Cloudflare Worker — `mal-api`)**
- Deploy with `pnpm deploy:worker`; it validates a clean `main`, applies D1 migrations, and tags the Worker with the full Git SHA.
- D1 is bound as `DB`; Worker secrets remain `JWT_SECRET` and `GOOGLE_CLIENT_ID`.
- Runs a daily cron at 03:00 UTC

**Database (Cloudflare D1)**
- Apply local migrations: `pnpm db:migrate:local`
- Run the isolated proof: `pnpm db:rehearse`
- Production creation, import, binding UUID, and deployment remain explicitly approved cutover operations.

**GitHub Actions (Automated)**
- Repository automation uses the existing `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` boundaries.
- Workflow runs automatically daily at midnight UTC
- Manual trigger: Go to Actions tab → "Update Catalog Data" → Run workflow

---

**Note**: This project uses MyAnimeList data via the Jikan API. Not affiliated with MyAnimeList.net.

**For Developers**: See [AGENTS.md](AGENTS.md) for agent operating rules, [STATUS.md](STATUS.md) for the current objective and active work, and [docs/index.md](docs/index.md) for the full knowledge base (architecture, decisions, operations runbooks, and learnings).

## License

ISC - Sarthak Agrawal

<!-- ACTIVE-AI-TASK-LOG:START -->
## Active AI Task Log

This section is maintained by the SaaS Maker Active-AI product/design loop so future agents do not reopen duplicate UI tasks.

- Business lane: P2 Watch / maintenance
- Rule: do not create another broad "improve the UI" task unless the acceptance criteria differ materially from the tasks listed here.
- Source of truth for task status: SaaS Maker task board. README entries are durable context only.

| Task | Status | Priority | Last known note |
| --- | --- | --- | --- |
| `5fc1a3af` anime_list: replace indefinite shelf skeleton with real cards or clear loading state | done | low | 2026-05-25 18:57:08 |
| `049bfd61` [fleet-smoke] anime_list/web analytics endpoint 404 | done | medium | 2026-05-25 17:25:17 |
| `e775b1b8` anime_list: add filter result explanation chips | done | low | 2026-05-26 |
| `36332e19` [active-ai-priority] anime_list: Make discovery list-aware | done | medium | 2026-06-13 (shipped via /discover + queue) |
| `a935677b` [active-ai-product] anime_list: Build a list-aware seasonal discovery queue | done | medium | 2026-06-13 |
| `0c5ec1b7` [active-ai-ship] anime_list: Review and ship first-screen discovery fix | done | high | 2026-06-13 |
| `a880f2b4` anime_list: add shareable anime-character identity quiz brief | done | low | 2026-06-13 (brief + /quiz proof; deferred expansion) |
| `3f9e43c7` [active-ai-ui] anime_list: Polish anime detail and list-management flow | done | medium | 2026-06-13 (incremental via recent auth/list fixes) |
| `f600afd0` Full fleet audit: anime_list | done | high | 2026-06-13 (context captured; residual config risks addressed below) |
<!-- ACTIVE-AI-TASK-LOG:END -->
