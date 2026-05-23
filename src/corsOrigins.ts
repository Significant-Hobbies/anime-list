const STATIC_ALLOWED_ORIGINS = new Set([
  "https://anime-list-web.sarthakagrawal927.workers.dev",
  "https://anime-list-9lk.pages.dev",
  "http://localhost:3000",
]);

const PAGES_PREVIEW_ORIGIN = /^https:\/\/[a-z0-9-]+\.anime-list-9lk\.pages\.dev$/;

export function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return false;
  return STATIC_ALLOWED_ORIGINS.has(origin) || PAGES_PREVIEW_ORIGIN.test(origin);
}
