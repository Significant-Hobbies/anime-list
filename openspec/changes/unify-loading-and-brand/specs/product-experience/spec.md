# product-experience Delta

## MODIFIED Requirements

### Requirement: Current brand name

Current user-facing product surfaces and generated public metadata SHALL use **Anime List by Significant Hobbies** as the product name. Compact brand lockups SHALL render **Anime List** as the primary text and **by Significant Hobbies** as smaller secondary text beneath it. Historical records SHALL remain unchanged when renaming would misrepresent past wording or identifiers.

#### Scenario: Visitor sees current product identity

- **WHEN** a visitor opens a current page or generated public surface
- **THEN** the product is named Anime List by Significant Hobbies
- **AND** compact navigation and footer lockups give Anime List stronger typographic emphasis than by Significant Hobbies

#### Scenario: Visitor sees sign-in in the navbar

- **WHEN** a signed-out visitor opens a current page
- **THEN** the navbar uses Google's official compact icon control
- **AND** the control retains the popup and ITP-compatible configuration required by Safari

### Requirement: Stable loading feedback

All asynchronous user-facing routes SHALL expose accessible, representative feedback during initial loading or authentication resolution. Existing content SHALL remain visible and fully legible during background refreshes, with a non-blocking progress indication.

#### Scenario: Initial route data is loading

- **WHEN** a route is waiting for authentication or initial data
- **THEN** representative space remains reserved
- **AND** an accessible loading status is exposed

#### Scenario: Existing data is refreshing

- **WHEN** a route refreshes data that is already visible
- **THEN** the existing content remains visible and interactive where safe
- **AND** progress is communicated without dimming or replacing the content
