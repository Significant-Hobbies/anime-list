# Runbook — MAL CDN image 403s

## Symptom

Anime/manga poster images (served from `cdn.myanimelist.net`) return HTTP
403 to the browser, so cards render with broken/placeholder images. This is
a **recurring operational risk** tracked in `STATUS.md`.

## Root cause

MAL's CDN periodically tightens hotlinking / referer / UA policy, blocking
third-party sites that embed poster URLs directly. We do not control the CDN.

## Mitigations

- **Do not** mirror or proxy images through the worker without an explicit
  decision — it moves bandwidth/cost into the worker and can still be blocked
  upstream.
- Prefer client-side graceful degradation: broken images fall back to a
  branded placeholder (see card components in `components/`).
- If a fleet CDN proxy / image cache is introduced, route posters through it
  and update the card components to use the proxied URL.

## Verification

- `curl -I https://cdn.myanimelist.net/images/anime/<...>.webp` from a
  browser-like UA + referer to confirm whether the block is referer-based.
- Check a known-good image id in prod vs. local to distinguish a CDN-wide
  block from a per-path issue.

## Related

- Memory context observations `715`, `716`, `721` (production 500s and MAL
  CDN 403s, 2026-05-02) — see `AGENTS.md` memory section for access.
- `STATUS.md` lists this as a recurring operational risk.
