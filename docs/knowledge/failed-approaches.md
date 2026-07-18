# Failed approaches

Durable records of approaches that did not work, so they are not retried.
Each entry states what was tried, why it failed, and what replaced it.

## Next.js + OpenNext on Cloudflare Pages

- **Tried:** Running the frontend as a Next.js app deployed to Cloudflare
  Pages via `@opennextjs/cloudflare`, with server functions and a 17 MB
  `cleaned_anime_data.json` shipped into the SPA bundle.
- **Why it failed:**
  - Intermittent Pages 500s tied to the OpenNext server functions (recurring
    production incidents, 2026-05 — see memory observations `715`, `716`).
  - Heavy bundle and build complexity for a product that is fundamentally
    client-side and gains nothing from SSR.
  - An extra runtime (OpenNext) to keep in sync with upstream.
- **Replaced by:** A Vite 8 SPA + TanStack Router static build deployed to
  Cloudflare Pages (ADR 0001). The 17 MB JSON was removed from the bundle;
  the catalog is served by the `mal-api` worker from Turso.
- **Do not** reintroduce a meta-framework for SSR. SEO for detail pages is
  now handled by Pages Functions HTML rewrite (ADR 0003), not by SSR.

## Render-hosted Express backend with `node-cron`

- **Tried:** Express on Render with `jsonwebtoken`, `google-auth-library`,
  `node-cron`, and helmet/compression/rate-limit middleware.
- **Why it failed:**
  - `node-cron` was not reliable for the daily cache reload on a hosted
    Node process.
  - A separate host added latency, cost, and operational surface between
    the frontend and the API.
  - Node-only auth libraries were unnecessary weight once the frontend moved
    to Cloudflare.
- **Replaced by:** A single Hono Cloudflare Worker (`mal-api`) with Cloudflare
  Cron Triggers and `jose` for JWT/JWKS (ADR 0002).
- **Do not** move the API back to a long-lived Node host. The worker's
  in-memory cache + cron trigger is the intended architecture.

## Hand-written JSON-LD on detail pages

- **Tried:** Hand-writing JSON-LD blocks for detail pages.
- **Why it failed:** Brittle and easy to get wrong; hard to keep consistent
  across thousands of titles.
- **Replaced by:** Fleet-generated, marked JSON-LD block emitted by the pure
  `src/seoRewrite.ts` function from the build-time SEO dataset (commit
  `b7a3c81`, ADR 0003). The block is unit-tested including `</script>`
  injection cases.
- **Do not** hand-author JSON-LD for catalog pages; extend the rewrite
  function and dataset instead.

## PR preview deploys on every PR

- **Tried:** Auto-deploying PR previews to Cloudflare Pages on every PR.
- **Why it failed:** Added noise and deploy churn without enough value for
  this product's workflow.
- **Replaced by:** Production deploy on `main` only, manual
  (`workflow_dispatch`). PR previews remain available at
  `pr-{N}.anime-list-9lk.pages.dev` but are not auto-pushed on every PR
  (commit `65c41c0`).
