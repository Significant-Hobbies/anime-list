# Scheduled jobs

The authoritative source for schedules is the executable configuration:
`wrangler.cron.toml` (worker cron) and `.github/workflows/*.yml` (GitHub
Actions). This document explains *what* runs and *why*, and links to the
canonical files. If anything here disagrees with those files, the files win.

## Worker cron — `0 3 * * *` (daily 03:00 UTC)

Defined in `wrangler.cron.toml`, handled by the `scheduled` export in
`src/worker.ts`:

1. Reload the anime and manga in-memory stores from Turso
   (`animeStore.setAnimeList()`, `mangaStore.setMangaList()`).
2. Evaluate saved-search alerts after the catalog refresh
   (`evaluateSavedSearchesAfterCatalogRefresh()`) and create new alert rows.

This runs *after* the GitHub Action catalog refresh (00:00 UTC) so the
worker cache picks up the fresh Turso data.

## GitHub Actions

### Daily catalog refresh — `update-anime-data.yml`

- Schedule: `0 0 * * *` (daily 00:00 UTC) + `workflow_dispatch`.
- Runs `pnpm db:update` (anime: current + previous season) and
  `pnpm db:update:manga` (manga: top ~100 pages).
- Secrets: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, optional
  `TURSO_MANGA_*`.
- Timeout: 15 min.

### Quarterly anime sync — `quarterly-anime-sync.yml`

- Schedule: `0 0 1 1,4,7,10 *` (Jan/Apr/Jul/Oct 1, 00:00 UTC) +
  `workflow_dispatch` with `dry_run` and `limit` inputs.
- Runs `pnpm db:quarterly-sync` (re-score/status sync across the catalog).
- Quarterly Jikan fallback failures are treated as non-fatal.
- Timeout: 120 min.

### Quarterly manga sync — `quarterly-manga-sync.yml`

- Schedule: `0 1 1 1,4,7,10 *` (Jan/Apr/Jul/Oct 1, 01:00 UTC, after anime) +
  `workflow_dispatch`.
- Runs `pnpm db:update:manga:full` (full top-list refresh, ~20.7k titles).
- Timeout: 240 min.

### Weekly quality check — `weekly.yml`

- Schedule: `0 9 * * 1` (Mondays 09:00 UTC) + `workflow_dispatch`.
- Runs whatever quality scripts exist: `lint`, `typecheck`, `test`, `build`.

### Deploy — `deploy.yml`

- `workflow_dispatch` only (manual). Builds with `VITE_*` env and deploys
  `dist/` to Cloudflare Pages, then smokes `/` and `/anime/1`.

### CI — `ci.yml`

- On push/PR to `main`/`master`: `pnpm lint`, `pnpm test`, `pnpm build`,
  `pnpm run size`.

### Docs — `docs.yml`

- On push/PR: runs `node scripts/check-docs.mjs` to validate internal
  markdown links. Optional `blume validate` if Blume is installed.

## Manual catalog operations

See [`runbooks/catalog-refresh.md`](runbooks/catalog-refresh.md) for running
catalog refreshes by hand and recovering from a failed sync.
