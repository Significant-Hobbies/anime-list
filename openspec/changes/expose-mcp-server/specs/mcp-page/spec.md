## ADDED Requirements

### Requirement: Public MCP documentation page at /mcp
The system SHALL serve a page at the SPA route `/mcp` that documents the MCP
server: what it is, the endpoint URL (`/api/mcp`), the full tool list with
each tool's name, description, auth requirement (public vs PAT-gated), and
input shape. The page SHALL be reachable without signing in.

#### Scenario: Anonymous visitor sees docs
- **WHEN** an unauthenticated visitor navigates to `/mcp`
- **THEN** the page renders the MCP server documentation and tool list

### Requirement: Client config snippets on /mcp
The `/mcp` page SHALL include copy-paste MCP client configuration snippets
for at least Claude Desktop and Cursor, using the `mcp-remote` transport
pointing at the deployed `/api/mcp` URL with an `Authorization` header
placeholder for the PAT.

#### Scenario: Claude Desktop config shown
- **WHEN** a visitor views the `/mcp` page
- **THEN** the page displays a Claude Desktop JSON config snippet that
  includes the MCP server URL and a bearer header placeholder

### Requirement: Token management on /mcp for signed-in users
The `/mcp` page SHALL, for signed-in users, render a token management
section that lists the user's tokens (`name`, `created_at`, `last_used_at`,
`revoked_at`), allows creating a new token (showing the raw value once with a
copy control and a warning), and allows revoking a token. The raw token
SHALL NOT be re-displayed after the creation flow.

#### Scenario: Signed-in user creates a token
- **WHEN** a signed-in user creates a token named "Cursor" on `/mcp`
- **THEN** the raw token is displayed once with a copy button and a warning,
  and the token appears in the list as active

#### Scenario: Signed-in user revokes a token
- **WHEN** a signed-in user clicks revoke on an active token
- **THEN** the token is marked revoked and no longer appears as active

#### Scenario: Raw token not re-displayed
- **WHEN** the user reloads `/mcp` after creating a token
- **THEN** the raw token value is not present in the page; only metadata is
  shown

### Requirement: /mcp route registered in router
The system SHALL register the `/mcp` route in `src/router.tsx` so the page
is reachable via client-side navigation and direct URL load.

#### Scenario: Direct URL load
- **WHEN** a visitor navigates directly to `/mcp`
- **THEN** the McpPage component renders
