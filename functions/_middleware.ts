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
        responses: {
          '200': {
            description: 'Agent catalog',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  description: 'Bounded inventory of public agent surfaces.',
                },
              },
            },
          },
          '404': {
            description: 'Not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
        },
      },
    },
    '/llms.txt': {
      get: {
        operationId: 'getLlmsTxt',
        tags: ['agent-surfaces'],
        summary: 'llms.txt index',
        description:
          'Concise, human-and-agent-readable index of the site and its machine surfaces.',
        responses: {
          '200': {
            description: 'Markdown index',
            content: { 'text/plain': { schema: { type: 'string' } } },
          },
          '404': {
            description: 'Not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
        },
      },
    },
    '/sitemap.xml': {
      get: {
        operationId: 'getSitemap',
        tags: ['agent-surfaces'],
        summary: 'Sitemap',
        description: 'XML sitemap of public, agent-readable routes.',
        responses: {
          '200': {
            description: 'XML sitemap',
            content: { 'application/xml': { schema: { type: 'string' } } },
          },
          '404': {
            description: 'Not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
        },
      },
    },
    '/openapi.json': {
      get: {
        operationId: 'getOpenApiSpec',
        tags: ['agent-surfaces'],
        summary: 'OpenAPI specification',
        description: 'This document: a machine-readable description of the public agent API.',
        responses: {
          '200': {
            description: 'OpenAPI 3.1 spec',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
          '404': {
            description: 'Not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ApiError: {
        type: 'object',
        description: 'Error response for failed API requests.',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'not_found' },
              message: { type: 'string', example: 'Unknown API path: /api/unknown' },
              path: { type: 'string', example: '/api/unknown' },
            },
            required: ['code', 'message', 'path'],
          },
        },
        required: ['error'],
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
      vary: 'Accept',
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
        'RateLimit-Limit': '120',
        'RateLimit-Remaining': '119',
        'RateLimit-Reset': '60',
      },
    });
  }

  // /api/ai is a static Pages surface. Every other /api/* path is proxied to
  // mal-api by functions/api/[[path]].ts — do not 404 them here.

  if (request.method !== 'GET') return context.next();

  const surface = publicSurfaces.get(pathname);

  // Accept: text/markdown negotiation — serve the .md alternate for known surfaces.
  if (
    surface &&
    wantsMarkdown(request) &&
    (request.method === 'GET' || request.method === 'HEAD')
  ) {
    const mdUrl = new URL(surface.markdownPath, url);
    const mdReq = new Request(mdUrl.toString(), { method: request.method });
    const mdResp = await context.env.ASSETS.fetch(mdReq);
    if (mdResp.status === 200) {
      const headers = new Headers(mdResp.headers);
      headers.set('content-type', 'text/markdown; charset=utf-8');
      headers.set('vary', 'Accept, Accept-Encoding');
      headers.set('x-content-type-options', 'nosniff');
      headers.set('cache-control', 'no-store');
      return new Response(request.method === 'HEAD' ? null : mdResp.body, {
        status: 200,
        headers,
      });
    }
  }

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
    // Add Vary: Accept to HTML 200 responses from the SPA that have
    // markdown alternates (all routes share index.md as the alternate).
    const ct = response.headers.get('content-type') ?? '';
    if (response.status === 200 && ct.includes('text/html')) {
      const headers = new Headers(response.headers);
      const existingVary = headers.get('vary');
      headers.set('vary', existingVary ? `${existingVary}, Accept` : 'Accept, Accept-Encoding');
      return new Response(response.body, { status: 200, headers });
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
