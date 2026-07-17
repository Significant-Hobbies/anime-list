# Spec: detail-page-indexing

## ADDED Requirements

### Requirement: Unique crawlable HTML per popular title

Detail routes for titles in the SEO dataset SHALL serve HTML with a unique
title, meta description, canonical URL, JSON-LD, and visible-to-crawler text
content, without breaking SPA hydration.

#### Scenario: popular anime detail page

- GIVEN an anime in the SEO dataset (e.g. malId 5114)
- WHEN a client GETs /anime/5114
- THEN the response HTML contains the anime's name in `<title>`, a JSON-LD
  block that parses and names the title, a canonical to the request URL, and
  the React app still mounts on load

#### Scenario: below-threshold or invalid id

- GIVEN a malId not in the SEO dataset
- WHEN a client GETs /anime/999999999
- THEN the response is the SPA shell with `<meta name="robots" content="noindex">`
  and no JSON-LD

### Requirement: Sitemaps cover the SEO dataset

The worker SHALL serve chunked XML sitemaps enumerating exactly the SEO
dataset detail URLs plus public collections, referenced from the sitemap
index and robots.txt, with all `<loc>` entries on the canonical host.

#### Scenario: sitemap chunk

- GIVEN the SEO dataset contains 5,000 anime
- WHEN a client GETs /sitemap-anime-1.xml
- THEN the response is valid XML with ≤5,000 same-host `<loc>` entries and
  Content-Type application/xml

### Requirement: Dataset generation is deterministic

The build script SHALL regenerate the committed SEO dataset deterministically
from the cleaned JSON sources.

#### Scenario: CI drift check

- GIVEN a clean checkout
- WHEN the build script runs
- THEN `git diff` on the generated dataset files is empty
