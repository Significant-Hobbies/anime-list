# Project Status

Last updated: 2026-06-04

## Current Scope

Shelf (MAL Explorer) is a production anime/manga discovery app: multi-field search with shareable URLs, personal watchlists (Google OAuth), stats, schedule, and a signed-in seasonal discover queue backed by Turso + Cloudflare Worker `mal-api`.

## Done

- Anime + manga catalogs (~14.8k anime, ~25k manga) with quality gates and daily/quarterly sync
- Advanced filter search (`/search`) with URL-encoded state
- Watchlist with statuses, tags, taste recommendations (`buildTasteRecommendations`)
- Discover queue (`/discover`) with watchlist-weighted seasonal scoring
- Privacy-safe `/quiz` prototype that maps structured answers to Shelf archetypes and existing search URLs
- Deployed on Cloudflare Pages + Worker; Jest + Playwright test coverage

## Planned Next

1. Operational stability (Pages 500 regressions, MAL CDN image policy) per fleet memory
2. Measure `/quiz` completion-to-search clickthrough before adding persistence, OG images, or share analytics

## Deferred / Parked

- **Character identity quiz expansion** — The smallest proof now exists at `/quiz`. Do not add social scraping, OAuth imports, stored quiz results, OG image generation, or a separate recommendation API unless completion-to-search clickthrough proves lift. Full brief: [`docs/plans/2026-06-04-character-identity-quiz-brief.md`](docs/plans/2026-06-04-character-identity-quiz-brief.md).
