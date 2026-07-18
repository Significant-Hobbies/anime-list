## ADDED Requirements

### Requirement: MCP endpoint speaks Streamable HTTP
The system SHALL expose `POST /api/mcp` on the `mal-api` Worker implementing
the MCP Streamable HTTP transport with JSON-RPC 2.0. Non-POST methods SHALL
return HTTP 405.

#### Scenario: Valid initialize request (no auth)
- **WHEN** a client sends `POST /api/mcp` with an MCP `initialize` request
  and no `Authorization` header
- **THEN** the system responds with a valid `InitializeResult` advertising
  the server name, protocol version, and tool capabilities

#### Scenario: Wrong HTTP method
- **WHEN** a client sends `GET /api/mcp`
- **THEN** the system responds with HTTP 405

### Requirement: Public tools work without auth
The system SHALL allow unauthenticated calls to the public tools
(`search_anime`, `search_manga`, `get_anime_detail`, `get_manga_detail`,
`get_anime_stats`, `get_random_anime`) and to `tools/list`. The endpoint
SHALL NOT accept the `mal_auth_token` cookie as authentication for any MCP
call.

#### Scenario: Public tool without auth
- **WHEN** a client calls `tools/call` with `name: "search_anime"` and no
  `Authorization` header
- **THEN** the system executes the tool and returns results

#### Scenario: Cookie-only auth rejected
- **WHEN** a request has a valid `mal_auth_token` cookie but no
  `Authorization` header
- **THEN** watchlist tools fail authentication, but public tools still work

### Requirement: Watchlist tools require a bearer token
The system SHALL require an `Authorization: Bearer <token>` header for the
watchlist tools (`list_watchlist`, `list_manga_watchlist`,
`list_watchlist_tags`, `get_watchlist_enriched`). The token SHALL be a valid
PAT or a valid existing JWT. Calls without a bearer header, or with an
invalid/revoked token, SHALL return an MCP tool error indicating
authentication is required.

#### Scenario: Watchlist tool without auth
- **WHEN** a client calls `tools/call` with `name: "list_watchlist"` and no
  `Authorization` header
- **THEN** the system returns an MCP error indicating authentication is
  required

#### Scenario: Revoked PAT on watchlist tool
- **WHEN** a client calls a watchlist tool with a bearer token whose hash
  matches a PAT with a non-null `revoked_at`
- **THEN** the system returns an MCP error indicating authentication is
  required

### Requirement: search_anime tool
The system SHALL expose `search_anime` taking the same filter payload shape
as `POST /api/search` (filters, sortBy, airing, pagesize, offset) and
returning the same result shape (`{ totalFiltered, filteredList }`). The
tool SHALL be public.

#### Scenario: Filtered search
- **WHEN** the tool is called with a valid filter payload
- **THEN** the system returns `totalFiltered` and a `filteredList` of anime
  summaries, matching the `/api/search` response shape

### Requirement: search_manga tool
The system SHALL expose `search_manga` taking the same payload shape as
`POST /api/manga/search` and returning the same result shape. Public.

#### Scenario: Filtered manga search
- **WHEN** the tool is called with a valid manga filter payload
- **THEN** the system returns manga summaries matching the
  `/api/manga/search` response shape

### Requirement: get_anime_detail tool
The system SHALL expose `get_anime_detail` taking `{ mal_id }` and returning
the same shape as `GET /api/anime/:malId` (without per-user watchlist state
when unauthenticated). Public. Returns `null` if the `mal_id` is absent.

#### Scenario: Known mal_id
- **WHEN** the tool is called with `{ mal_id: 1 }`
- **THEN** the system returns the full anime detail object

#### Scenario: Unknown mal_id
- **WHEN** the tool is called with `{ mal_id: 0 }`
- **THEN** the system returns `null`

### Requirement: get_manga_detail tool
The system SHALL expose `get_manga_detail` taking `{ mal_id }` and returning
the same shape as `GET /api/manga/:malId`. Public. Returns `null` if absent.

#### Scenario: Known mal_id
- **WHEN** the tool is called with `{ mal_id: 1 }`
- **THEN** the system returns the full manga detail object

### Requirement: get_anime_stats tool
The system SHALL expose `get_anime_stats` returning the same shape as
`GET /api/stats`. Public. Takes no required input.

#### Scenario: Stats returned
- **WHEN** the tool is called
- **THEN** the system returns the anime catalog stats object

### Requirement: get_random_anime tool
The system SHALL expose `get_random_anime` taking an optional `{ genre?,
limit? }` and returning the same shape as `GET /api/anime/random`. Public.
`limit` SHALL be clamped to [1, 20].

#### Scenario: Random pick
- **WHEN** the tool is called with no input
- **THEN** the system returns at least one random anime summary

### Requirement: list_watchlist tool
The system SHALL expose `list_watchlist` (auth-gated) returning the
authenticated user's anime watchlist in the same shape as
`GET /api/watchlist` (`{ user, anime }`).

#### Scenario: User has watched anime
- **WHEN** an authenticated user calls the tool
- **THEN** the system returns `{ user, anime }` with one entry per
  `anime_watchlist` row

### Requirement: list_manga_watchlist tool
The system SHALL expose `list_manga_watchlist` (auth-gated) returning the
authenticated user's manga watchlist in the same shape as
`GET /api/manga/watchlist`.

#### Scenario: User has watched manga
- **WHEN** an authenticated user calls the tool
- **THEN** the system returns the user's manga watchlist

### Requirement: list_watchlist_tags tool
The system SHALL expose `list_watchlist_tags` (auth-gated) returning the
authenticated user's tags in the same shape as `GET /api/watchlist/tags`.

#### Scenario: User has tags
- **WHEN** an authenticated user calls the tool
- **THEN** the system returns the tags ordered by count descending then name
  ascending

### Requirement: get_watchlist_enriched tool
The system SHALL expose `get_watchlist_enriched` (auth-gated) returning the
authenticated user's enriched watchlist in the same shape as
`GET /api/watchlist/enriched` (`{ items }`).

#### Scenario: Enriched watchlist
- **WHEN** an authenticated user calls the tool
- **THEN** the system returns `{ items }` with each watchlist entry joined
  to its catalog metadata (title, image, score, etc.)

### Requirement: All MCP tools are read-only
The system SHALL NOT expose any MCP tool that mutates state in phase 1.

#### Scenario: No write tools advertised
- **WHEN** an authenticated `tools/list` request is sent
- **THEN** the response contains only read-only tools

### Requirement: Agent-edge catalog advertises MCP
The system SHALL include the MCP endpoint in the agent-edge catalog
(`/api/ai`) with `kind: "mcp"` and the `/api/mcp` URL.

#### Scenario: Catalog includes MCP surface
- **WHEN** a client fetches `GET /api/ai`
- **THEN** the `surfaces` array contains an entry with `kind: "mcp"` and a
  `url` ending in `/api/mcp`
