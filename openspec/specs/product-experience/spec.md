# product-experience Specification

## Purpose
TBD - created by archiving change streamline-anime-list-experience. Update Purpose after archive.
## Requirements
### Requirement: Focused current feature set

The application SHALL omit Alerts and Collections from current runtime routes, navigation, browser API clients, Worker endpoints, and current product claims. The system SHALL preserve existing database tables and records for reversible retirement.

#### Scenario: Visitor checks navigation

- **WHEN** a visitor opens the application navigation
- **THEN** no Alerts or Collections destination is shown

#### Scenario: Retired data remains intact

- **WHEN** the runtime retirement is applied
- **THEN** no migration deletes alert, saved-search, collection, or collection-item data

### Requirement: Unified discovery

The `/discover` surface SHALL provide both the weekly discovery queue and taste quiz in one clearly switchable section. The legacy `/quiz` route SHALL lead users into the unified quiz panel.

#### Scenario: Visitor switches discovery mode

- **WHEN** a visitor chooses Taste quiz on `/discover`
- **THEN** the quiz renders in the same discovery section without a separate primary navigation item

### Requirement: Catalog history in primary navigation

The primary navigation SHALL link to `/catalog-updates` as **Catalog updates** and SHALL NOT promote the product changelog.

#### Scenario: Visitor wants recent catalog changes

- **WHEN** a visitor selects Catalog updates
- **THEN** the catalog ingestion history is displayed

### Requirement: Current brand name

Current user-facing product surfaces and generated public metadata SHALL use **Anime List by Significant Hobbies**. Historical records SHALL remain unchanged when renaming would misrepresent past wording or identifiers.

#### Scenario: Visitor sees current product identity

- **WHEN** a visitor opens a current page or generated public surface
- **THEN** the product is named Anime List by Significant Hobbies

### Requirement: Stable loading feedback

Data-heavy routes SHALL reserve representative space and expose accessible loading status while their initial data loads. Existing results SHALL remain visible during background search refreshes.

#### Scenario: Search data is loading

- **WHEN** a search route or changed query is waiting for data
- **THEN** representative space remains reserved and prior results remain visible when available

