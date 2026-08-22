import surfaces from '../src/data/public-surfaces.json';
import { rewriteStaticSeo } from '../src/staticSeo';

const publicSurfaces = new Map(surfaces.map((surface) => [surface.path, surface]));

const SITE_URL = 'https://anime.significanthobbies.com';

const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'Anime List by Significant Hobbies — public API',
    version: '1.0.0',
    description:
      'Anime and manga discovery platform with multi-field filtering, personal watchlists, schedule tracking, and daily auto-sync from MyAnimeList via Jikan API. The public web API exposes read-only agent surfaces.',
    contact: { name: 'Anime List', url: SITE_URL },
  },
  servers: [{ url: SITE_URL }],
  tags: [{ name: 'agent-surfaces', description: 'Machine-readable public surfaces' }],
  paths: {
    '/api/ai': {
      get: {
        operationId: 'getAgentCatalog',
        tags: ['agent-surfaces'],
        summary: 'Agent catalog',
        description: 'JSON inventory of public agent surfaces.',
        responses: { '200': { description: 'Agent catalog', content: { 'application/json': {} } } },
      },
    },
    '/llms.txt': {
      get: {
        operationId: 'getLlmsTxt',
        tags: ['agent-surfaces'],
        summary: 'llms.txt index',
        responses: { '200': { description: 'Markdown index', content: { 'text/plain': {} } } },
      },
    },
    '/sitemap.xml': {
      get: {
        operationId: 'getSitemap',
        tags: ['agent-surfaces'],
        summary: 'Sitemap',
        responses: { '200': { description: 'XML sitemap', content: { 'application/xml': {} } } },
      },
    },
    '/openapi.json': {
      get: {
        operationId: 'getOpenApiSpec',
        tags: ['agent-surfaces'],
        summary: 'OpenAPI specification',
        description: 'This document.',
        responses: {
          '200': { description: 'OpenAPI 3.1 spec', content: { 'application/json': {} } },
        },
      },
    },
  },
};

function wantsMarkdown(request: Request): boolean {
  const accept = (request.headers.get('accept') || '').toLowerCase();
  if (!accept.includes('text/markdown')) return false;
  if (!accept.includes('text/html')) return true;
  return accept.indexOf('text/markdown') < accept.indexOf('text/html');
}

function normalizePath(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  const withSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return withSlash.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
}

function markdown404(pathname: string, method: string): Response {
  const path = normalizePath(pathname);
  const body = `# 404 — Not Found

\`${path}\` does not exist on anime.significanthobbies.com.

## Where to look next

- [Home](${SITE_URL}/)
- [Sitemap](${SITE_URL}/sitemap.xml)
- [Agent index](${SITE_URL}/llms.txt)
- [Agent catalog (JSON)](${SITE_URL}/api/ai)
- [OpenAPI spec](${SITE_URL}/openapi.json)
`;
  return new Response(method === 'HEAD' ? null : body, {
    status: 404,
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

function jsonError(status: number, code: string, message: string, path: string): Response {
  return new Response(JSON.stringify({ error: { code, message, path } }), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}

export const onRequest: PagesFunction = async (context) => {
  const { request } = context;
  const url = new URL(request.url);
  const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/$/, '') : '/';

  // /openapi.json — serve the spec directly.
  if (pathname === '/openapi.json' || pathname === '/openapi.yaml') {
    return new Response(JSON.stringify(OPENAPI_SPEC, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
        'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  }

  // JSON errors for unknown /api/* paths (excluding /api/ai and proxied paths).
  if (
    pathname.startsWith('/api/') &&
    pathname !== '/api/ai' &&
    !pathname.startsWith('/api/anime') &&
    !pathname.startsWith('/api/manga')
  ) {
    return jsonError(404, 'not_found', `Unknown API path: ${pathname}`, pathname);
  }

  if (request.method !== 'GET') return context.next();

  const surface = publicSurfaces.get(pathname);

  // Agent-friendly 404 with markdown recovery body for markdown clients.
  if (
    !surface &&
    wantsMarkdown(request) &&
    !pathname.includes('.') &&
    !pathname.startsWith('/api/')
  ) {
    return markdown404(pathname, request.method);
  }

  if (!surface) {
    const response = await context.next();
    if (response.status === 404 && !pathname.startsWith('/api/')) {
      const headers = new Headers(response.headers);
      headers.set('vary', 'Accept, Accept-Encoding');
      return new Response(response.body, { status: 404, headers });
    }
    return response;
  }

  const response = await context.next();
  const contentType = response.headers.get('content-type') ?? '';
  if (response.status !== 200 || !contentType.includes('text/html')) return response;

  const html = rewriteStaticSeo(await response.text(), surface, url.origin);
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  // HTML identifies the active release and must change atomically with a Pages
  // deployment. Hashed assets remain immutable via public/_headers.
  headers.set('cache-control', 'no-store');
  // Add Vary: Accept for pages that have markdown alternates.
  const existingVary = headers.get('vary');
  headers.set('vary', existingVary ? `${existingVary}, Accept` : 'Accept, Accept-Encoding');
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
