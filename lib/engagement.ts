'use client';

/**
 * Surface-engagement funnel events (quiz, collections, homepage entries).
 *
 * PROJECT_STATUS.md gates quiz/collections expansion on engagement data, so
 * these events exist to answer two questions: does the quiz convert to
 * search/detail visits, and do collection shares actually get visited?
 * The events to chart and the expand/park decision rule live in
 * PROJECT_STATUS.md ("Engagement measurement").
 *
 * All events route through `trackEvent` (lazy posthog-js, fail-silent,
 * adds `project_id`). Privacy: quiz events never include individual
 * answers — only the derived archetype id, matching the /quiz
 * "nothing is stored" promise.
 */
import { trackEvent } from '@/lib/analytics';
import { type HomeVariant, homeVariant } from '@/lib/flags';

/** Shared A/B context so every funnel event can be split by layout variant. */
function variantProps() {
  return { home_variant: homeVariant() };
}

// --- Quiz funnel: viewed -> started -> completed -> result click ---

export function trackQuizViewed(): void {
  trackEvent('quiz_viewed', variantProps());
}

/** First answer selected in a quiz session. */
export function trackQuizStarted(): void {
  trackEvent('quiz_started', variantProps());
}

/** All questions answered; only the derived archetype id is sent. */
export function trackQuizCompleted(archetype: string): void {
  trackEvent('quiz_completed', { archetype, ...variantProps() });
}

/** The complete result card is displayed to the user (fires once per session). */
export function trackQuizResultShown(archetype: string): void {
  trackEvent('quiz_result_shown', { archetype, ...variantProps() });
}

/** Clickthrough from the quiz result into search or an exemplar detail page. */
export function trackQuizResultClick(
  archetype: string,
  target: 'search' | 'exemplar_detail'
): void {
  trackEvent('quiz_result_clicked', { archetype, target, ...variantProps() });
}

// --- Collections funnel: viewed -> created -> share clicked -> shared-link visit ---

export function trackCollectionsViewed(signedIn: boolean): void {
  trackEvent('collections_viewed', { signed_in: signedIn });
}

/** A new collection was published. Fires on successful create mutation. */
export function trackCollectionCreated(slug: string, itemCount: number): void {
  trackEvent('collection_created', { slug, item_count: itemCount });
}

/** "Copy link" clicked on a collection card (the copied URL carries ?ref=share). */
export function trackCollectionShareClick(slug: string): void {
  trackEvent('collection_share_clicked', { slug });
}

/**
 * A collection page was viewed. `via_share` is true when the visit came
 * through a copied share link (?ref=share) — that subset is the
 * "shared-link visit" step of the funnel.
 */
export function trackCollectionViewed(slug: string, viaShare: boolean): void {
  trackEvent('collection_viewed', { slug, via_share: viaShare });
}

/**
 * A public collection page loaded. `via_share` is true when the visit came
 * through a copied share link (?ref=share) — that subset is the
 * "shared-link visit" step of the funnel.
 */
export function trackCollectionPublicViewed(slug: string, viaShare: boolean): void {
  trackEvent('collection_public_viewed', { slug, via_share: viaShare });
}

// --- Homepage -> surface entries ---

export type HomeSurface = 'search' | 'discover' | 'stats' | 'quiz';

export function trackHomeSurfaceClick(surface: HomeSurface, placement: string): void {
  trackEvent('home_surface_click', { surface, placement, ...variantProps() });
}

/**
 * Homepage A/B variant impression — fires once per homepage mount so
 * PostHog can build the experiment funnel (variant seen -> surface click
 * -> signup/return). Pair with the `home_variant` property on every
 * funnel event to split results by control vs treatment.
 */
export function trackHomepageVariantSeen(variant: HomeVariant): void {
  trackEvent('homepage_variant_seen', { variant });
}
