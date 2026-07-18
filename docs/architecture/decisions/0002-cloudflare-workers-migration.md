# ADR 0002 — Replace the Render/Express backend with a Cloudflare Worker

- **Status:** Accepted (implemented 2026-02)
- **Date:** 2026-02-21
- **Supersedes:** the Render-hosted Express backend

## Context

The backend was Express on Render, using `jsonwebtoken`,
`google-auth-library`, `node-cron`, helmet/compression/rate-limit middleware,
and an in-memory animeStore that queried Turso directly. The frontend was on
Vercel. This split added latency, cost, and operational surface, and
`node-cron` was not reliable for the daily cache reload.

## Decision

Move the API to a single Cloudflare Worker (`mal-api`) written in Hono:

- Express → Hono
- `jsonwebtoken` → `jose`
- `google-auth-library` → raw fetch + `jose` remote JWKS verification
- `node-cron` → Cloudflare Cron Triggers (`0 3 * * *`)
- helmet/compression/rate-limit → removed (Cloudflare handles)
- `xml2json` → removed (not needed for the anime path)
- libSQL client imported from `@libsql/client/web` (Workers-compatible)

Business logic (search, filter, stats), the Turso DB layer, and Zod
validators were preserved unchanged. The API contract was preserved so no
frontend changes were required.

## Consequences

- Positive: one platform for API + cron; sub-ms warm responses from the
  in-memory cache; no separate host to pay for or monitor.
- Positive: cron is now a first-class Cloudflare trigger, reliable for the
  daily cache reload and saved-search alert evaluation.
- Constraint: any Node-only dependency is off-limits in the worker; the
  filter engine is kept pure for this reason (see
  [`../../knowledge/learnings.md`](../../knowledge/learnings.md)).

## Original design artifact

The full migration design is preserved at
[`../../archive/2026-02-21-cf-workers-migration-design.md`](../../archive/2026-02-21-cf-workers-migration-design.md).
