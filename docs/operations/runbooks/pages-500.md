# Runbook — Cloudflare Pages 500s

## Symptom

`anime.significanthobbies.com` (or `anime-list-9lk.pages.dev`) returns HTTP
500 "Internal Server Error". Often the latest deploy is broken while the
previous deploy works.

## Root cause patterns seen

- **OpenNext server function failure** (historical, pre-Vite migration): the
  Next.js + OpenNext server functions threw on Pages. Resolved by ADR 0001
  (Vite SPA migration) — the SPA is now a static build with no server
  functions except the Pages Functions for detail-page rewrites.
- **Bad deploy / env mismatch**: `VITE_*` client vars not set at build time,
  so the bundle calls `undefined` API URLs. The deploy workflow sets them
  explicitly; a manual `pnpm deploy` without the right env will reproduce
  this.
- **Pages Functions rewrite throwing** (current risk): a bug in
  `src/seoRewrite.ts` or the SEO dataset could 500 detail routes. The pure
  rewrite function is unit-tested; if detail routes 500 but `/` works, check
  the rewrite path and `src/data/seo-*.json`.

## Recovery

1. Confirm scope: is `/` broken or only `/anime/:id` / `/manga/:id`?
   - Only detail routes → likely Pages Functions rewrite. Roll forward a fix
     to `seoRewrite.ts` / the dataset, or temporarily disable the Functions
     to serve the plain SPA shell.
   - Everything → likely a bad deploy or platform incident.
2. Compare latest vs previous deploy in the Cloudflare Pages dashboard. If
   previous works, roll back to it while investigating.
3. For a bad-deploy/env case: rebuild with the correct `VITE_*` env (see
   [`../deploy.md`](../deploy.md)) and redeploy.
4. Check Cloudflare status page and the Pages deployment logs for the
   failing commit.

## Verification after fix

```bash
curl -I https://anime.significanthobbies.com/
curl -I https://anime.significanthobbies.com/anime/1
```

## Related

- Memory context observations `715`, `716` (2026-05-02 production 500s).
- ADR 0001 (`../../architecture/decisions/0001-vite-spa-migration.md`) for
  the OpenNext root cause that motivated the SPA migration.
- `../../knowledge/failed-approaches.md` for the Next.js + OpenNext failure.
