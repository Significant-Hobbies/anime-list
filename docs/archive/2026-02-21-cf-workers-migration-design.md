# Cloudflare Workers Migration Design

## Goal
Replace Render backend with Cloudflare Workers. Zero code changes to frontend.

## Architecture
```
Vercel (Next.js FE) → CF Workers (Hono API) → Turso (DB)
```

## Scope
- Anime routes, auth routes, watchlist routes
- Manga: skipped for now (stays unavailable until migrated to Turso)

## Changes
- Express → Hono
- In-memory animeStore → query Turso directly
- `jsonwebtoken` → `jose`
- `google-auth-library` → raw fetch to Google tokeninfo
- `node-cron` → CF Cron Triggers
- helmet/compression/rate-limit → removed (Cloudflare handles)
- `xml2json` → removed (not needed for anime path)

## What stays
- Controller business logic (search, filter, stats)
- Turso DB layer
- Zod validators
- API contract (no frontend changes)
