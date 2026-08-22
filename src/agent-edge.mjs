/**
 * Portable agent-edge handler — copy or generate into each product.
 * Spec: fleet-ops/docs/agent-indexing-standard.md
 *
 * Usage in worker.mjs (before openNext.fetch):
 *   import { handleAgentEdge } from './agent-edge.mjs'
 *   const agent = handleAgentEdge(request)
 *   if (agent) return agent
 */

/** @type {{ name: string, url: string, llmsTxt: string, llmsFullTxt?: string, indexMd: string, catalog: object }} */
// biome-ignore format: generated payload from apply-agent-surfaces (JSON keys/quotes)
// TODO: regenerate via fleet agent-surface generator — MCP surface hand-added for expose-mcp-server.
export const AGENT_SURFACE = {
  "name": "Anime List by Significant Hobbies",
  "url": "https://anime.significanthobbies.com",
  "llmsFullTxt": "# Anime List by Significant Hobbies — full agent brief\n\nAnime and manga discovery with multi-axis filtering and watchlists.\n\n## Index\n\n# Anime List by Significant Hobbies\n\nAnime/manga discovery with multi-axis filtering and watchlists.\n\n## Note for agents\n\nThe UI is a client SPA. Prefer this markdown and `/api/ai` over scraping HTML shells.\n\n## Agent entrypoints\n\n- https://anime.significanthobbies.com/llms.txt\n- https://anime.significanthobbies.com/api/ai\n- https://anime.significanthobbies.com/index.md\n\n## Product links\n\n- Home: https://anime.significanthobbies.com/ — Discovery UI (SPA)\n\n## Machine surfaces\n\n- https://anime.significanthobbies.com/llms.txt\n- https://anime.significanthobbies.com/llms-full.txt\n- https://anime.significanthobbies.com/api/ai\n- https://anime.significanthobbies.com/index.md\n- https://anime.significanthobbies.com/sitemap.xml\n- https://anime.significanthobbies.com/robots.txt\n\n## Contact / fleet\n\n- Fleet: https://sassmaker.com\n- Agent email for directory verification: sarthakagrawal@agentmail.to\n",
  "llmsTxt": "# Anime List by Significant Hobbies\n\n> Anime and manga discovery with multi-axis filtering and watchlists.\n\n## When to use this\n\n- Best fit: discovering anime and manga by score, year, genre, theme, demographic, and popularity\n- Best fit: browsing catalog statistics, schedules, and random recommendations from MyAnimeList data\n- Not a fit: streaming anime or manga content\n- Not a fit: tracking watch progress on non-MAL catalogs\n\n## Product\n\n- [Home](https://anime.significanthobbies.com/): Discovery UI (SPA)\n\n## Machine surfaces\n\n- [Agent catalog](https://anime.significanthobbies.com/api/ai): JSON inventory of public surfaces\n- [OpenAPI spec](https://anime.significanthobbies.com/openapi.json): OpenAPI 3.1 specification\n- [Homepage markdown](https://anime.significanthobbies.com/index.md): Product brief without JS\n- [This index](https://anime.significanthobbies.com/llms.txt)\n\n## Developer docs\n\n- [OpenAPI specification](https://anime.significanthobbies.com/openapi.json): Full API surface description (OpenAPI 3.1)\n- [Agent catalog](https://anime.significanthobbies.com/api/ai): JSON inventory of public agent surfaces\n\n## CLI\n\n```bash\n# Fetch the agent catalog\ncurl -s https://anime.significanthobbies.com/api/ai | jq .\n\n# Get the OpenAPI spec\ncurl -s https://anime.significanthobbies.com/openapi.json | jq .\n\n# Fetch the homepage as markdown\ncurl -s -H 'Accept: text/markdown' https://anime.significanthobbies.com/\n```\n\n## Optional\n\n- [Foundry](https://sassmaker.com): Parent fleet showcase\n",
  "indexMd": "# Anime List by Significant Hobbies\n\nAnime/manga discovery with multi-axis filtering and watchlists.\n\n## Note for agents\n\nThe UI is a client SPA. Prefer this markdown and `/api/ai` over scraping HTML shells.\n\n## Agent entrypoints\n\n- https://anime.significanthobbies.com/llms.txt\n- https://anime.significanthobbies.com/api/ai\n- https://anime.significanthobbies.com/index.md\n",
  "catalog": {
    "name": "Anime List by Significant Hobbies",
    "version": "1",
    "url": "https://anime.significanthobbies.com",
    "llms": "https://anime.significanthobbies.com/llms.txt",
    "llmsFull": "https://anime.significanthobbies.com/llms-full.txt",
    "sitemap": "https://anime.significanthobbies.com/sitemap.xml",
    "robots": "https://anime.significanthobbies.com/robots.txt",
    "markdown": {
      "suffix": ".md",
      "negotiation": true
    },
    "openapi": "https://anime.significanthobbies.com/openapi.json",
    "surfaces": [
      {
        "id": "home",
        "url": "https://anime.significanthobbies.com/",
        "md": "https://anime.significanthobbies.com/index.md",
        "kind": "spa",
        "description": "Product home"
      },
      {
        "id": "mcp",
        "url": "https://anime.significanthobbies.com/api/mcp",
        "kind": "mcp",
        "description": "MCP server — public catalog tools (search, detail, stats) open; watchlist tools require a Personal Access Token (see /mcp)."
      }
    ],
    "auth": {
      "public": true,
      "notes": "Auth-walled app routes are not agent-indexed unless listed here."
    }
  }
};

const PRODUCT_ORIGIN = AGENT_SURFACE.url;

const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'Anime List by Significant Hobbies — public API',
    version: '1.0.0',
    description:
      'Anime and manga discovery platform with multi-field filtering, personal watchlists, schedule tracking, and daily auto-sync from MyAnimeList via Jikan API. The public web API exposes read-only agent surfaces: the agent catalog, sitemap, llms.txt, and per-page markdown alternates.',
    contact: { name: 'Anime List', url: PRODUCT_ORIGIN },
  },
  servers: [{ url: PRODUCT_ORIGIN }],
  tags: [{ name: 'agent-surfaces', description: 'Machine-readable public surfaces' }],
  paths: {
    '/api/ai': {
      get: {
        operationId: 'getAgentCatalog',
        tags: ['agent-surfaces'],
        summary: 'Agent catalog',
        description: 'JSON inventory of public agent surfaces.',
        responses: {
          200: {
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
          404: {
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
          200: {
            description: 'Markdown index',
            content: { 'text/plain': { schema: { type: 'string' } } },
          },
          404: {
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
          200: {
            description: 'XML sitemap',
            content: { 'application/xml': { schema: { type: 'string' } } },
          },
          404: {
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
          200: {
            description: 'OpenAPI 3.1 spec',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
          404: {
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

/**
 * @param {Request} request
 * @returns {Response | null}
 */
export function handleAgentEdge(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const url = new URL(request.url);
  const path = url.pathname === '' ? '/' : url.pathname;

  if (path === '/openapi.json' || path === '/openapi.yaml') {
    return json(OPENAPI_SPEC);
  }

  if (path === '/llms.txt') {
    return text(AGENT_SURFACE.llmsTxt, 'text/plain; charset=utf-8');
  }
  if (path === '/llms-full.txt' && AGENT_SURFACE.llmsFullTxt) {
    return text(AGENT_SURFACE.llmsFullTxt, 'text/plain; charset=utf-8');
  }
  if (path === '/index.md') {
    return text(AGENT_SURFACE.indexMd, 'text/markdown; charset=utf-8');
  }
  if (path === '/api/ai') {
    // Re-bind origin so preview/custom domains stay correct
    const catalog = {
      ...AGENT_SURFACE.catalog,
      url: url.origin,
      llms: `${url.origin}/llms.txt`,
      llmsFull: `${url.origin}/llms-full.txt`,
      sitemap: AGENT_SURFACE.catalog.sitemap
        ? String(AGENT_SURFACE.catalog.sitemap).replace(AGENT_SURFACE.url, url.origin)
        : `${url.origin}/sitemap.xml`,
      openapi: `${url.origin}/openapi.json`,
      surfaces: (AGENT_SURFACE.catalog.surfaces || []).map((s) => ({
        ...s,
        url: s.url ? String(s.url).replace(AGENT_SURFACE.url, url.origin) : s.url,
        md: s.md ? String(s.md).replace(AGENT_SURFACE.url, url.origin) : s.md,
      })),
    };
    return json(catalog);
  }

  // Homepage markdown negotiation
  if ((path === '/' || path === '') && wantsMarkdown(request)) {
    return text(AGENT_SURFACE.indexMd, 'text/markdown; charset=utf-8', {
      Link: '</index.md>; rel="alternate"; type="text/markdown"',
      Vary: 'Accept',
    });
  }

  // Agent-friendly 404: return a markdown recovery body for unknown paths
  // when the client asks for markdown.
  if (wantsMarkdown(request) && !path.includes('.') && !path.startsWith('/api/')) {
    return markdown404(path, request.method);
  }

  return null;
}

function wantsMarkdown(request) {
  const accept = (request.headers.get('accept') || '').toLowerCase();
  if (!accept.includes('text/markdown')) return false;
  if (!accept.includes('text/html')) return true;
  return accept.indexOf('text/markdown') < accept.indexOf('text/html');
}

function normalizePath(pathname) {
  if (!pathname || pathname === '/') return '/';
  const withSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return withSlash.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
}

function markdown404(pathname, method) {
  const path = normalizePath(pathname);
  const body = `# 404 — Not Found

\`${path}\` does not exist on anime.significanthobbies.com.

## Where to look next

- [Home](${PRODUCT_ORIGIN}/)
- [Sitemap](${PRODUCT_ORIGIN}/sitemap.xml)
- [Agent index](${PRODUCT_ORIGIN}/llms.txt)
- [Agent catalog (JSON)](${PRODUCT_ORIGIN}/api/ai)
- [OpenAPI spec](${PRODUCT_ORIGIN}/openapi.json)
`;
  return new Response(method === 'HEAD' ? null : body, {
    status: 404,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Accept',
    },
  });
}

function text(body, type, extra = {}) {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=300',
      ...extra,
    },
  });
}

function json(data) {
  return new Response(`${JSON.stringify(data, null, 2)}\n`, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'RateLimit-Limit': '120',
      'RateLimit-Remaining': '119',
      'RateLimit-Reset': '60',
    },
  });
}
