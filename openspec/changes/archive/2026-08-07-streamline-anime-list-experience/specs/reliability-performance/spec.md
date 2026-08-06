# Reliability and performance specification

## ADDED Requirements

### Requirement: First-party browser API

Deployed browser requests SHALL use same-origin `/api/*` URLs and SHALL forward to the existing API Worker without losing method, body, authentication cookie, response status, `Set-Cookie`, or diagnostic timing headers. Local development and explicit API URL overrides SHALL continue to work.

#### Scenario: Safari signs in

- **WHEN** Safari posts a valid Google credential through `/api/auth/google`
- **THEN** the authentication cookie is set for the application origin and is included on later `/api/*` requests

#### Scenario: Browser searches

- **WHEN** the deployed browser posts `/api/search`
- **THEN** the request does not require a cross-origin CORS preflight

### Requirement: Bounded common searches

Common non-weighted anime searches using numeric, title, genre, theme, demographic, type, season, or airing filters SHALL execute as bounded parameterized D1 queries rather than loading the full catalog into Worker memory. Unsupported weighted behavior SHALL retain the existing fallback.

#### Scenario: Title and genre search

- **WHEN** a visitor searches by title and genre
- **THEN** the Worker returns the count and requested page through the SQL search path

### Requirement: Duplicate search suppression

Identical in-flight search requests SHALL share one browser fetch. A superseded query SHALL not replace the newest query result.

#### Scenario: Components request the same search

- **WHEN** two callers request an identical search before the first completes
- **THEN** exactly one network fetch is made and both callers receive its result

### Requirement: Honest catalog refresh failures

Scheduled catalog update commands SHALL exit non-zero when a required upstream catalog fetch produces zero usable rows. They SHALL not publish a success summary for that condition.

#### Scenario: Jikan fails every page

- **WHEN** a required daily anime or manga fetch returns no usable records
- **THEN** the update command fails and the workflow is visibly unsuccessful
