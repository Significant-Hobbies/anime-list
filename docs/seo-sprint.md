# Anime List SEO sprint roadmap

Satellite playbook (see `saas-maker/tooling/skills/seo-sprint`). Baseline
(28d ending 2026-09-18): **20,649 imp · 25 clicks · pos 63 · 3 indexed /
7,604 pending** — huge surface, deepest position problem in the fleet.

## Evidence

Queries are long-tail anime/manga titles ("negai wo kanaete…", "isekai
kenkokuki", "koisuru boukun") — searchers looking up a specific title. Google
already shows our title pages 20k times but ranks us page 6+, which means the
pages are discoverable and *lose on quality*, not on discovery.

## Phases

- [ ] **Phase 1 — title-page depth.** Every `/…/<title>` page gets synopsis,
  genres/themes, score, airing/serialization status, similar titles, and
  "where it sits in the catalog" context — real MAL/Jikan fields we already
  sync. Thin catalog pages are why pos sits at 63; this phase is the whole
  game. Sample 10 pages, deepen the template, verify with `seo-audit`.
- [ ] **Phase 2 — browse pages.** Genre × year × season landing pages
  ("isekai anime 2026", "spring 2026 anime schedule") from existing data —
  zero new data needed, just new aggregations.
- [ ] **Phase 3 — "anime like X" recommendation pages** for the top ~200
  titles by impression share — highest-intent query class after title lookups.
- [ ] **Phase 4 — indexing.** The daily agent is churning the 7.6k backlog
  (~2k/property/day). Track `indexing status --project anime-list` weekly;
  pages landing "Discovered — currently not indexed" go back to Phase 1's
  template fix.

## Rules

- Page quality before page count — 7.6k thin pages is why we're at pos 63.
- Register each phase: `seo-scoreboard.mjs register --project anime-list
  --lane programmatic --summary "…"`.
