# STATUS — anime_list (Shelf)

> Short operational view. Full product/feature detail and timeline live in
> [`PROJECT_STATUS.md`](PROJECT_STATUS.md). Keep this page concise — update
> it when the objective, active work, blockers, or next steps change.

**Last updated:** 2026-07-18

## Current objective

Operational stability over feature expansion. Measure engagement on the
quiz and collections surfaces before expanding them; ship and verify the
crawlable detail-page SEO work.

## Active work

- **Homepage A/B test in progress** — `control` vs `treatment` (quiz CTA
  above fold), 50/50 cookie split. **Decision due after 2026-07-18** (2-week
  window). Keep only the winner; if no lift, keep control. See
  [`docs/architecture/decisions/0004-engagement-measurement.md`](docs/architecture/decisions/0004-engagement-measurement.md).
- **Crawlable detail pages** — implemented (2026-07-17), **deploy pending**
  manual `pnpm deploy` per fleet policy. See
  [`docs/architecture/decisions/0003-crawlable-detail-pages.md`](docs/architecture/decisions/0003-crawlable-detail-pages.md).

## Next steps

1. **Deploy crawlable detail pages** — `pnpm deploy`; post-deploy curl two
   detail pages + one sitemap chunk; run `agent-index-audit.mjs --project anime-list`.
2. **Decide the homepage A/B winner** after the 2-week window; park the loser.
3. **GSC sitemap submission** — submit `sitemap-index.xml` to Google Search
   Console once the zone AI-block / GSC onboarding fleet actions land.
4. **Add e2e** for discover, watchlist import, collections, alerts, auth
   flows, manga routes (currently only anime-detail + mobile are covered).
5. Measure `/quiz` completion-to-search clickthrough before persistence, OG
   images, or share analytics. Measure collection share clickthrough before
   discovery ranking or social features.

## Blockers / recurring risks

- **MAL CDN image policy** — poster 403s recur; no client-controlled fix.
  See [`docs/operations/runbooks/mal-cdn-403.md`](docs/operations/runbooks/mal-cdn-403.md).
- **Intermittent Pages 500s** — largely resolved by the Vite SPA migration,
  but detail-page Pages Functions are a new server surface to watch.
  See [`docs/operations/runbooks/pages-500.md`](docs/operations/runbooks/pages-500.md).
- **No e2e** for most flows (see Next steps #4).

## Deferred (intentional)

- Character identity quiz expansion (share URLs, persistence, OG) — pending
  engagement data. Brief: [`docs/archive/2026-06-04-character-identity-quiz-brief.md`](docs/archive/2026-06-04-character-identity-quiz-brief.md).
- Saved-search email digest — in-app MVP shipped; email deferred until
  engagement proves lift.
- Collection social features (comments, likes, follower feeds) — deferred.

## Unresolved questions

- Will the homepage A/B treatment produce a statistically meaningful lift in
  `signup` vs control? (Resolved by the in-progress experiment.)
- Is the significanthobbies.com zone AI-block / GSC onboarding landed yet?
  (Fleet dependency; blocks GSC sitemap submission.)
- Should posters be routed through a fleet CDN proxy to mitigate MAL CDN
  403s? (No decision yet; see MAL CDN runbook.)
