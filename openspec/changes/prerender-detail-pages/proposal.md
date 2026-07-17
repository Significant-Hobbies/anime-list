# Proposal: Crawlable anime/manga detail pages

## Why

The 2026-07-17 fleet GEO/SEO audit identified this as the largest raw pSEO
unlock in the fleet: `/anime/$malId` and `/manga/$malId` detail pages are
SPA-only — every crawler (Google and AI alike) sees the same empty
`index.html` shell for thousands of long-tail "«title» anime" queries. The
repo already contains the full dataset locally (`cleaned_anime_data.json`,
14,841 anime entries, plus manga), and the site is already served by a hono
worker (`src/worker.ts`) — so unique, indexable HTML per title costs no build
step and no API calls.

## What changes

- The worker intercepts GET requests for `/anime/:malId` and `/manga/:malId`
  and rewrites the SPA shell before serving it:
  - unique `<title>`, meta description, canonical, and OG tags from the
    dataset entry (title, synopsis excerpt, score, genres, image)
  - a JSON-LD block (`TVSeries`/`Movie` for anime by type, `Book` for manga)
  - a `<noscript>`-visible server-rendered summary section (title, synopsis,
    facts table) so the page has real text content, not just meta
  - unknown/invalid malId → serve the shell untouched (SPA handles 404 UX)
    with `<meta name="robots" content="noindex">`
- A compact lookup dataset (id → title/synopsis/score/genres/type/image) is
  generated at build time from the cleaned JSON and bundled with the worker
  (score/popularity-filtered to keep worker size sane; target the top ~5,000
  anime + ~2,000 manga first, threshold tunable).
- Chunked sitemaps (`/sitemap-anime-<n>.xml`, `/sitemap-manga-<n>.xml`) served
  by the worker from the same dataset, referenced from `sitemap-index.xml`
  and robots.txt. Public collections (`/c/<slug>`) join the sitemap too.

## Out of scope

- Full SSR/hydration of the React app (no framework change).
- Detail pages for titles below the popularity threshold (still SPA-served,
  noindex; threshold can move later).
- Backfilling GSC submission — separate fleet action.

## Risks

- Worker bundle size: 5–7k compact entries as bundled JSON (~2–4 MB) must stay
  under Workers limits; mitigation: strip to the 6 fields needed, measure in
  CI, fall back to KV if over.
- Duplicate-content vs MAL: synopsis excerpts are quoted from MAL data —
  keep excerpts ≤ ~300 chars, lead with our own facts markup, and canonical
  stays on our host. If Search Console later flags it, reduce excerpt length.
- HTML injection must not break the SPA: injected tags live in `<head>` +
  one `<div hidden data-ssr>` block; e2e test asserts the app still mounts.
