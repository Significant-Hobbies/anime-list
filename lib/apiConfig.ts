export const PRODUCTION_API_URL = "https://mal-api.sarthakagrawal927.workers.dev";
export const LOCAL_API_URL = "http://localhost:8787";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function getApiUrl(hostname?: string): string {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configuredUrl) {
    return stripTrailingSlash(configuredUrl);
  }

  const currentHostname = hostname ?? (typeof window !== "undefined" ? window.location.hostname : "");
  if (process.env.NODE_ENV !== "production" && isLocalHostname(currentHostname)) {
    return LOCAL_API_URL;
  }

  return PRODUCTION_API_URL;
}
