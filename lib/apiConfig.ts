export const PRODUCTION_API_URL = 'https://mal-api.sarthakagrawal927.workers.dev';
export const LOCAL_API_URL = 'http://localhost:8787';
export const SAME_ORIGIN_API_URL = '';

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function getApiUrl(hostname?: string): string {
  const configuredUrl = import.meta.env.VITE_API_URL?.trim();
  if (configuredUrl) {
    return stripTrailingSlash(configuredUrl);
  }

  const currentHostname =
    hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '');
  if (import.meta.env.DEV && isLocalHostname(currentHostname)) {
    return LOCAL_API_URL;
  }

  // Deployed browsers call /api on the Pages origin. The Pages function
  // forwards that request to the Worker, keeping auth cookies first-party and
  // avoiding a CORS preflight for JSON POST requests.
  return SAME_ORIGIN_API_URL;
}
