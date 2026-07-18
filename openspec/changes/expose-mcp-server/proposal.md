## Why

Shelf users track everything they've watched/read in the watchlist, but that
knowledge stays locked inside the SPA. When a user is in an AI tool (Claude
Desktop, Cursor, etc.) and asks "have I seen Frieren?" or "recommend something
given what I've read", the AI has no way to query Shelf. Exposing an MCP server
gives AI tools a typed, authenticated window into the user's watchlist so they
can ground recommendations and conversations in what the user has actually
consumed.

The existing `/api/*` endpoints already expose all the data we need — most are
public (search, detail, stats, random, fields, filters, changelog) and only
the watchlist endpoints are auth-gated. So the MCP server is a **thin tool
layer over the existing endpoints**, not a parallel data layer.

## What Changes

- Add a `POST /api/mcp` endpoint on the existing `mal-api` Worker that speaks
  the **MCP Streamable HTTP** transport. The endpoint is open for
  `initialize` / `tools/list` and for public tools; only watchlist tools
  require a bearer token. Reuses the same Worker, DB bindings, and env-bridge
  middleware — no new deploy target.
- MCP tools map directly to existing endpoints:
  - **Public (no auth):** `search_anime`, `search_manga`, `get_anime_detail`,
    `get_manga_detail`, `get_anime_stats`, `get_random_anime`.
  - **Auth-gated (PAT or JWT):** `list_watchlist`, `list_manga_watchlist`,
    `list_watchlist_tags`, `get_watchlist_enriched`.
  - Tool handlers call the same db/controller functions the routes use — no
    new data layer, no subrequests.
- Add **Personal Access Tokens (PATs)**: long-lived, revocable bearer tokens
  tied to a user, used to authenticate watchlist tools. New `user_api_tokens`
  table + minimal CRUD + `POST /api/tokens`, `GET /api/tokens`,
  `POST /api/tokens/:id/revoke`.
- Add a **single website page** (`/mcp`) that (a) documents the MCP server and
  the available tools, (2) lets the signed-in user create / copy / revoke
  PATs, and (3) shows copy-paste client config for Claude Desktop and Cursor.
- Update the agent-edge catalog (`src/agent-edge.mjs`) to advertise the MCP
  surface.

Non-goals:
- No write tools (add/remove/notes/tags). Phase 2.
- No MCP OAuth 2.1 dynamic-client flow. PATs cover the use case.
- No SSE streaming; tools are fast DB reads.
- No separate Worker / subdomain.
- No per-tool rate limiting (single-user, low volume; WAF can layer later).

## Capabilities

### New Capabilities
- `mcp-server`: Streamable-HTTP MCP endpoint on the Worker exposing thin
  read-only tools over existing endpoints; public tools open, watchlist tools
  gated by PAT or JWT.
- `personal-access-tokens`: Long-lived revocable bearer tokens for a user,
  with DB storage and a token-management section on the `/mcp` page.
- `mcp-page`: A public website page at `/mcp` documenting the MCP server and
  hosting token management for signed-in users.

### Modified Capabilities
<!-- None — no existing specs in openspec/specs/ yet. -->

## Impact

- **Code**:
  - `src/worker.ts` — mount `POST /api/mcp`, add PAT auth helper, add
    `/api/tokens*` routes.
  - new `src/worker/mcpRoutes.ts` — MCP server setup + tool handlers
    (thin calls into existing db/controller functions).
  - new `src/db/apiTokens.ts` — `user_api_tokens` table + CRUD.
  - new `src/validators/apiTokens.ts` — zod schemas.
  - new `src/pages/McpPage.tsx` — the `/mcp` page (docs + token management).
  - `src/router.tsx` — register the `/mcp` route.
  - `src/agent-edge.mjs` — hand-edit catalog to add the MCP surface (with a
    regen note; the file is fleet-generated).
- **Dependencies**: add `@modelcontextprotocol/sdk` (verify Workers
  compatibility first; fall back to hand-rolled JSON-RPC if needed).
- **DB**: one new table `user_api_tokens` (additive, `CREATE TABLE IF NOT
  EXISTS`). Tokens stored as SHA-256 hash; raw token returned only on
  creation.
- **Deploy**: no new Worker; `wrangler deploy` + `pnpm deploy` pick up the
  changes. No new secrets.
- **Docs**: the `/mcp` page IS the user-facing doc; add a one-line pointer
  from `docs/index.md`.
