'use client';

/**
 * Homepage A/B test — quiz CTA above the fold.
 *
 * Two variants:
 *  - `control`    — the current homepage (quiz CTA only in the footer area).
 *  - `treatment`  — a quiz CTA promoted into the hero, above the fold.
 *
 * Assignment is a deterministic 50/50 split persisted in a first-party cookie
 * (`ab_home`, 14-day expiry — matches the 2-week measurement window in
 * PROJECT_STATUS.md) so a visitor stays in the same variant across sessions.
 * Every funnel event carries the variant via `variantProps()` in
 * `lib/engagement.ts`, and `homepage_variant_seen` fires on each homepage
 * mount so PostHog can build the experiment funnel.
 *
 * Manual override without a rebuild (e.g. on a PR preview): land on the
 * homepage with `?ff_quiz_home=1` (forces treatment) or `=0` (forces
 * control). The build-time `VITE_HOME_QUIZ_ABOVE_FOLD=true` env forces
 * treatment for every visitor (use for a full rollout, not the test).
 */
export type HomeVariant = 'control' | 'treatment';

const AB_COOKIE = 'ab_home';
const AB_COOKIE_DAYS = 14;

function readCookie(name: string): string | undefined {
  try {
    const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
    return match?.split('=')[1];
  } catch {
    return undefined;
  }
}

function writeCookie(name: string, value: string, days: number): void {
  try {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
  } catch {
    // Cookie writes can fail in restrictive iframe contexts — fall back to
    // a per-session random pick (no persistence, but the test still runs).
  }
}

/**
 * Resolve the homepage variant for the current visitor.
 *
 * Precedence: URL override > build-time env > persistent cookie > fresh
 * 50/50 assignment (which is then persisted).
 */
export function homeVariant(): HomeVariant {
  if (typeof window === 'undefined') return 'control';
  try {
    const override = new URLSearchParams(window.location.search).get('ff_quiz_home');
    if (override === '1') return 'treatment';
    if (override === '0') return 'control';

    if (import.meta.env.VITE_HOME_QUIZ_ABOVE_FOLD === 'true') return 'treatment';

    const existing = readCookie(AB_COOKIE);
    if (existing === 'control' || existing === 'treatment') return existing;

    const variant: HomeVariant = Math.random() < 0.5 ? 'control' : 'treatment';
    writeCookie(AB_COOKIE, variant, AB_COOKIE_DAYS);
    return variant;
  } catch {
    return 'control';
  }
}

/** True when the homepage should show the quiz CTA above the fold (treatment). */
export function homeQuizAboveFold(): boolean {
  return homeVariant() === 'treatment';
}
