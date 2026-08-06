# Streamline Anime List experience

## Why

The deployed application has accumulated overlapping product surfaces and avoidable operational friction. Catalog refresh workflows can report success after fetching no data, Safari treats authentication as third-party because the SPA and API use different origins, and search latency is obscured by cross-origin preflights, cold catalog loads, and repeated short-lived queries.

## What changes

- Retire Alerts and Collections from runtime routes, navigation, APIs, and current product messaging without deleting their D1 tables.
- Combine the seasonal discovery queue and taste quiz under Discover, retaining `/quiz` only as a compatibility entry.
- Promote catalog updates in the primary navigation and keep the product changelog off the primary path.
- Rename current product surfaces to **Anime List by Significant Hobbies**.
- Replace abrupt route and discovery loading blanks with stable skeleton states.
- Route deployed browser API calls through the Pages origin so authentication is first-party in Safari and requests avoid CORS preflights.
- Deduplicate identical in-flight searches and keep previous results visible while a changed search loads.
- Expand bounded SQL search beyond numeric-only filters so common text, genre, type, season, and airing searches do not load and scan the full catalog.
- Make catalog update scripts fail when required upstream fetches return no usable rows.

## Scope

In scope: SPA routes and copy, browser API transport, Worker search execution, catalog update script integrity, tests, docs, and local performance verification.

Out of scope: deleting retired D1 data, changing secrets, editing production Cloudflare configuration, deploying, migrating, or releasing.

## Deploy impact

Pages and Worker code must ship together for the same-origin API transport and expanded search path. Existing direct Worker clients remain compatible. No database migration is required.
