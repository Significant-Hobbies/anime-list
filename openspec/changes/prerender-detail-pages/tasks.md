# Tasks: prerender-detail-pages

- [ ] 1. `scripts/build-seo-dataset.mjs`: filter + compact the cleaned JSON
      into `src/data/seo-{anime,manga}.json`; pick thresholds hitting ~5k/~2k
      entries; wire as `prebuild`. Verify: deterministic re-run (empty diff),
      output size logged.
- [ ] 2. Add `<!-- seo:start/end -->` head markers + `<div id="root">` anchor
      contract to `index.html`. Verify: SPA unchanged in dev.
- [ ] 3. Implement `src/seoRewrite.ts` (pure function: shell + entry → HTML)
      with escaping; vitest unit tests incl. `</script>` injection case and
      miss→noindex.
- [ ] 4. Wire into `src/worker.ts` detail routes before SPA fallback; set
      cache-control; measure bundled worker size (<3 MB gzip).
- [ ] 5. Sitemap endpoints (index + chunked anime/manga/collections) from the
      same dataset; update robots.txt sitemap lines. Verify with the
      rewritten `agent-index-audit.mjs` (same-host loc validation).
- [ ] 6. Extend playwright e2e: detail page serves unique title AND app
      mounts; noindex on unknown id.
- [ ] 7. Deploy (manual, per fleet policy) then live-verify: curl two detail
      pages + one sitemap chunk; run `agent-index-audit.mjs --project anime-list`.
- [ ] 8. Update PROJECT_STATUS.md; archive this change. Follow-up (separate):
      GSC sitemap submission once the zone AI-block/GSC onboarding fleet
      actions land.
