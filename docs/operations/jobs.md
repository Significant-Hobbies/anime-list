# Scheduled jobs

The authoritative source for schedules is the executable configuration:
`wrangler.cron.toml` (worker cron) and `.github/workflows/*.yml` (GitHub
Actions). This document explains *what* runs and *why*, and links to the
canonical files. If anything here disagrees with those files, the files win.

## Worker cron — `0 3 * * *` (daily 03:00 UTC)

Defined in `wrangler.cron.toml`, handled by the `scheduled` export in
`src/worker.ts`:

Reload the anime and manga in-memory stores from D1
(`animeStore.setAnimeList()`, `mangaStore.setMangaList()`).

This runs *after* the GitHub Action catalog refresh (00:00 UTC) so the
worker cache picks up the fresh D1 data.

## GitHub Actions

### Daily catalog refresh — `update-anime-data.yml`

- Schedule: `0 0 * * *` (daily 00:00 UTC) + `workflow_dispatch`.
- Runs the explicit remote forms of the anime and manga update commands.
- Wrangler uses `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; scripts
  otherwise default to local D1 and reject an unapproved `--remote` call.
- Timeout: 15 min.

### Quarterly anime sync — `quarterly-anime-sync.yml`

- Schedule: `0 0 1 1,4,7,10 *` (Jan/Apr/Jul/Oct 1, 00:00 UTC) +
  `workflow_dispatch` with `dry_run` and `limit` inputs.
- Runs the remote Wrangler form of `pnpm db:quarterly-sync`.
- Quarterly catalog-provider fallback failures are treated as non-fatal.
- Timeout: 120 min.

### Quarterly manga sync — `quarterly-manga-sync.yml`

- Schedule: `0 1 1 1,4,7,10 *` (Jan/Apr/Jul/Oct 1, 01:00 UTC, after anime) +
  `workflow_dispatch`.
- Runs the remote Wrangler form of the full top-list refresh (~20.7k titles).
- Timeout: 240 min.

### Weekly quality check — `weekly.yml`

- Schedule: `0 9 * * 1` (Mondays 09:00 UTC) + `workflow_dispatch`.
- Runs whatever quality scripts exist: `lint`, `typecheck`, `test`, `build`.

### Deploy — `deploy.yml`

- `workflow_dispatch` only (manual). Applies D1 migrations, deploys the tagged
  API Worker, builds/deploys Pages, then smokes API and detail routes.

### CI — `ci.yml`

- On push/PR to `main`/`master`: local D1 migration/rehearsal, import tests,
  Worker dry-run, lint, test, build, and size checks.

### Docs — `docs.yml`

- On push/PR: runs `node scripts/check-docs.mjs` to validate internal
  markdown links.

## Manual catalog operations

See [`runbooks/catalog-refresh.md`](runbooks/catalog-refresh.md) for running
catalog refreshes by hand and recovering from a failed sync.
