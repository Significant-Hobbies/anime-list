# MAL Explorer

![AI Generated](https://ai-percentage-pin.vercel.app/api/ai-percentage?value=60)
![AI PRs Welcome](https://ai-percentage-pin.vercel.app/api/ai-prs?welcome=yes)

A modern anime discovery platform that helps you find your next favorite show.

**Live Demo**: [anime-list-9lk.pages.dev](https://anime-list-9lk.pages.dev)

## Deployment & External Services

| Concern | Service |
|---------|---------|
| Hosting | Cloudflare Pages (`anime-list`, anime-list-9lk.pages.dev) via `@opennextjs/cloudflare` |
| API | Cloudflare Worker (`mal-api`) — Hono, daily cron at 03:00 UTC |
| Database | Turso (libSQL) |
| Auth | Google OAuth 2.0 + JWT |
| Analytics | PostHog (`@saas-maker/posthog-client`) |
| CI/CD | GitHub Actions — auto-deploy to Cloudflare Pages on push to `main`; daily Turso sync workflow |

> Local and production API traffic is served by the `mal-api` Cloudflare Worker on port **8787** during `pnpm dev`.

## The Problem

Finding quality anime to watch is hard. MyAnimeList has thousands of titles, but the platform lacks advanced filtering, intelligent ranking, and personal tracking across multiple dimensions. Most discovery tools either overwhelm with options or oversimplify with basic genre filters.

## Features

- **Advanced Filtering**: Multi-dimensional search across score, year, genres, themes, demographics with powerful operators (includes all/any, excludes, numeric comparisons)
- **Smart Ranking**: Custom algorithm balancing quality (MAL score) and popularity (members + favorites) using logarithmic scaling to give hidden gems a chance
- **Personal Watchlists**: Track anime by status (Watching, Completed, Deferred, Avoiding, BRR) with Google authentication
- **Rich Statistics**: Explore trends, score distributions, and popular genre combinations across 14,800+ titles with watchlist filtering
- **Lightning Fast**: Sub-millisecond response times with stale-while-revalidate caching and Turso database
- **Auto-Updates**: GitHub Actions automatically fetches latest anime seasons daily at midnight UTC

## Architecture

```mermaid
graph TB
    subgraph "Client Layer - Cloudflare Pages"
        UI[Next.js Frontend<br/>React 19 + TailwindCSS]
        Components[UI Components<br/>FilterBuilder, AnimeCard, Stats]
        Cache[TanStack Query<br/>Client-side Cache]
    end

    subgraph "API Layer - Cloudflare Worker"
        Worker[Hono Worker (mal-api)<br/>TypeScript]
        Routes[API Routes<br/>/search /stats /watchlist]
        Memory[In-Memory Cache<br/>14.8k Anime<br/>Stale-While-Revalidate]
    end

    subgraph "Database - Turso"
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

- **Frontend (Cloudflare Pages)**: Next.js 16 with App Router, TailwindCSS 4 + shadcn/ui components
- **Backend (Cloudflare Worker `mal-api`)**: Hono API with stale-while-revalidate in-memory cache for <1ms response times
- **Database (Turso)**: libSQL database storing anime data (14,800+ titles) and user watchlists
- **Caching Strategy**: 1-hour TTL with background refresh - 100% of requests served instantly from memory
- **Automation (GitHub Actions)**: Daily cron at midnight UTC fetches latest anime seasons from Jikan API
- **External APIs**: Jikan API for MyAnimeList data, Google OAuth for authentication

## Quick Start

### Prerequisites
- Node.js 18+
- Turso account (free tier)
- Google OAuth credentials

### Setup

1. Clone and install:
```bash
git clone <repository-url>
cd mal
npm install
```

2. Create `.env` from `.env.example` and set Turso + Google OAuth values. For local dev, `NEXT_PUBLIC_API_URL=http://localhost:8787`.

3. Start development:
```bash
pnpm dev
```

This runs the Cloudflare Worker API (port 8787) and Next.js (port 3000) together.

4. Open http://localhost:3000

### Available Commands

```bash
pnpm dev           # Worker + frontend
pnpm dev:be        # Worker only (port 8787)
pnpm dev:fe        # Frontend only
pnpm build         # Build frontend for production
pnpm test          # Unit tests
pnpm db:seed       # Seed Turso database from JSON (one-time)
pnpm db:update     # Update anime data from Jikan API
```

## Deployment

**Frontend (Cloudflare Pages — project `anime-list`)**
- Auto-deploys on push to main via GitHub Actions (`.github/workflows/deploy.yml`)
- `NEXT_PUBLIC_*` build vars are set in the workflow; runtime vars live in `wrangler.toml`

**API Worker (Cloudflare Worker — `mal-api`)**
- Deploy with `pnpm deploy:worker` (`wrangler deploy --config wrangler.cron.toml`)
- Set worker secrets via `wrangler secret put`: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`
- Runs a daily cron at 03:00 UTC

**Database (Turso)**
- Create database: `turso db create mal-watchlist`
- Get credentials: `turso db show mal-watchlist`
- Run migrations and seed: `npm run db:seed`

**GitHub Actions (Automated)**
- Add repository secrets: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
- Workflow runs automatically daily at midnight UTC
- Manual trigger: Go to Actions tab → "Update Anime Data" → Run workflow

---

**Note**: This project uses MyAnimeList data via the Jikan API. Not affiliated with MyAnimeList.net.

**For Developers**: See [AGENTS.md](AGENTS.md) for comprehensive technical documentation.

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
<!-- ACTIVE-AI-TASK-LOG:END -->
