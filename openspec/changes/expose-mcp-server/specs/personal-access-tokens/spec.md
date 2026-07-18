## ADDED Requirements

### Requirement: Personal Access Token storage
The system SHALL store PATs in a `user_api_tokens` table with columns: `id`
(TEXT PK), `user_id` (TEXT NOT NULL), `name` (TEXT NOT NULL), `token_hash`
(TEXT NOT NULL, unique), `last_used_at` (TEXT, nullable), `created_at` (TEXT
NOT NULL default now), `revoked_at` (TEXT, nullable). The system SHALL store
only the SHA-256 hash of the raw token; the raw token SHALL NOT be persisted.

#### Scenario: Token is hashed before storage
- **WHEN** a user creates a PAT with raw value `shelf_abc...`
- **THEN** the stored row has `token_hash` equal to the SHA-256 hex digest of
  `shelf_abc...` and no column contains the raw token

### Requirement: Token format
The system SHALL generate PATs with the prefix `shelf_` followed by at least
32 bytes of cryptographically random data encoded URL-safe. Total length
SHALL be at least 40 characters.

#### Scenario: Generated token shape
- **WHEN** the system generates a new PAT
- **THEN** the token starts with `shelf_` and is at least 40 characters long

### Requirement: Create token endpoint
The system SHALL expose `POST /api/tokens` (authenticated via the existing
JWT `requireAuth` middleware) accepting `{ name }` and returning
`{ token, id, name, created_at }` with the raw token shown exactly once.

#### Scenario: Successful creation
- **WHEN** an authenticated user posts `{ name: "Claude Desktop" }`
- **THEN** the system responds 200 with `{ token, id, name, created_at }` and
  persists a row with the hash of that token

#### Scenario: Name required
- **WHEN** an authenticated user posts `{}`
- **THEN** the system responds 400 with a validation error

#### Scenario: Unauthenticated
- **WHEN** a request has no valid JWT
- **THEN** the system responds 401

### Requirement: List tokens endpoint
The system SHALL expose `GET /api/tokens` (authenticated via `requireAuth`)
returning `[{ id, name, created_at, last_used_at, revoked_at }]` for the
caller. The response SHALL NOT include raw tokens or hashes.

#### Scenario: List returns metadata only
- **WHEN** an authenticated user requests `GET /api/tokens`
- **THEN** the response contains only `id`, `name`, `created_at`,
  `last_used_at`, and `revoked_at`

#### Scenario: Only the caller's tokens
- **WHEN** user A requests `GET /api/tokens`
- **THEN** the response contains only tokens where `user_id` equals user A

### Requirement: Revoke token endpoint
The system SHALL expose `POST /api/tokens/:id/revoke` (authenticated via
`requireAuth`) setting `revoked_at` on the matching row owned by the caller.
Revoking an already-revoked token SHALL be a no-op (200). Revoking another
user's token SHALL respond 404.

#### Scenario: Revoke own active token
- **WHEN** user A posts to `/api/tokens/<id>/revoke` for an active token they
  own
- **THEN** the system sets `revoked_at` and responds 200

#### Scenario: Revoke another user's token
- **WHEN** user A posts to `/api/tokens/<id>/revoke` for a token owned by
  user B
- **THEN** the system responds 404 and does not modify the row

#### Scenario: Revoke already-revoked token
- **WHEN** user A posts to `/api/tokens/<id>/revoke` for a token they own
  that already has `revoked_at` set
- **THEN** the system responds 200 and leaves `revoked_at` unchanged

### Requirement: PAT authentication resolves a user
The system SHALL provide a helper that, given a bearer token starting with
`shelf_`, computes its SHA-256 hash and looks up an active row
(`revoked_at IS NULL`) in `user_api_tokens`. If found, the request is
authenticated as that row's `user_id` and `last_used_at` is updated
best-effort. If not found, authentication fails.

#### Scenario: Valid active PAT
- **WHEN** a request presents `Authorization: Bearer shelf_valid...` whose
  hash matches an active row
- **THEN** the request is authenticated as the row's `user_id` and
  `last_used_at` is updated

#### Scenario: PAT with unknown hash
- **WHEN** a request presents a `shelf_`-prefixed token whose hash matches no
  row
- **THEN** authentication fails
