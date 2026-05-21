# Turso Database Migration Guide

> Historical record of the one-time JSON→Turso migration (complete). Current production runs on Cloudflare — see the deploy section below.

## Overview

Anime data storage has been migrated from JSON files to Turso (SQLite) database for:
- **Persistence** in a real database (JSON files are ephemeral on serverless hosts)
- **Better performance** with indexed queries
- **Automatic cron updates** without file system issues

## Migration Steps

### 1. Run Database Migrations

```bash
npm run db:seed
```

This will:
- Create the `anime_data` table in Turso
- Import existing JSON data into the database
- Create indexes for fast queries

### 2. Test Locally

```bash
# Start the backend
npm run dev:be

# The server will load anime data from Turso
```

### 3. Deploy to Cloudflare

Production runs on Cloudflare — the Next.js frontend on Cloudflare Pages (project `anime-list`) and the API + daily cron on the `mal-api` Worker:

```bash
pnpm deploy:worker   # wrangler deploy --config wrangler.cron.toml
```

The `mal-api` Worker runs a daily cron at 03:00 UTC for the data refresh.

**Important**: set the Worker secrets via `wrangler secret put`:
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `JWT_SECRET`
- `GOOGLE_CLIENT_ID`

### 4. Manual Update (if needed)

```bash
# Update anime data manually (fetches latest 2 seasons)
npm run db:update
```

## What Changed

### Before (JSON-based)
```
anime_data.json → cleaned_anime_data.json → In-memory cache
```

### After (Turso-based)
```
MAL API → Turso database → In-memory cache (5min TTL)
```

### Key Files Modified

1. **`src/db/animeData.ts`** - New database operations
2. **`src/db/migrations.ts`** - Database schema
3. **`src/store/animeStore.ts`** - Now loads from Turso with auto-refresh
4. **`src/api.ts`** - Writes directly to Turso
5. **`src/services/dataLoader.ts`** - Simplified to load from DB
6. **`src/scripts/updateAnimeData.ts`** - Cron job script

### Cron Job

Runs **daily at 03:00 UTC** on the Cloudflare Worker `mal-api` to fetch the latest two anime seasons and update the database.

## Troubleshooting

### "No anime data in database"
Run: `npm run db:seed`

### Stale data in API responses
The in-memory cache auto-refreshes every 5 minutes, or you can restart the server.

### Cron job not running
Check the Cloudflare dashboard → `mal-api` Worker → cron logs / invocations
