# Design: prerender-detail-pages

## Data pipeline (build time)

`scripts/build-seo-dataset.mjs`:
- reads `cleaned_anime_data.json` / `cleaned_manga_data.json`
- filters by popularity/score threshold (config at top of script; start:
  anime `members >= N` yielding ~5k, manga ~2k)
- emits `src/data/seo-anime.json` + `src/data/seo-manga.json`, each entry:
  `{ id, title, titleEnglish?, type, synopsis (≤300 chars), score, genres,
  year?, episodes?/chapters?, image }`
- runs as a `prebuild` step; output is committed so `wrangler deploy` needs
  no extra step; CI asserts regeneration is clean (no drift).

## Worker (serve time)

In `src/worker.ts`, before SPA fallback:

```
GET /anime/:id, /manga/:id  →  lookup in seo dataset
  hit  → fetch shell index.html from ASSETS, string-replace:
         - <title> + meta description + canonical + og:/twitter: tags
           (replace the existing head block between <!-- seo:start/end -->
           markers added to index.html)
         - insert JSON-LD <script> (TVSeries/Movie/Book)
         - insert <div hidden data-ssr> summary (h1 title, synopsis excerpt,
           facts list) directly after <div id="root">
  miss → serve shell + <meta name="robots" content="noindex">
GET /sitemap-index.xml, /sitemap-anime-<n>.xml, /sitemap-manga-<n>.xml,
GET /sitemap-collections.xml → generated from the same dataset (10k locs max
per file per protocol; we chunk at 5k), Content-Type application/xml,
cache-control s-maxage=86400
```

String replacement over `<!-- seo:start/end -->` markers (added once to
`index.html`) rather than HTMLRewriter — deterministic, testable in vitest
without workerd.

Response headers: `cache-control: public, max-age=300, s-maxage=86400` on
detail-page HTML (content changes only on dataset refresh).

## JSON-LD

- anime, `type: TV/OVA/ONA/Special` → `TVSeries` (+ `numberOfEpisodes`),
  `type: Movie` → `Movie`
- manga → `Book` (`bookFormat: GraphicNovel`)
- common: `name`, `alternateName` (english title), `description`,
  `aggregateRating` (`ratingValue` = MAL score, `bestRating: 10`,
  `ratingCount` when available), `genre`, `image`, `url` (canonical)

## Robots / registry

- robots.txt gains the new sitemap lines (via apply-agent-surfaces
  `ensureRobots`, which already appends Sitemap lines idempotently).
- Note: the significanthobbies.com zone currently serves a Cloudflare
  managed AI-block robots — the zone toggle is a prerequisite for the GEO
  half of the value (tracked in the fleet audit report, action 1).

## Testing

- vitest: rewrite function — marker replacement, JSON-LD validity
  (JSON.parse), escaping of titles containing `</script>`/quotes, miss path
  gets noindex.
- e2e (playwright): `/anime/5114` serves HTML containing the title in
  `<title>` AND the app still mounts (existing detail-page e2e extended).
- size check in CI: bundled worker < 3 MB gzip (Workers paid limit 10 MB;
  headroom for growth).
