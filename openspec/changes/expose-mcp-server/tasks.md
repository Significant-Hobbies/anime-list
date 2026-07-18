## 1. Dependency & compatibility verification

- [ ] 1.1 Check the latest stable `@modelcontextprotocol/sdk` version released ≥7 days ago; confirm it ships `McpServer` + `StreamableHTTPServerTransport`
- [ ] 1.2 `pnpm add @modelcontextprotocol/sdk` and `pnpm install`
- [ ] 1.3 Smoke-test the SDK under `nodejs_compat_v2` + `compatibility_date 2024-09-23`: write a minimal Worker route answering `initialize` and run `pnpm dev:be` + a curl JSON-RPC call. If it fails, switch to hand-rolled JSON-RPC fallback and record the decision in `design.md`
- [ ] 1.4 `pnpm build` and `pnpm test` to confirm no regressions from the new dep

## 2. Personal Access Tokens — DB layer

- [ ] 2.1 Create `src/db/apiTokens.ts` with `initApiTokensTable()` (`CREATE TABLE IF NOT EXISTS user_api_tokens` + index on `user_id` + unique on `token_hash`)
- [ ] 2.2 `createApiToken(userId, name)` → generate `shelf_<32 random bytes url-safe>`, hash SHA-256, insert, return `{ token, id, name, created_at }`
- [ ] 2.3 `listApiTokens(userId)` → metadata only
- [ ] 2.4 `revokeApiToken(userId, id)` → set `revoked_at` only if owned; return `{ revoked, notFound }`
- [ ] 2.5 `resolveApiToken(rawToken)` → hash, lookup active row, return `{ userId, tokenId } | null`
- [ ] 2.6 `touchApiTokenLastUsed(tokenId)` → best-effort update
- [ ] 2.7 Add `initApiTokensTable()` to the DB-init middleware in `src/worker.ts`
- [ ] 2.8 Vitest unit test for the token DB module (create/list/revoke/resolve/hash-uniqueness)

## 3. Personal Access Tokens — API routes

- [ ] 3.1 Create `src/validators/apiTokens.ts` (`createTokenSchema`, `revokeTokenParamsSchema`)
- [ ] 3.2 Add `POST /api/tokens` (requireAuth) → create + return raw token once
- [ ] 3.3 Add `GET /api/tokens` (requireAuth) → list metadata only
- [ ] 3.4 Add `POST /api/tokens/:id/revoke` (requireAuth) → revoke; 404 if not owned; 200 if already revoked
- [ ] 3.5 Vitest unit test for the three routes (auth required, validation, ownership 404, idempotent revoke)

## 4. MCP auth helper

- [ ] 4.1 Add `verifyMcpBearer(c)` in `src/worker.ts` (or `src/worker/mcpAuth.ts`): read `Authorization: Bearer`, branch on `shelf_` prefix → `resolveApiToken` + `touchApiTokenLastUsed`, else → existing `verifyToken`. Returns `AuthPayload | null`. Ignores cookie.
- [ ] 4.2 Unit test: PAT resolves, JWT resolves, cookie-only → null, revoked PAT → null, unknown `shelf_` → null

## 5. MCP server — tool handlers

- [ ] 5.1 Create `src/worker/mcpRoutes.ts` exporting `handleMcpRequest(request, env, ctx)` building a per-request `McpServer` + `StreamableHTTPServerTransport`
- [ ] 5.2 Register public tools: `search_anime`, `search_manga`, `get_anime_detail`, `get_manga_detail`, `get_anime_stats`, `get_random_anime` — each calls the same db/controller function the corresponding route uses
- [ ] 5.3 Register auth-gated tools: `list_watchlist`, `list_manga_watchlist`, `list_watchlist_tags`, `get_watchlist_enriched` — each requires the resolved user; returns MCP error if absent
- [ ] 5.4 Ensure all tools are read-only and return MCP-compliant errors on bad input
- [ ] 5.5 Unit test each tool handler (mock db modules) — happy path + one edge case

## 6. MCP route mounting

- [ ] 6.1 In `src/worker.ts`, add `app.post('/api/mcp', ...)` calling `handleMcpRequest`; pass the resolved user (from `verifyMcpBearer`) through to handlers
- [ ] 6.2 Add 405 for non-POST on `/api/mcp`
- [ ] 6.3 Confirm route runs after env-bridge + DB-init; not blocked by cookie/CORS logic
- [ ] 6.4 Manual e2e: `pnpm dev:be`, create PAT via curl, send `initialize` + `tools/list` + `tools/call search_anime` (no auth) + `tools/call list_watchlist` (with PAT)

## 7. /mcp website page

- [ ] 7.1 Create `src/pages/McpPage.tsx`: docs section (what is MCP, endpoint URL, tool list with auth requirement + input shape, copy-paste config for Claude Desktop + Cursor using `mcp-remote`)
- [ ] 7.2 Add token management section for signed-in users: list, create (show raw once + copy + warning), revoke
- [ ] 7.3 Register `/mcp` route in `src/router.tsx` (rootRoute child, like `/about`)
- [ ] 7.4 Add a link to `/mcp` from the site footer / About page so it's discoverable
- [ ] 7.5 Manual check in `pnpm dev:fe`: anonymous sees docs; signed-in sees docs + token management; create/copy/revoke/reload flow works

## 8. Agent-edge catalog update

- [ ] 8.1 Hand-edit `src/agent-edge.mjs` `AGENT_SURFACE.catalog.surfaces` to add `{ id: "mcp", kind: "mcp", url: "/api/mcp", description, auth note }` + a `TODO: regenerate via fleet agent-surface generator` comment
- [ ] 8.2 Verify `GET /api/ai` locally returns the new surface entry

## 9. Docs pointer

- [ ] 9.1 Add a one-line pointer from `docs/index.md` to the `/mcp` page (one fact, one home — the page is the canonical doc)
- [ ] 9.2 Run `node scripts/check-docs.mjs` and fix any complaints
- [ ] 9.3 Update `STATUS.md` / `PROJECT_STATUS.md` to reflect the new MCP capability (status: in progress; flip to shipped at archive)

## 10. Verification & ship prep

- [ ] 10.1 `pnpm test` — all unit tests green
- [ ] 10.2 `pnpm build` — SPA builds, no type errors
- [ ] 10.3 `pnpm dev` end-to-end: create PAT on `/mcp` → use from a real MCP client (Claude Desktop or `mcp-remote`) → confirm `list_watchlist` returns the user's data
- [ ] 10.4 Grep repo for `shelf_` to ensure no real token leaked into code or docs
- [ ] 10.5 `openspec validate expose-mcp-server`
- [ ] 10.6 Stage all changes; do NOT deploy until user confirms
