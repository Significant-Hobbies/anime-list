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
export const AGENT_SURFACE = {
  "name": "MAL Explorer",
  "url": "https://anime.significanthobbies.com",
  "llmsFullTxt": "# MAL Explorer — full agent brief\n\nAnime and manga discovery with multi-axis filtering and watchlists.\n\n## Index\n\n# MAL Explorer\n\nAnime/manga discovery with multi-axis filtering and watchlists.\n\n## Note for agents\n\nThe UI is a client SPA. Prefer this markdown and `/api/ai` over scraping HTML shells.\n\n## Agent entrypoints\n\n- https://anime.significanthobbies.com/llms.txt\n- https://anime.significanthobbies.com/api/ai\n- https://anime.significanthobbies.com/index.md\n\n## Product links\n\n- Home: https://anime.significanthobbies.com/ — Discovery UI (SPA)\n\n## Machine surfaces\n\n- https://anime.significanthobbies.com/llms.txt\n- https://anime.significanthobbies.com/llms-full.txt\n- https://anime.significanthobbies.com/api/ai\n- https://anime.significanthobbies.com/index.md\n- https://anime.significanthobbies.com/sitemap.xml\n- https://anime.significanthobbies.com/robots.txt\n\n## Contact / fleet\n\n- Fleet: https://sassmaker.com\n- Agent email for directory verification: sarthakagrawal@agentmail.to\n",
  "llmsTxt": "# MAL Explorer\n\n> Anime and manga discovery with multi-axis filtering and watchlists.\n\n## Product\n\n- [Home](https://anime.significanthobbies.com/): Discovery UI (SPA)\n\n## Machine surfaces\n\n- [Agent catalog](https://anime.significanthobbies.com/api/ai): JSON inventory of public surfaces\n- [Homepage markdown](https://anime.significanthobbies.com/index.md): Product brief without JS\n- [This index](https://anime.significanthobbies.com/llms.txt)\n\n## Optional\n\n- [Foundry](https://sassmaker.com): Parent fleet showcase\n",
  "indexMd": "# MAL Explorer\n\nAnime/manga discovery with multi-axis filtering and watchlists.\n\n## Note for agents\n\nThe UI is a client SPA. Prefer this markdown and `/api/ai` over scraping HTML shells.\n\n## Agent entrypoints\n\n- https://anime.significanthobbies.com/llms.txt\n- https://anime.significanthobbies.com/api/ai\n- https://anime.significanthobbies.com/index.md\n",
  "catalog": {
    "name": "MAL Explorer",
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
    "surfaces": [
      {
        "id": "home",
        "url": "https://anime.significanthobbies.com/",
        "md": "https://anime.significanthobbies.com/index.md",
        "kind": "spa",
        "description": "Product home"
      }
    ],
    "auth": {
      "public": true,
      "notes": "Auth-walled app routes are not agent-indexed unless listed here."
    }
  }
};

/**
 * @param {Request} request
 * @returns {Response | null}
 */
export function handleAgentEdge(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const url = new URL(request.url);
  const path = url.pathname === '' ? '/' : url.pathname;

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

  return null;
}

function wantsMarkdown(request) {
  const accept = (request.headers.get('accept') || '').toLowerCase();
  if (!accept.includes('text/markdown')) return false;
  if (!accept.includes('text/html')) return true;
  return accept.indexOf('text/markdown') < accept.indexOf('text/html');
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
    },
  });
}
