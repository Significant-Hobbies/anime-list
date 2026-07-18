# ADR 0004 — Engagement measurement: quiz/collections funnels + homepage A/B test

- **Status:** Accepted (instrumentation shipped 2026-07-03 / 2026-07-04)
- **Date:** 2026-07-04

## Context

The quiz and collections surfaces were shipped as proofs, and PROJECT_STATUS
gates their expansion on engagement data. Without instrumentation there is
no way to decide whether to invest further or park them. The homepage quiz
CTA placement was a candidate for moving quiz discovery earlier in the funnel,
but needed a real experiment rather than a build-time guess.

## Decision

Add a fixed instrumentation layer:

- `lib/engagement.ts` — surface funnels for quiz, collections, and homepage.
- `lib/analytics.ts` — fixed 4-event fleet taxonomy
  (`signup` → `activated` → `core_action` → `returned`).
- All events route through lazy-loaded, fail-silent `posthog-js` and carry
  `project_id: "anime_list"`.

Quiz funnel: `quiz_viewed` → `quiz_started` → `quiz_completed` →
`quiz_result_shown` → `quiz_result_clicked`. **Privacy:** only the derived
archetype id is sent — never individual answers — matching the `/quiz`
"nothing is stored" promise.

Collections funnel: `collections_viewed` → `collection_created` →
`collection_share_clicked` → `collection_viewed` / `collection_public_viewed`
(with a `via_share` flag for `?ref=share` visits).

Homepage A/B test: a deterministic 50/50 cookie-based split (`ab_home`,
14-day expiry) via `homeVariant()` in `lib/flags.ts`:

- `control` — quiz CTA only in the footer.
- `treatment` — quiz CTA promoted into the hero, above the fold.

`homepage_variant_seen` fires on each homepage mount; `home_surface_click`
fires on every CTA click with `home_variant` + `placement`; every funnel
event carries `home_variant` so PostHog can split results.

Manual override: `?ff_quiz_home=1` (treatment) / `=0` (control). The
build-time `VITE_HOME_QUIZ_ABOVE_FOLD=true` forces treatment for **all**
visitors — intended for a full rollout, not the test.

## Decision rule

After a 2-week data window, compare control vs treatment on
`homepage_variant_seen` → `home_surface_click` (quiz) → `quiz_started` →
`quiz_completed` → `quiz_result_clicked` → `signup`. Keep only the winner; if
no statistically meaningful lift, keep control (less surface area) and park
the quiz-above-fold variant.

## Consequences

- Positive: expansion/parking decisions for quiz and collections are now
  evidence-gated rather than opinion-driven.
- Positive: the A/B test is live and cookie-persistent without a rebuild,
  and can be forced to treatment via a build flag for full rollout.
- Constraint: quiz events must never include individual answers — only the
  archetype id. Any future quiz expansion must preserve this.
- Follow-up: e2e coverage for the quiz/collections/auth funnels is still
  missing (see `STATUS.md`).
