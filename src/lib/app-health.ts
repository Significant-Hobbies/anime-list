// App-Health endpoint telemetry: per-route method/status/duration shipped to
// the ingest collector. Dependency-free — the ingest wire format is a single
// POST. Silent no-op until APP_HEALTH_INGEST_KEY is set (secret, not vars: a
// same-name vars entry replaces the secret on deploy). Telemetry can never
// fail a request. Paths collapse to route templates — raw MAL ids and token
// ids never leave the worker.

const INGEST_ENDPOINT = 'https://ingest.sassmaker.com/v1/ingest';

// MAL ids and token ids are numeric; collapse digit-only segments.
function routeFor(pathname: string): string | null {
  const p = pathname.replace(/\/+$/, '') || '/';
  const normalized = p
    .split('/')
    .map((seg) => (/^\d+$/.test(seg) ? ':id' : seg))
    .join('/');
  return normalized.length <= 64 ? normalized : null;
}

export function observeRequest(
  request: Request,
  response: Response,
  durationMs: number,
  env: { APP_HEALTH_INGEST_KEY?: string },
  ctx?: ExecutionContext
): void {
  const key =
    typeof env?.APP_HEALTH_INGEST_KEY === 'string' ? env.APP_HEALTH_INGEST_KEY.trim() : '';
  const route = routeFor(new URL(request.url).pathname);
  if (!key || !route) return;
  const batch = {
    batch_id: crypto.randomUUID(),
    schema_version: 'v1',
    runtime: 'worker',
    environment: 'production',
    events: [
      {
        event_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        method: request.method,
        route,
        status_code: response.status,
        duration_ms: Math.max(0, Math.round(durationMs)),
      },
    ],
  };
  try {
    ctx?.waitUntil(
      fetch(INGEST_ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(batch),
      }).catch(() => undefined)
    );
  } catch {
    // Telemetry must never take down the request path.
  }
}
