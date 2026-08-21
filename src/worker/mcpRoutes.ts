import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';

// MCP server: a thin protocol adapter over the existing /api/* endpoints.
// Each tool subrequests the corresponding endpoint and returns the body.
// Public tools send no auth header; watchlist tools forward the caller's
// PAT Authorization header or a product-verified federated bearer so the
// existing requireAuth middleware handles authentication. Browser-session
// JWTs and cookies are intentionally excluded.

const AUTH_ERROR_MESSAGE =
  'Authentication required: provide a valid Personal Access Token (anime_list_...) via the Authorization header. Create a token at /mcp.';
const MAX_RESPONSE_BYTES = 1_000_000;
const REQUEST_TIMEOUT_MS = 10_000;
const watchlistPageInput = {
  limit: z.number().int().min(1).max(50).default(50),
  offset: z.number().int().min(0).max(1_000_000).default(0),
};

const filterValueSchema = z.union([
  z.string().max(200),
  z.number().finite(),
  z.boolean(),
  z.array(z.union([z.string().max(100), z.number().finite()])).max(50),
]);
const catalogFilterSchema = z.object({
  field: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_.-]+$/),
  action: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/),
  value: filterValueSchema,
});

const outputSchema = z.object({
  schemaVersion: z.literal('1'),
  ok: z.boolean(),
  tool: z.string(),
  generatedAt: z.string(),
  retrievalMode: z.enum(['public-catalog', 'owner-watchlist', 'error']),
  data: z.unknown().optional(),
  truncated: z.boolean(),
  sourceUrl: z.string().url().optional(),
  error: z
    .object({
      code: z.enum([
        'unauthorized',
        'not_found',
        'rate_limited',
        'timeout',
        'upstream_unavailable',
        'invalid_upstream_response',
      ]),
      message: z.string(),
      retryable: z.boolean(),
    })
    .optional(),
});

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
      filters: z.array(catalogFilterSchema).max(20).default([]),
      sortBy: z
        .string()
        .max(64)
        .regex(/^[A-Za-z0-9_.-]+$/)
        .optional(),
      airing: z.enum(['any', 'yes', 'no']).default('any'),
      pagesize: z.number().int().min(1).max(50).default(20),
      offset: z.number().int().min(0).max(1_000_000).default(0),
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
      filters: z.array(catalogFilterSchema).max(20).default([]),
      sortBy: z
        .string()
        .max(64)
        .regex(/^[A-Za-z0-9_.-]+$/)
        .optional(),
      pagesize: z.number().int().min(1).max(50).default(20),
      offset: z.number().int().min(0).max(1_000_000).default(0),
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
      "Page through the authenticated user's complete anime watchlist in deterministic MAL-id order. Returns { items, total, nextOffset, hasMore }; keep calling with offset=nextOffset until nextOffset is null. Requires a PAT.",
    method: 'GET',
    path: '/api/watchlist',
    auth: true,
    buildUrl: (origin, a) => `${origin}/api/watchlist?limit=${a.limit}&offset=${a.offset}`,
    inputSchema: watchlistPageInput,
  },
  {
    name: 'list_manga_watchlist',
    description:
      "Page through the authenticated user's complete manga watchlist in deterministic MAL-id order. Returns { items, total, nextOffset, hasMore }; keep calling with offset=nextOffset until nextOffset is null. Requires a PAT.",
    method: 'GET',
    path: '/api/manga/watchlist',
    auth: true,
    buildUrl: (origin, a) => `${origin}/api/manga/watchlist?limit=${a.limit}&offset=${a.offset}`,
    inputSchema: watchlistPageInput,
  },
  {
    name: 'list_watchlist_tags',
    description:
      "Page through the authenticated user's watchlist tags with per-tag anime counts. Returns { items, total, nextOffset, hasMore }; keep calling with offset=nextOffset until nextOffset is null. Requires a PAT.",
    method: 'GET',
    path: '/api/watchlist/tags',
    auth: true,
    buildUrl: (origin, a) => `${origin}/api/watchlist/tags?limit=${a.limit}&offset=${a.offset}`,
    inputSchema: watchlistPageInput,
  },
  {
    name: 'get_watchlist_enriched',
    description:
      "Page through the authenticated user's complete anime watchlist joined with catalog metadata (title, image, score, genres). Returns { items, total, nextOffset, hasMore }; keep calling with offset=nextOffset until nextOffset is null. Requires a PAT.",
    method: 'GET',
    path: '/api/watchlist/enriched',
    auth: true,
    buildUrl: (origin, a) => `${origin}/api/watchlist/enriched?limit=${a.limit}&offset=${a.offset}`,
    inputSchema: watchlistPageInput,
  },
];

type StableErrorCode =
  | 'unauthorized'
  | 'not_found'
  | 'rate_limited'
  | 'timeout'
  | 'upstream_unavailable'
  | 'invalid_upstream_response';

function stableError(tool: ToolDef, code: StableErrorCode, message: string, retryable = false) {
  const data = {
    schemaVersion: '1' as const,
    ok: false,
    tool: tool.name,
    generatedAt: new Date().toISOString(),
    retrievalMode: 'error' as const,
    truncated: false,
    error: { code, message, retryable },
  };
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: message }],
    structuredContent: data,
  };
}

function stripSensitive(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string')
    return value.length > 20_000 ? `${value.slice(0, 20_000)}…` : value;
  if (depth >= 7) return '[truncated]';
  if (Array.isArray(value))
    return value.slice(0, 50).map((item) => stripSensitive(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !/(authorization|cookie|password|secret|token|api[_-]?key)/i.test(key))
        .slice(0, 100)
        .map(([key, item]) => [key, stripSensitive(item, depth + 1)])
    );
  }
  return String(value);
}

function addCanonicalUrls(value: unknown, toolName: string): unknown {
  if (Array.isArray(value)) return value.map((item) => addCanonicalUrls(item, toolName));
  if (!value || typeof value !== 'object') return value;
  const record = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, addCanonicalUrls(item, toolName)])
  );
  const malId = record.mal_id ?? record.malId ?? record.id;
  const numericMalId = typeof malId === 'string' && /^\d+$/.test(malId) ? Number(malId) : malId;
  if (typeof numericMalId === 'number' && Number.isInteger(numericMalId) && numericMalId > 0) {
    const kind = toolName.includes('manga') ? 'manga' : 'anime';
    record.canonicalUrl = `https://anime.significanthobbies.com/${kind}/${numericMalId}`;
  }
  return record;
}

async function boundedFetch(url: string, init: RequestInit): Promise<Response> {
  let lastResponse: Response | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if ((response.status === 429 || response.status >= 500) && attempt === 0) {
        lastResponse = response;
        continue;
      }
      return response;
    } catch (error) {
      if (attempt === 0) continue;
      throw error;
    }
  }
  return lastResponse!;
}

async function boundedResponseText(response: Response): Promise<string | null> {
  const declared = Number(response.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) return null;
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_RESPONSE_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const joined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(joined);
}

function errorForStatus(tool: ToolDef, status: number) {
  if (status === 401 || status === 403) {
    return stableError(tool, 'unauthorized', AUTH_ERROR_MESSAGE);
  }
  if (status === 404) return stableError(tool, 'not_found', 'Catalog record not found.');
  if (status === 429)
    return stableError(tool, 'rate_limited', 'Anime List rate-limited this read.', true);
  if (status >= 500) {
    return stableError(
      tool,
      'upstream_unavailable',
      'Anime List is temporarily unavailable.',
      true
    );
  }
  return stableError(
    tool,
    'invalid_upstream_response',
    `Anime List returned an unsupported status (${status}).`
  );
}

function buildRequestInit(
  tool: ToolDef,
  args: Record<string, unknown>,
  readCredential: string | null
): RequestInit {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (tool.method === 'POST') headers['Content-Type'] = 'application/json';
  if (tool.auth && readCredential) headers['Authorization'] = readCredential;

  const init: RequestInit = { method: tool.method, headers };
  if (tool.method === 'POST' && tool.buildBody) {
    init.body = JSON.stringify(tool.buildBody(args));
  }
  return init;
}

function fetchErrorResult(tool: ToolDef, error: unknown) {
  const timedOut =
    error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');
  return stableError(
    tool,
    timedOut ? 'timeout' : 'upstream_unavailable',
    timedOut ? 'Anime List read timed out.' : 'Anime List is temporarily unavailable.',
    true
  );
}

function parseResponseText(tool: ToolDef, text: string | null) {
  if (text === null) {
    return stableError(
      tool,
      'invalid_upstream_response',
      'Anime List response exceeded the read bound.'
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return stableError(tool, 'invalid_upstream_response', 'Anime List returned invalid JSON.');
  }
}

function hasMoreFlag(parsed: unknown): boolean {
  return (
    parsed !== null &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    (parsed as Record<string, unknown>).hasMore === true
  );
}

function buildToolHandler(origin: string, tool: ToolDef, readCredential: string | null) {
  return async (args: Record<string, unknown>) => {
    const url = tool.buildUrl ? tool.buildUrl(origin, args) : `${origin}${tool.path}`;
    if (tool.auth && !readCredential) {
      return stableError(tool, 'unauthorized', AUTH_ERROR_MESSAGE);
    }

    let res: Response;
    try {
      res = await boundedFetch(url, buildRequestInit(tool, args, readCredential));
    } catch (error) {
      return fetchErrorResult(tool, error);
    }

    if (!res.ok) return errorForStatus(tool, res.status);

    const parsed = parseResponseText(tool, await boundedResponseText(res));
    if (parsed !== null && typeof parsed === 'object' && 'isError' in parsed) {
      return parsed;
    }

    const data = {
      schemaVersion: '1' as const,
      ok: true,
      tool: tool.name,
      generatedAt: new Date().toISOString(),
      retrievalMode: tool.auth ? ('owner-watchlist' as const) : ('public-catalog' as const),
      data: stripSensitive(addCanonicalUrls(parsed, tool.name)),
      truncated: hasMoreFlag(parsed),
      sourceUrl: url,
    };
    return {
      content: [{ type: 'text' as const, text: `Anime List returned ${tool.name} data.` }],
      structuredContent: outputSchema.parse(data),
    };
  };
}

function buildServer(origin: string, authHeader: string | null, federated = false): McpServer {
  const readCredential =
    /^Bearer anime_list_[A-Za-z0-9_-]+$/.test(authHeader ?? '') || federated ? authHeader : null;
  const server = new McpServer(
    { name: 'anime-list-by-significant-hobbies', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.name
          .split('_')
          .map((part) => part[0]?.toUpperCase() + part.slice(1))
          .join(' '),
        description: tool.description,
        inputSchema: tool.inputSchema ?? {},
        outputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: !tool.auth,
        },
      },
      buildToolHandler(origin, tool, readCredential)
    );
  }

  return server;
}

export async function handleMcpRequest(
  request: Request,
  authHeader: string | null,
  federated = false
): Promise<Response> {
  const origin = new URL(request.url).origin;
  // Stateless, JSON responses — no SSE, no session state. Ideal for
  // read-only tools on Workers where isolates don't share in-memory state.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = buildServer(origin, authHeader, federated);
  await server.connect(transport);
  const response = await transport.handleRequest(request);
  await server.close();
  return response;
}
