# Tasks: prerender-detail-pages

- [x] 1. `scripts/build-seo-dataset.mjs`: filter + compact the cleaned JSON
      into `src/data/seo-{anime,manga}.json`; pick thresholds hitting ~5k/~2k
      entries; wire as `prebuild`. Verify: deterministic re-run (empty diff),
      output size logged.
- [x] 2. Add `<!-- seo:start/end -->` head markers + `<div id="root">` anchor
      contract to `index.html`. Verify: SPA unchanged in dev.
- [x] 3. Implement `src/seoRewrite.ts` (pure function: shell + entry → HTML)
      with escaping; vitest unit tests incl. `</script>` injection case and
      miss→noindex.
- [x] 4. Wire into Pages Functions (`functions/anime/[malId].ts`,
      `functions/manga/[malId].ts`) — the SPA is on Cloudflare Pages, not the
      Worker; Pages Functions are the native server-side layer. Set
      cache-control; verified locally with `wrangler pages dev`.
- [x] 5. Sitemap endpoints (index + chunked anime/manga) from the same
      dataset; update robots.txt sitemap lines. Generated as static files
      at build time (`scripts/build-sitemaps.mjs`, postbuild step).
- [x] 6. Extend playwright e2e: detail page serves unique title AND app
      mounts; noindex on unknown id.
- [ ] 7. Deploy (manual, per fleet policy) then live-verify: curl two detail
      pages + one sitemap chunk; run `agent-index-audit.mjs --project anime-list`.
- [ ] 8. Update PROJECT_STATUS.md; archive this change. Follow-up (separate):
      GSC sitemap submission once the zone AI-block/GSC onboarding fleet
      actions land.
