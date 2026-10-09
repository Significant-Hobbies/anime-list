/**
 * Backend performance timing middleware.
 *
 * Wraps a Workers fetch handler to measure response time with
 * `performance.now()`, reports it via the `Server-Timing` response header,
 * and logs requests slower than 200 ms via `console.warn`.
 */
import { observeRequest, statsStages } from './app-health';

export function withTiming(
  handler: (request: Request, env: any, ctx: any) => Promise<Response> | Response
): (request: Request, env: any, ctx: any) => Promise<Response> {
  return async (request, env, ctx) => {
    const start = performance.now();
    const url = new URL(request.url);
    const response = await handler(request, env, ctx);
    const duration = performance.now() - start;

    // Add Server-Timing header
    const headers = new Headers(response.headers);
    const timings = [`app;dur=${Math.round(duration)}`];
    const stages = statsStages.get(request);
    if (stages) {
      timings.push(`edge_cache;desc="${stages.edge_cache}"`);
      if (stages.store_ms !== undefined) timings.push(`store;dur=${Math.round(stages.store_ms)}`);
      if (stages.compute_ms !== undefined)
        timings.push(`compute;dur=${Math.round(stages.compute_ms)}`);
    }
    headers.set('Server-Timing', timings.join(', '));
    const timedResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });

    // Log slow requests
    if (duration > 200) {
      console.warn(`[slow] ${request.method} ${url.pathname} — ${Math.round(duration)}ms`);
    }

    observeRequest(request, timedResponse, duration, env, ctx);
    return timedResponse;
  };
}
