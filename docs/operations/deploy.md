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

- `pnpm deploy:worker` validates clean/synced `main`, applies remote D1
  migrations, and deploys `mal-api` with the full Git SHA tag.
- Worker config: `wrangler.cron.toml` (cron `0 3 * * *`, `nodejs_compat_v2`).
- D1 binding: `DB`. Worker secrets remain `JWT_SECRET` and `GOOGLE_CLIENT_ID`.

## Database (Cloudflare D1)

- Local schema: `pnpm db:migrate:local`; isolated proof: `pnpm db:rehearse`.
- Production schema: `pnpm db:migrate:remote`, after the approved UUID is in
  `wrangler.cron.toml` and the repository is on clean `main`.
- One-time Turso dumps are converted with `pnpm db:prepare-import` into
  allowlisted, repeatable data-only chunks for `wrangler d1 execute --file`.
- Production cutover temporarily deploys the same release with
  `WRITE_FREEZE=true`; non-read HTTP methods return `503` with `Retry-After`
  until final Turso reconciliation and D1 verification complete. The tracked
  production value is `false`, so the normal release reopens writes.
- Seed/refresh scripts are run from CI or locally, not on deploy (see
  [`jobs.md`](jobs.md)).

## Pre-deploy checklist

- `pnpm db:rehearse && pnpm lint && pnpm typecheck && pnpm test` pass.
- D1 receipt confirms schema/count/aggregate/ownership parity; remote UUID is
  no longer the fail-closed placeholder.
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
