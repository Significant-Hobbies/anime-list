# Unify loading feedback and clarify the Anime List brand

## Why

The application is materially faster, but its waiting states still feel uneven. Some routes reserve useful layout, some show generic blocks or text, and auth-gated routes briefly render nothing. The full product name also lacks hierarchy in the navigation.

## What changes

- Keep **Anime List by Significant Hobbies** as the current product name across the application and generated public metadata.
- Render **Anime List** as the primary typographic mark and **by Significant Hobbies** at a smaller size in compact brand lockups.
- Use the compact official Google icon button so Safari-compatible sign-in does not dominate the navbar.
- Introduce a shared, accessible loading vocabulary for route transitions, catalog grids, lists, statistics, and compact sections.
- Preserve visible data during background refreshes and indicate progress without fading or blocking the page.
- Replace blank auth-resolution states with representative page skeletons.

## Scope

In scope: product-name hierarchy, the official Google button presentation, shared loading primitives, route and data-loading surfaces, tests, and responsive browser verification.

Out of scope: a new visual identity, route restructuring, backend changes, database changes, and deployment.

## Deploy impact

Pages-only release. No Worker or database change is required.
