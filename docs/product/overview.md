# Product overview

## What it is

**Shelf (MAL Explorer)** is a production anime/manga discovery app. It gives
multi-field filtering, shareable URLs, personal watchlists (Google OAuth),
stats, schedule tracking, and a signed-in seasonal discovery queue over a
catalog of ~14.8k anime + ~25k manga titles synced daily from MyAnimeList via
the Jikan API.

- **Live site:** https://anime.significanthobbies.com
- **API worker:** https://mal-api.sarthakagrawal927.workers.dev
- **Slug / fleet grouping:** `anime_list` / `public-ready`

## Who it serves

Anime/manga fans filtering 40k+ catalog titles; signed-in users tracking
watchlists and discovering seasonal picks.

## Operating posture

Operational stability over feature expansion. Engagement on newer surfaces
(quiz, collections) is measured before expanding them. See
[`../../STATUS.md`](../../STATUS.md) for the current objective and in-flight work.

## Scope

- **In scope:** Vite SPA frontend, `mal-api` Hono worker, Turso, daily and
  quarterly catalog sync, in-app saved-search alerts.
- **Out of scope (deferred):** email digest for saved searches, collection
  social features, character quiz persistence/OG images until engagement
  proves lift.

## Dependencies (external)

- **Google OAuth + JWT** (`jose`); httpOnly `mal_auth_token` cookie (7d).
- **Turso libSQL** — catalog tables + per-user watchlists, schedule, saved
  searches, collections.
- **Jikan API** — daily GitHub Action sync + quarterly full refresh.
- **MAL CDN** — poster images (recurring operational risk; see
  [`../operations/runbooks/mal-cdn-403.md`](../operations/runbooks/mal-cdn-403.md)).
- **PostHog** — client analytics.
- **Cloudflare** — Pages (SPA), Workers (`mal-api`), edge caches.

Secrets (names only, never values): `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`,
`JWT_SECRET`, `GOOGLE_CLIENT_ID`, optional `TURSO_MANGA_*`, `POSTHOG_API_KEY`.
Local env shape is defined in `.env.example`.

## Catalog & search posture

- ~14.8k anime + ~25k manga with quality gates (must have `score`,
  `scored_by`, `members`, `favorites`, `year`).
- Discover UI defaults to a minimum popularity floor (100k anime / 50k manga
  members) to surface quality titles.
- Manga scope is the Jikan `/top/manga` top ~25k titles, **not** the full MAL
  catalog.
- Smart ranking balances log-scale popularity and MAL score so hidden gems
  get a chance.

## Shipped features

Detailed feature inventory and engagement instrumentation live in
[`features.md`](features.md). Architecture and data flow live in
[`../architecture/overview.md`](../architecture/overview.md).
