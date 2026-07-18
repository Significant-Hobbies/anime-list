# Development conventions

## Stack

Vite 8 SPA + TanStack Router + Tailwind v4 + shadcn/ui + TanStack Query +
nuqs (frontend); Hono Cloudflare Worker `mal-api`; Turso libSQL; Google OAuth
+ JWT (`jose`); PostHog; Vitest + Playwright. Language: TypeScript full stack.
Package manager: pnpm (pinned 10.33.2). Lint/format: Biome.

## Catalog quality gate

Jikan rows must have `score`, `scored_by`, `members`, `favorites`, and
`year`. Missing any one drops the row entirely (enforced in `src/api.ts`
during fetch). Discover UI defaults to a minimum popularity floor (100k anime
/ 50k manga members). Do not relax this gate without a reason — it is what
keeps the catalog quality credible.

## Watch statuses

The fixed enum: `Watching`, `Completed`, `Deferred`, `Avoiding`, `BRR`, plus
per-user custom tags. Do not add statuses casually; downstream filters,
recommendations, and import/export all depend on this set.

## Worker code constraints

- Import libSQL from `@libsql/client/web`, not the Node client — the Node
  client does not bundle in the Workers runtime.
- Keep `src/filterEngine.ts` pure (no fs / native modules) so it is safe to
  import from the Worker, scripts, and tests.
- Edge Cache API keys use the fake host `https://mal-cache.local/...` to
  avoid URL collisions — follow that pattern when adding cached endpoints.
- Register specific routes (e.g. `/api/anime/random`) **before** param routes
  (e.g. `/api/anime/:malId`); Hono matches in declaration order (noted in
  `src/worker.ts`).

## Auth

- Google OAuth → JWT signed with `jose`; httpOnly `mal_auth_token` cookie
  (7d). Google JWKS fetched remotely at verify time via `createRemoteJWKSet`.
- Use the `requireAuth` / `optionalAuth` middleware in `src/worker.ts` rather
  than re-implementing verification.

## Frontend

- URL state via nuqs so search/filter views are shareable. Keep filter state
  round-trippable through the URL (a prior bug where custom filters never
  rendered was caused by nuqs + TanStack Router round-trip loss — see commit
  `aa631e5`).
- Wrap the app in `QueryClientProvider` (a prod crash was once caused by a
  missing provider — see commit `73010d6`).
- shadcn/ui primitives live in `components/ui/`; shared discover filter UI in
  `components/discover/`.

## Build pipeline

`pnpm build` runs `prebuild` (`scripts/build-seo-dataset.mjs`) → `vite build`
→ `postbuild` (`scripts/build-sitemaps.mjs`). The SEO dataset output
(`src/data/seo-*.json`) is committed and must regenerate deterministically;
re-running `prebuild` on a clean checkout should produce an empty diff.

## Testing

- Unit tests next to code (`*.test.ts`) or under `__tests__/`, run by Vitest.
- e2e in `e2e/` via Playwright. Detail-page e2e asserts unique `<title>` +
  app mounts + noindex on unknown id.
- Add tests for new filter/import/recommendation/SEO-rewrite logic — those
  are the regression-prone areas.

## Commits and deploys

- Conventional-ish commit prefixes are used in history (`feat:`, `fix:`,
  `perf:`, `docs:`, `ci:`, `chore:`). Match the style.
- `pnpm deploy` guards on a clean `main` branch. Production deploys are
  manual per fleet policy (the deploy workflow is `workflow_dispatch` only).
- Do not push, deploy, or open PRs as part of routine agent work without
  explicit user instruction.
