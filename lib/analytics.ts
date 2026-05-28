/**
 * Owner-facing analytics — the fixed 4-event taxonomy.
 *
 * Every fleet project emits exactly these four events — `signup`, `activated`,
 * `core_action`, `returned` — so a single PostHog project can build one
 * cross-fleet funnel (signup -> activated -> core_action) and a D1/D7
 * retention insight, with no custom dashboard.
 *
 * Every event carries `project_id: "anime_list"`.
 *
 * Browser-only: the anime_list app data layer is a separate Express/Hono
 * worker, not Next.js server actions — so all four events route through
 * `posthog-js` (`track`) in the browser.
 *
 *  - `signup`      — first Google sign-in for an account (a new user).
 *  - `activated`   — first real value: the user adds their first anime to
 *                    their watchlist.
 *  - `core_action` — the things the product exists to do: adding an anime to
 *                    the watchlist, or running a discovery search.
 *  - `returned`    — a later session for a user who already has prior activity.
 */
"use client";

import posthog from "posthog-js";

const PROJECT = "anime_list" as const;

/** The product-specific action behind a `core_action` event. */
export type CoreAction = "watchlist_add" | "anime_search" | "manga_search";

interface AnalyticsEventMap {
  /** First Google sign-in for an account. */
  signup: { project_id: typeof PROJECT };
  /** The user reaches first real value — their first watchlist add. */
  activated: { project_id: typeof PROJECT };
  /** The thing the product exists to do. */
  core_action: { project_id: typeof PROJECT; action: CoreAction };
  /** A return session by a user with prior activity. */
  returned: { project_id: typeof PROJECT };
}

export function trackEvent(event: string, properties: Record<string, unknown> = {}): void {
  try {
    if (typeof window === "undefined") return;
    posthog.capture(event, { project_id: PROJECT, ...properties });
  } catch {
    // Analytics must NEVER break a user flow. Swallow and move on.
  }
}

function emit<K extends keyof AnalyticsEventMap>(
  event: K,
  props: Omit<AnalyticsEventMap[K], "project_id">,
): void {
  trackEvent(event, props);
}

// localStorage keys tracking lifecycle milestones, keyed where relevant by
// the userId so signup/returned distinguish a new account from a return visit.
const SEEN_USERS_KEY = "mal:seen-users";
const ACTIVATED_USERS_KEY = "mal:activated-users";
// Per-tab guard so `returned` fires at most once per session start.
const RETURNED_FIRED_KEY = "mal:returned-fired";

function readList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function appendToList(key: string, value: string): void {
  try {
    const list = readList(key);
    if (!list.includes(value)) {
      localStorage.setItem(key, JSON.stringify([...list, value]));
    }
  } catch {
    // Non-fatal — worst case the event de-dupes on the next visit.
  }
}

/** True when this browser has already seen `userId` signed in before. */
export function hasPriorActivity(userId: string): boolean {
  return readList(SEEN_USERS_KEY).includes(userId);
}

/**
 * Fire `signup` once, on the first session we ever see for an account.
 * Returns true if the event fired (i.e. this user was brand new).
 */
export function trackSignup(userId: string): boolean {
  if (typeof window === "undefined" || hasPriorActivity(userId)) return false;
  appendToList(SEEN_USERS_KEY, userId);
  emit("signup", {});
  return true;
}

/**
 * Fire `returned` once per session start for a user with prior activity.
 * No-op for a brand-new account (that session counts as `signup`).
 */
export function trackReturned(userId: string): void {
  if (typeof window === "undefined" || !hasPriorActivity(userId)) return;
  try {
    if (sessionStorage.getItem(RETURNED_FIRED_KEY) === userId) return;
    sessionStorage.setItem(RETURNED_FIRED_KEY, userId);
  } catch {
    // sessionStorage unavailable — fall through, worst case it re-fires.
  }
  emit("returned", {});
}

/**
 * Fire `activated` once, the first time the user reaches real value.
 * `userId` may be undefined for guests; activation is only tracked per account.
 */
export function trackActivated(userId?: string | null): void {
  if (typeof window === "undefined" || !userId) return;
  if (readList(ACTIVATED_USERS_KEY).includes(userId)) return;
  appendToList(ACTIVATED_USERS_KEY, userId);
  emit("activated", {});
}

/** Fire on each completion of the core product action. */
export function trackCoreAction(action: CoreAction): void {
  emit("core_action", { action });
}
