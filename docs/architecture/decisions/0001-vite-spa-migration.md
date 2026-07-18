# ADR 0001 — Migrate the frontend to a Vite SPA

- **Status:** Accepted (implemented 2026-06-20)
- **Date:** 2026-06-20
- **Supersedes:** the Next.js + OpenNext frontend

## Context

The frontend was a Next.js app deployed to Cloudflare Pages via
`@opennextjs/cloudflare`. The product is a client-side discovery tool with no
server-rendered routes; the OpenNext layer added bundle weight, build
complexity, and operational fragility (intermittent Pages 500s, a 17 MB
`cleaned_anime_data.json` shipped into the SPA bundle) without delivering SSR
value. The `mal-api` Hono worker was already the real backend.

## Decision

Rewrite the frontend as a Vite 8 SPA with TanStack Router (file-based
routes), TanStack Query for client caching, and nuqs for URL state. Keep the
`mal-api` worker unchanged. Remove the 17 MB cleaned JSON from the SPA bundle
(catalog now lives in Turso, served by the worker).

## Consequences

- Positive: smaller client bundle, faster builds, no OpenNext runtime to keep
  in sync, simpler deploy (static `dist/` to Cloudflare Pages).
- Positive: removed a recurring class of Pages 500 regressions tied to the
  OpenNext server functions.
- Negative: no server rendering by default — detail pages are SPA shells for
  crawlers. This was addressed separately by ADR 0003 (Pages Functions HTML
  rewrite), not by reintroducing SSR.
- Trade-off accepted: SEO for detail pages required a dedicated solution
  rather than coming for free from a meta-framework.

## Failure mode that motivated this

The prior Next.js + OpenNext stack is documented as a failed approach in
[`../../knowledge/failed-approaches.md`](../../knowledge/failed-approaches.md).
