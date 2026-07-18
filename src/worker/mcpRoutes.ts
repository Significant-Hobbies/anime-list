import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';

// MCP server: a thin protocol adapter over the existing /api/* endpoints.
// Each tool subrequests the corresponding endpoint and returns the body.
// Public tools send no auth header; watchlist tools forward the caller's
// Authorization header so the existing requireAuth middleware (which now
// accepts PATs) handles authentication. No endpoint logic is duplicated here.

const AUTH_ERROR_MESSAGE =
  'Authentication required: provide a valid Personal Access Token (shelf_...) or JWT via the Authorization header. Create a token at /mcp.';

interface ToolDef {
  name: string;
  description: string;
  method: 'GET' | 'POST';
  path: string; // e.g. '/api/search' or '/api/anime/{mal_id}'
  auth: boolean;
  // Build the URL (with path params / query) and optional JSON body from tool args.
  buildUrl?: (origin: string, args: Record<string, unknown>) => string;
  buildBody?: (args: Record<string, unknown>) => unknown;
  inputSchema?: Record<string, z.ZodType>;
}

const TOOLS: ToolDef[] = [
  {
    name: 'search_anime',
    description:
      'Search and filter the anime catalog. Same payload as POST /api/search: { filters: [{field, action, value}], sortBy, airing: "any"|"yes"|"no", pagesize, offset }. Returns { totalFiltered, filteredList }.',
    method: 'POST',
    path: '/api/search',
    auth: false,
    buildBody: (a) => a,
    inputSchema: {
      filters: z.array(z.any()).default([]),
      sortBy: z.string().optional(),
      airing: z.enum(['any', 'yes', 'no']).default('any'),
      pagesize: z.number().int().min(1).max(200).default(40),
      offset: z.number().int().min(0).default(0),
    },
  },
  {
    name: 'search_manga',
    description:
      'Search and filter the manga catalog. Same payload as POST /api/manga/search: { filters, sortBy, pagesize, offset }. Returns { totalFiltered, filteredList }.',
    method: 'POST',
    path: '/api/manga/search',
    auth: false,
    buildBody: (a) => a,
    inputSchema: {
      filters: z.array(z.any()).default([]),
      sortBy: z.string().optional(),
      pagesize: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
    },
  },
  {
    name: 'get_anime_detail',
    description:
      'Full detail for one anime by MAL id (same shape as GET /api/anime/:malId). Returns null if not found.',
    method: 'GET',
    path: '/api/anime/{mal_id}',
    auth: false,
    buildUrl: (origin, a) => `${origin}/api/anime/${a.mal_id}`,
    inputSchema: { mal_id: z.number().int().positive() },
  },
  {
    name: 'get_manga_detail',
    description:
      'Full detail for one manga by MAL id (same shape as GET /api/manga/:malId). Returns null if not found.',
    method: 'GET',
    path: '/api/manga/{mal_id}',
    auth: false,
    buildUrl: (origin, a) => `${origin}/api/manga/${a.mal_id}`,
    inputSchema: { mal_id: z.number().int().positive() },
  },
  {
    name: 'get_anime_stats',
    description: 'Aggregate stats over the anime catalog (same shape as GET /api/stats). No input.',
    method: 'GET',
    path: '/api/stats',
    auth: false,
    buildUrl: (origin) => `${origin}/api/stats`,
    inputSchema: {},
  },
  {
    name: 'get_random_anime',
    description:
      'Random anime from the catalog. Optional { genre, limit } — limit clamped to [1,20]. Same shape as GET /api/anime/random.',
    method: 'GET',
    path: '/api/anime/random',
    auth: false,
    buildUrl: (origin, a) => {
      const url = new URL('/api/anime/random', origin);
      if (a.genre) url.searchParams.set('genre', String(a.genre));
      url.searchParams.set('limit', String(Math.min(Math.max(Number(a.limit ?? 1), 1), 20)));
      return url.toString();
    },
    inputSchema: {
      genre: z.string().optional(),
      limit: z.number().int().min(1).max(20).default(1),
    },
  },
  {
    name: 'list_watchlist',
    description:
      "The authenticated user's anime watchlist (same shape as GET /api/watchlist: { user, anime }). Requires a PAT or JWT.",
    method: 'GET',
    path: '/api/watchlist',
    auth: true,
    buildUrl: (origin) => `${origin}/api/watchlist`,
    inputSchema: {},
  },
  {
    name: 'list_manga_watchlist',
    description:
      "The authenticated user's manga watchlist (same shape as GET /api/manga/watchlist). Requires a PAT or JWT.",
    method: 'GET',
    path: '/api/manga/watchlist',
    auth: true,
    buildUrl: (origin) => `${origin}/api/manga/watchlist`,
    inputSchema: {},
  },
  {
    name: 'list_watchlist_tags',
    description:
      "The authenticated user's watchlist tags with per-tag counts (same shape as GET /api/watchlist/tags: { tags }). Requires a PAT or JWT.",
    method: 'GET',
    path: '/api/watchlist/tags',
    auth: true,
    buildUrl: (origin) => `${origin}/api/watchlist/tags`,
    inputSchema: {},
  },
  {
    name: 'get_watchlist_enriched',
    description:
      "The authenticated user's anime watchlist joined with catalog metadata (title, image, score, genres). Same shape as GET /api/watchlist/enriched: { items }. Requires a PAT or JWT.",
    method: 'GET',
    path: '/api/watchlist/enriched',
    auth: true,
    buildUrl: (origin) => `${origin}/api/watchlist/enriched`,
    inputSchema: {},
  },
];

function buildServer(origin: string, authHeader: string | null): McpServer {
  const server = new McpServer(
    { name: 'shelf', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema ?? {} },
      async (args) => {
        const url = tool.buildUrl
          ? tool.buildUrl(origin, args as Record<string, unknown>)
          : `${origin}${tool.path}`;
        const headers: Record<string, string> = {};
        if (tool.method === 'POST') headers['Content-Type'] = 'application/json';
        if (tool.auth && authHeader) headers['Authorization'] = authHeader;

        const init: RequestInit = { method: tool.method, headers };
        if (tool.method === 'POST' && tool.buildBody) {
          init.body = JSON.stringify(tool.buildBody(args as Record<string, unknown>));
        }

        const res = await fetch(url, init);
        const text = await res.text();

        if (res.status === 401 || res.status === 403) {
          return { isError: true, content: [{ type: 'text', text: AUTH_ERROR_MESSAGE }] };
        }
        if (!res.ok) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Upstream ${res.status}: ${text}` }],
          };
        }
        return { content: [{ type: 'text', text }] };
      }
    );
  }

  return server;
}

export async function handleMcpRequest(
  request: Request,
  authHeader: string | null
): Promise<Response> {
  const origin = new URL(request.url).origin;
  // Stateless, JSON responses — no SSE, no session state. Ideal for
  // read-only tools on Workers where isolates don't share in-memory state.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = buildServer(origin, authHeader);
  await server.connect(transport);
  const response = await transport.handleRequest(request);
  await server.close();
  return response;
}
