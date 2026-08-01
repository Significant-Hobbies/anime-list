# ADR 0005: Cloudflare D1 persistence

**Status:** Accepted; production activation pending explicit cutover approval
**Date:** 2026-08-01

## Context

The Worker, scheduled cache refresh, and GitHub catalog jobs all depend on one
Turso database in production. An optional manga URL override exists, but the
measured source is 42,016,768 bytes with 14 current tables, 25 indexes, and no
virtual tables. Both catalogs already share the same ownership and operational
boundary.

## Decision

Use one project-owned D1 database named `anime-list`, exposed to the Worker as
`DB`. Keep the existing domain query surface behind a small D1 execute/batch
adapter. Replace startup DDL with ordered SQL under `migrations/d1/`.

GitHub and operator jobs use a Wrangler-backed client because they execute
outside a Worker request. That client defaults to local D1, serializes CLI
access, bounds batches, and requires both `--remote` and
`D1_REMOTE_APPROVED=true` for remote work. Source dumps are converted into
allowlisted, repeatable data-only chunks for Wrangler import.

## Consequences

- Anime and manga stay in one database; there is no second binding or new
  cross-database failure mode.
- Local development and tests cannot reach production D1 by default.
- Production deploys fail closed until an approved D1 UUID replaces the
  placeholder, migrations pass, and the Worker is tagged with the full Git
  SHA.
- Turso remains production-authoritative until the separate cutover receipt is
  approved, and remains rollback-held afterward until separately retired.
