## Context

Shelf's `mal-api` Worker (Hono on Cloudflare Workers) already serves the SPA
over `/api/*`. Most endpoints are public (`/api/search`, `/api/anime/:malId`,
`/api/stats`, `/api/anime/random`, `/api/fields`, `/api/filters`,
`/api/last-updated`, `/api/changelog`, and the `/api/manga/*` equivalents).
Watchlist endpoints (`/api/watchlist`, `/api/watchlist/tags`,
`/api/watchlist/enriched`, `/api/manga/watchlist`,
`/api/manga/watchlist/enriched`) are gated by Google-OAuth → HS256 JWT
(`verifyToken`, 7-day TTL, httpOnly cookie or `Authorization: Bearer`).

The user wants AI tools to query "what have I read/watched" via MCP. Since
the endpoints already exist, the MCP server is a thin tool layer that calls
the same db/controller functions the routes call — no parallel data layer.

Constraints:
- No new Worker / subdomain. Reuse `mal-api` bindings + env bridge.
- Phase 1 is read-only.
- Auth must be usable from an MCP client config (no browser redirect).
- Tokens must be revocable.
- Small change — reuse existing endpoint logic, one website page.

## Goals / Non-Goals

**Goals:**
- One MCP endpoint (`POST /api/mcp`) speaking Streamable HTTP, open for public
  tools, PAT/JWT-gated for watchlist tools.
- PAT auth that fits in an MCP client config (`Authorization: Bearer <pat>`).
- One `/mcp` website page: docs + token management.
- Agent-edge catalog advertises the MCP surface.

**Non-Goals:**
- Write tools — phase 2.
- MCP OAuth 2.1 dynamic-client flow.
- SSE streaming of long tool responses.
- Per-tool rate limiting / quotas.
- A separate Worker or custom domain.

## Decisions

### 1. Transport: MCP Streamable HTTP on `/api/mcp`
Single `POST /api/mcp` endpoint using `StreamableHTTPServerTransport` from
`@modelcontextprotocol/sdk`. Shares origin with the SPA API. The route runs
after env-bridge + DB-init middleware. MCP clients send a bearer header, not
cookies — the route ignores the `mal_auth_token` cookie.

### 2. Public tools vs auth-gated tools
The endpoint accepts unauthenticated `initialize`, `tools/list`, and calls to
public tools. Watchlist tools require a bearer token (PAT or JWT); calling
one without auth returns an MCP tool error. This mirrors the existing
endpoint posture (public vs `requireAuth`) and keeps the common case (AI
searching the catalog) frictionless.

### 3. Tool handlers reuse existing logic
Each tool handler calls the same function the corresponding route calls
(e.g. `search_anime` → `filterAnimeList` + `takePage` + `toSearchAnime`,
matching `POST /api/search`; `list_watchlist` → `getAnimeWatchlist`). No new
data layer, no subrequests. Tool list:

| Tool | Auth | Backed by |
|---|---|---|
| `search_anime` | public | `POST /api/search` logic |
| `search_manga` | public | `POST /api/manga/search` logic |
| `get_anime_detail` | public | `GET /api/anime/:malId` logic |
| `get_manga_detail` | public | `GET /api/manga/:malId` logic |
| `get_anime_stats` | public | `GET /api/stats` logic |
| `get_random_anime` | public | `GET /api/anime/random` logic |
| `list_watchlist` | PAT/JWT | `GET /api/watchlist` logic |
| `list_manga_watchlist` | PAT/JWT | `GET /api/manga/watchlist` logic |
| `list_watchlist_tags` | PAT/JWT | `GET /api/watchlist/tags` logic |
| `get_watchlist_enriched` | PAT/JWT | `GET /api/watchlist/enriched` logic |

### 4. Auth: Personal Access Tokens (PAT), hashed at rest
New `user_api_tokens` table. On create, generate `shelf_<32 random bytes
url-safe>`, return it once, store `SHA-256(token)` only. MCP middleware
hashes the incoming bearer and looks up the active token → user. JWT still
accepted as fallback (same `verifyToken`). Cookie auth deliberately rejected
on the MCP route. `last_used_at` updated best-effort via `waitUntil`.
`shelf_` prefix makes tokens greppable in secret scanners and distinct from
JWTs (`eyJ...`). Revocation = soft delete (`revoked_at`).

### 5. MCP SDK + Workers compatibility
Use `@modelcontextprotocol/sdk` (`McpServer` + `StreamableHTTPServerTransport`),
instantiated per-request. Pin a version ≥7 days old. Verify it loads under
`nodejs_compat_v2` + `compatibility_date 2024-09-23` before committing. If
the SDK's HTTP transport is incompatible with Workers request/response
shapes, fall back to a hand-rolled JSON-RPC handler (the protocol is small
for read-only tools).

### 6. One website page at `/mcp`
A single `McpPage.tsx` page, registered in `src/router.tsx` at `/mcp`,
serving both anonymous and signed-in visitors:
- **Anonymous:** documentation — what the MCP server is, the tool list, the
  endpoint URL, and copy-paste client config snippets for Claude Desktop and
  Cursor (using `mcp-remote` with the bearer header).
- **Signed-in:** the same docs PLUS a token management section — list tokens
  (name, created_at, last_used_at, revoked_at), create token (show raw value
  once with copy + warning), revoke token.

One page, one home — matches the docs "one fact, one home" rule.

### 7. Agent-edge catalog update
Hand-edit `src/agent-edge.mjs` `AGENT_SURFACE.catalog.surfaces` to add the
MCP entry (`kind: "mcp"`, `url: /api/mcp`, auth note). Add a
`TODO: regenerate via fleet agent-surface generator` comment since the file
is fleet-generated.

## Risks / Trade-offs

- **[MCP SDK Workers incompatibility]** → Verify early; fall back to
  hand-rolled JSON-RPC. Read-only tools keep the protocol surface tiny.
- **[PAT leakage]** → Hashed at rest; shown once; HTTPS-only; greppable
  prefix; revocable instantly.
- **[No rate limiting]** → Phase 1 is single-user, low volume. WAF/API
  Shield can layer later without code changes.
- **[Cookie auth collision on /api/mcp]** → MCP route uses bearer-only auth;
  ignores the cookie so browser sessions and MCP clients don't mix.
- **[DB migration]** → Single additive table, `CREATE TABLE IF NOT EXISTS`
  in the existing init-middleware pattern. Rollback = drop table.

## Migration Plan

1. Add `user_api_tokens` table to DB-init middleware. No backfill.
2. Deploy Worker — new `/api/mcp` + `/api/tokens*` routes go live; no impact
   on existing routes.
3. Deploy SPA — `/mcp` page goes live.
4. User creates a PAT on `/mcp` and adds the MCP server to their AI tool.
5. Rollback: revert deploys; the new table is unused and harmless, or can be
   dropped in a follow-up.

## Open Questions

- None material. Exact tool input schemas finalized during implementation by
  mirroring the existing endpoint validators.
