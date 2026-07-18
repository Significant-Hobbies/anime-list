# Project Recommendation Context

> **Historical snapshot — 2026-06-06.** This audit was generated *before* the
> 2026-06-20 Vite SPA migration (ADR 0001). It references Next.js / OpenNext
> paths (`app/.../page.tsx`), `next`, `@opennextjs/cloudflare`, and `jest`
> dependencies that have since been removed. It is preserved here for
> journey/audit context only; do not treat the stack inventory or runtime
> entrypoints as current. For the current stack, see
> [`../product/overview.md`](../product/overview.md) and
> [`../architecture/overview.md`](../architecture/overview.md).

Generated: 2026-06-06T21:14:19.532Z

This file is a CodeVetter Repo Unpacked-inspired audit written for Starboard recommendations. It is intentionally local, evidence-oriented, and safe to commit: it records product context, feature areas, stack inventory, and recommendation guidance without secrets or environment values.

## Project Identity

- Slug: `anime_list`
- Registry description: MAL Explorer — Browse and manage your anime/manga lists.
- Product grouping: `public-ready`
- Source path: `anime_list`

## Product Context

MAL Explorer — Browse and manage your anime/manga lists.

Shelf MAL Explorer is a production anime/manga discovery app: multi-field search with shareable URLs, personal watchlists Google OAuth , stats, schedule, and a signed-in seasonal discover queue backed by Turso + Cloudflare Worker mal-api .

MAL Explorer A modern anime discovery platform that helps you find your next favorite show. Live Demo : anime-list-9lk.pages.dev https://anime-list-9lk.pages.dev Deployment & External Services Concern Service --------- --------- Hosting Cloudflare Pages anime-list , anime-list-9lk.pages.dev via @opennextjs/cloudflare API Cloudflare Worker mal-api — Hono, daily cron at 03:00 UTC Database Turso libSQL Auth Google OAuth 2.0 + JWT Analytics PostHog local posthog-js wrapper CI/CD GitHub Actions — auto-deploy to Cloudflare Pages on push to main ; daily Turso sync workflow Local and production API traffic is served by the mal-api Cloudflare Worker on port 8787 during pnpm dev . The Problem Finding 

## Feature Map

- **Testing and quality**: Unit tests, browser tests, evals, CI quality gates, and regression checks. Keywords: test, testing, quality, vitest, playwright, ci, eval, benchmark.
- **Cloudflare and deploy**: Workers, Pages, edge runtime, queues, storage, and deploy automation. Keywords: cloudflare, worker, workers, pages, edge, deploy, wrangler, queue.
- **Search and discovery**: Search, ranking, recommendations, feeds, semantic retrieval, and discovery UX. Keywords: search, discovery, recommend, ranking, semantic, feed, index, retrieval.
- **Auth and identity**: Auth, OAuth, sessions, users, permissions, and account flows. Keywords: auth, oauth, identity, session, user, permission, login, nextauth.
- **AI agents**: Agents, tool use, workflows, orchestration, RAG, evals, and model integration. Keywords: ai, agent, agents, llm, rag, embedding, eval, model.
- **UI workflows**: Dashboards, tables, forms, component systems, charts, and user workflows. Keywords: ui, ux, dashboard, table, component, react, next, tailwind.
- **Ingestion and sync**: External API ingestion, sync jobs, scraping, enrichment, and scheduled updates. Keywords: sync, ingest, ingestion, scrape, scraping, enrich, crawler, etl.

## Runtime Surfaces and Entrypoints

- `app/.well-known/security.txt/route.ts`
- `app/@modal/(.)anime/[malId]/page.tsx`
- `app/@modal/(.)manga/[malId]/page.tsx`
- `app/about/page.tsx`
- `app/anime/[malId]/page.tsx`
- `app/changelog/page.tsx`
- `app/discover/page.tsx`
- `app/genre/[genre]/page.tsx`
- `app/humans.txt/route.ts`
- `app/layout.tsx`
- `app/manga/[malId]/page.tsx`
- `app/manga/page.tsx`
- `app/manga/stats/page.tsx`
- `app/manga/watchlist/page.tsx`
- `app/page.tsx`
- `app/privacy/page.tsx`
- `app/quiz/page.tsx`
- `app/random/page.tsx`
- `app/schedule/page.tsx`
- `app/search/page.tsx`
- `app/stats/layout.tsx`
- `app/stats/page.tsx`
- `app/terms/page.tsx`
- `app/watchlist/page.tsx`

## Current Stack

- Languages: `TypeScript`
- Frameworks/tools: `Cloudflare Workers`, `Vite`, `TanStack Router`, `Playwright`, `React`, `Tailwind CSS`
- Config files:
- `vite.config.ts`
- `playwright.config.ts`
- `wrangler.toml`

## OSS Already In Use

Direct dependencies:
- `@libsql/client`
- `@saas-maker/ops`
- `@tailwindcss/postcss`
- `@tanstack/react-query`
- `axios`
- `class-variance-authority`
- `clsx`
- `dotenv`
- `hono`
- `jose`
- `lucide-react`
- `next`
- `nuqs`
- `pino`
- `postcss`
- `posthog-js`
- `radix-ui`
- `react`
- `react-dom`
- `tailwind-merge`
- `tailwindcss`
- `tsx`
- `zod`

Development dependencies:
- `@axe-core/playwright`
- `@cloudflare/workers-types`
- `@eslint/js`
- `@opennextjs/cloudflare`
- `@playwright/test`
- `@saas-maker/prettier-config`
- `@saas-maker/test-config`
- `@saas-maker/tsconfig`
- `@testing-library/jest-dom`
- `@testing-library/react`
- `@types/jest`
- `@types/node`
- `@types/react`
- `@types/react-dom`
- `concurrently`
- `eslint`
- `eslint-config-next`
- `husky`
- `jest`
- `jest-environment-jsdom`
- `pino-pretty`
- `shadcn`
- `ts-jest`
- `tw-animate-css`
- `typescript`
- `typescript-eslint`
- `wrangler`

Package scripts:
- `build`
- `cf:build`
- `db:quarterly-sync`
- `db:seed`
- `db:seed:manga`
- `db:update`
- `db:update:manga`
- `db:update:manga:full`
- `deploy`
- `deploy:worker`
- `dev`
- `dev:be`
- `dev:fe`
- `dev:worker`
- `lint`
- `build`
- `prepare`
- `test`
- `test:e2e`
- `test:e2e:anime-detail`
- `typecheck`

## Testing and Quality Signals

- `components/__tests__/AnimeCard.test.tsx`
- `components/__tests__/FilterBuilder.pagination.test.tsx`
- `components/__tests__/FilterRow.test.tsx`
- `e2e/anime-detail.spec.ts`
- `e2e/mobile.spec.ts`
- `lib/__tests__/apiConfig.test.ts`
- `lib/__tests__/types.test.ts`
- `playwright.config.ts`
- `src/controllers/__tests__/scheduleController.test.ts`
- `src/controllers/animeDetailService.test.ts`
- `src/recommendations.test.ts`
- `src/services/anilistStatusSync.test.ts`
- `src/validators/animeFilters.test.ts`
- `src/watchlistSync.test.ts`
- `tsconfig.test.json`

## Recommendation Guidance

Good matches:
- Repos that strengthen testing and quality without replacing already-installed libraries.
- Repos that strengthen cloudflare and deploy without replacing already-installed libraries.
- Repos that strengthen search and discovery without replacing already-installed libraries.
- Repos that strengthen auth and identity without replacing already-installed libraries.
- Repos that strengthen ai agents without replacing already-installed libraries.
- Repos that strengthen ui workflows without replacing already-installed libraries.
- Repos that strengthen ingestion and sync without replacing already-installed libraries.
- Tools with concrete support for page.tsx, anime, cloudflare, worker, api, manga, google, jikan.
- Implementation repos, SDKs, CLIs, testing utilities, adapters, and focused libraries are higher value than generic awesome lists.

Avoid recommending:
- Do not recommend packages already listed under direct or development dependencies unless the task is migration research.
- Do not recommend broad framework replacements unless the project context explicitly calls for a rewrite.
- Downrank curated lists, archived repos, stale demos, and generic UI kits that do not map to the feature catalog.

## Evidence Read

Primary docs and handoff files:
- `AGENTS.md`
- `PROJECT_STATUS.md`
- `README.md`
- `docs/README.md`

Package manifests:
- `.pages-deploy/server-functions/default/package.json`
- `package.json`

Inventory notes:
- Files scanned: 280
- This pass uses deterministic repo inventory plus local documentation/source-path evidence. It does not claim a full manual line-by-line review of every source file.

## Confidence

Confidence: **high**

Why:
- PROJECT_STATUS.md present
- README.md present
- 24 entrypoint/runtime files identified
- package dependencies inventoried
- 15 test/quality files identified

Refresh command:

```bash
cd /Users/sarthak/Desktop/fleet/starboard
pnpm fleet:audit-recommendation-context
pnpm fleet:extract-projects
```
