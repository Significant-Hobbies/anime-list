# Project Status

Last updated: 2026-06-20 (perf pass)

## Current Scope

Shelf (MAL Explorer) is a production anime/manga discovery app: multi-field search with shareable URLs, personal watchlists (Google OAuth), stats, schedule, and a signed-in seasonal discover queue backed by Turso + Cloudflare Worker `mal-api`.

## Done

- Anime + manga catalogs (~14.8k anime, ~25k manga) with quality gates and daily/quarterly sync
- Advanced filter search (`/search`) with URL-encoded state
- Watchlist with statuses, tags, taste recommendations (`buildTasteRecommendations`)
- Discover queue (`/discover`) with watchlist-weighted seasonal scoring
- Privacy-safe `/quiz` prototype that maps structured answers to Shelf archetypes and existing search URLs
- Deployed on Cloudflare Pages + Worker; Vitest + Playwright test coverage
- **De-OpenNext migration (2026-06-20):** web app rewritten from Next.js+OpenNext to Vite SPA + TanStack Router; `mal-api` worker unchanged
- **Client bundle perf (2026-06-20):** removed 17MB `cleaned_anime_data.json` from SPA; route splitting + deferred PostHog. Desktop LCP p75 ~570ms (was ~3.9s)

## Planned Next

1. Operational stability (Pages 500 regressions, MAL CDN image policy) per fleet memory
2. Measure `/quiz` completion-to-search clickthrough before adding persistence, OG images, or share analytics (see `/quiz` prototype + brief)

## Done (since 2026-05)

- Discovery queue list-aware (current/prev season + watchlist taste + quick add/dismiss/skip for anime + manga) — see `/discover`, `DiscoveryQueue`, worker `/api/discover/*`.
- First-screen search polish (new discovery header UI, live counts, real poster grids, skeletons) shipped.
- Active filter explanation chips with remove actions in anime + manga search (ActiveFilterChip + formatFilterChip).
- Privacy-safe minimal character archetype quiz prototype at `/quiz` (maps to shareable search URLs; expansion deferred per brief).
- Multiple stability/auth/discover fixes (sign-in, schedule invalidation, random route, worker cache, etc.).

## Deferred / Parked

- **Character identity quiz expansion** — The smallest proof now exists at `/quiz`. Do not add social scraping, OAuth imports, stored quiz results, OG image generation, or a separate recommendation API unless completion-to-search clickthrough proves lift. Full brief: [`docs/plans/2026-06-04-character-identity-quiz-brief.md`](docs/plans/2026-06-04-character-identity-quiz-brief.md).

May 2026 Symphony PRD/task IDs addressed by the above (source of truth remains SaaS Maker board):
- 36332e19, a935677b (list-aware discovery queue)
- 0c5ec1b7 (first-screen discovery fix ship)
- e775b1b8 (filter result explanation chips)
- a880f2b4 (quiz brief + minimal proof)
- 3f9e43c7 (detail + list-mgmt polish — incremental via auth/list fixes)
- f600afd0 (full fleet audit — addressed via fixes + context doc)
