# Project Status

Last updated: 2026-06-04

## Current Scope

Shelf (MAL Explorer) is a production anime/manga discovery app: multi-field search with shareable URLs, personal watchlists (Google OAuth), stats, schedule, and a signed-in seasonal discover queue backed by Turso + Cloudflare Worker `mal-api`.

## Done

- Anime + manga catalogs (~14.8k anime, ~25k manga) with quality gates and daily/quarterly sync
- Advanced filter search (`/search`) with URL-encoded state
- Watchlist with statuses, tags, taste recommendations (`buildTasteRecommendations`)
- Discover queue (`/discover`) with watchlist-weighted seasonal scoring
- Deployed on Cloudflare Pages + Worker; Jest + Playwright test coverage

## Planned Next

1. Operational stability (Pages 500 regressions, MAL CDN image policy) per fleet memory
2. No active feature build for character identity quiz until cold-start metrics justify it

## Deferred

- **Character identity quiz** — Evaluated 2026-06-04; deferred as low incremental lift vs existing search + watchlist taste + discover queue. Full brief: [`docs/plans/2026-06-04-character-identity-quiz-brief.md`](docs/plans/2026-06-04-character-identity-quiz-brief.md). Revisit if unsigned bounce on `/search` or explicit user demand; smallest proof is a static 7-question prototype linking to pre-built search URLs only.
