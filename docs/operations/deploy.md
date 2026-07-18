# Deploy

Production deploys are **manual** per fleet policy. The GitHub deploy workflow
is `workflow_dispatch` only (no auto-deploy on push).

## Products

| Surface | Host | Origin |
| --- | --- | --- |
| SPA | Cloudflare Pages, project `anime-list`, branch `main` | https://anime.significanthobbies.com |
| API | Cloudflare Worker `mal-api`, cron `0 3 * * *` | https://mal-api.sarthakagrawal927.workers.dev |
| PR previews | Cloudflare Pages | `pr-{N}.anime-list-9lk.pages.dev` |

## Frontend (Cloudflare Pages)

- `pnpm deploy` runs a clean-`main` branch guard, `pnpm build`, then
  `wrangler pages deploy dist --project-name=anime-list --branch=main`.
- `VITE_*` build vars are inlined into the client bundle at build time via
  `import.meta.env`. The deploy workflow
  (`.github/workflows/deploy.yml`) sets them explicitly:
  `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_SAASMAKER_API_KEY`.
  `wrangler.toml` `[vars]` only applies at runtime to the worker — setting
  client vars there has no effect on the bundle.
- Post-deploy smoke: the workflow curls `/` and `/anime/1` with retries.

## API Worker (Cloudflare Worker `mal-api`)

- `pnpm deploy:worker` → `wrangler deploy src/worker.ts --config wrangler.cron.toml`.
- Worker config: `wrangler.cron.toml` (cron `0 3 * * *`, `nodejs_compat_v2`).
- Set worker secrets via `wrangler secret put <KEY>`:
  `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`,
  optional `TURSO_MANGA_DATABASE_URL` / `TURSO_MANGA_AUTH_TOKEN`.

## Database (Turso)

- Create: `turso db create mal-watchlist`; `turso db show mal-watchlist` for
  credentials.
- Migrations run inline at worker startup (`src/db/migrations.ts`,
  `src/db/mangaMigrations.ts`) — no separate migration step on deploy.
- Seed/refresh scripts are run from CI or locally, not on deploy (see
  [`jobs.md`](jobs.md)).

## Pre-deploy checklist

- `pnpm lint && pnpm typecheck && pnpm test` pass.
- `pnpm build` succeeds and the SEO dataset regenerates cleanly (empty diff
  on `src/data/seo-*.json`).
- On a clean `main` branch.

## Post-deploy verification (crawlable detail pages)

After deploying the Pages Functions rewrite, verify a couple of detail pages
and a sitemap chunk:

```bash
curl -s https://anime.significanthobbies.com/anime/5114 | grep -i "<title>"
curl -s https://anime.significanthobbies.com/anime/999999999 | grep -i noindex
curl -s -o /dev/null -w "%{http_code}\n" https://anime.significanthobbies.com/sitemap-index.xml
```

Then run `agent-index-audit.mjs --project anime-list` (fleet tooling) and
submit `sitemap-index.xml` to Google Search Console once the zone AI-block /
GSC onboarding fleet actions land (tracked in `STATUS.md`).
