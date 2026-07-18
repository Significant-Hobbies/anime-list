# Development setup

## Prerequisites

- Node.js 18+ (CI uses 22; Blume, if used, needs 22.12+).
- pnpm 10.33.2 (pinned via `packageManager` in `package.json`).
- A Turso database (free tier is fine) and Google OAuth credentials for full
  local behavior. The SPA runs without them but auth/watchlist endpoints will
  fail without `TURSO_*` and `GOOGLE_CLIENT_ID`.

## First-time setup

1. `pnpm install`
2. Copy `.env.example` → `.env` and fill in Turso + Google OAuth values.
   For local dev, `VITE_API_URL=http://localhost:8787`.
3. Seed the catalog once (one-time):
   - `pnpm db:seed` — anime from `cleaned_anime_data.json`
   - `pnpm db:seed:manga` — manga from `cleaned_manga_data.json`
4. `pnpm dev` — runs the Worker (`:8787`) and Vite (`:5173`) together.
5. Open http://localhost:5173

> The large `cleaned_*_data.json` files are gitignored locally and kept only
> for the seed scripts. The catalog lives in Turso in production.

## Commands

Authoritative list lives in `package.json`. Common commands:

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Worker `:8787` + Vite `:5173` |
| `pnpm dev:be` / `pnpm dev:worker` | Worker only |
| `pnpm dev:fe` | Vite only |
| `pnpm build` | Vite production build (`prebuild` regenerates SEO dataset, `postbuild` emits sitemaps) |
| `pnpm preview` | Vite preview |
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | Playwright (desktop + mobile) |
| `pnpm test:e2e:anime-detail` | Playwright detail-page spec |
| `pnpm typecheck` | `tsc --noEmit -p tsconfig.app.json` |
| `pnpm lint` / `pnpm check` | Biome check |
| `pnpm format` | Biome format --write |
| `pnpm size` | size-limit bundle check |
| `pnpm db:seed` / `db:seed:manga` | Seed Turso from JSON |
| `pnpm db:update` / `db:update:manga` | Refresh catalog from Jikan |
| `pnpm db:update:manga:full` | Full top-list manga refresh (~20.7k) |
| `pnpm db:quarterly-sync` | Quarterly anime status/score sync |
| `pnpm deploy` | Clean-`main` guard + build + `wrangler pages deploy` |
| `pnpm deploy:worker` | `wrangler deploy --config wrangler.cron.toml` |

## Documentation commands

| Command | Purpose |
| --- | --- |
| `node scripts/check-docs.mjs` | Validate internal markdown links across `docs/`, `AGENTS.md`, `STATUS.md`, `README.md` |
| `blume dev` | Render `docs/` locally with Blume (presentation only) |
| `blume validate` | Blume's own link/content validator |

See [`../operations/deploy.md`](../operations/deploy.md) for deploy steps and
[`conventions.md`](conventions.md) for code conventions.
