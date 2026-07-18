# Runbook — Manual catalog refresh

Use this when a scheduled sync failed, when you need to backfill, or when you
want to validate a sync locally before letting CI run it.

## Local refresh (anime + manga)

```bash
# Requires TURSO_DATABASE_URL + TURSO_AUTH_TOKEN in .env
pnpm db:update          # anime: current + previous season
pnpm db:update:manga    # manga: top ~100 pages
```

For a full manga top-list refresh (~25k titles, slow):

```bash
pnpm db:update:manga:full
```

## Quarterly sync (anime re-score/status)

```bash
# Dry run, no DB writes:
pnpm db:quarterly-sync -- --dry-run

# Bounded validation run:
pnpm db:quarterly-sync -- --limit=500

# Full run:
pnpm db:quarterly-sync
```

Quarterly Jikan fallback failures are treated as **non-fatal** by design — a
partial upstream failure should not abort the whole sync.

## Manual trigger via GitHub Actions

Any of the sync workflows can be run manually from the Actions tab
(`workflow_dispatch`):

- "Update Catalog Data" — daily anime + manga refresh.
- "Quarterly Anime Sync" — with optional `dry_run` and `limit` inputs.
- "Quarterly Manga Sync" — full top-list refresh.

## After a refresh

The worker's in-memory cache is reloaded by the daily cron at 03:00 UTC. To
pick up fresh data sooner, redeploy the worker (`pnpm deploy:worker`) or wait
for the next cron tick. There is no manual cache-clear endpoint by design —
the 1h stale-while-revalidate TTL handles propagation.

## If the catalog is empty / corrupted

1. Re-seed from the cleaned JSON:
   `pnpm db:seed` and `pnpm db:seed:manga`.
2. Then run a full refresh to bring scores/status current.

> The `cleaned_*_data.json` files are gitignored locally and only present for
> the seed scripts. If missing, restore from the fleet seed source.

## Related

- [`../jobs.md`](../jobs.md) for the full schedule reference.
- `src/scripts/` for the script implementations.
