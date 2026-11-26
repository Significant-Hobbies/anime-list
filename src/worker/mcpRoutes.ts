import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { watchTagSchema } from '../validators/watchTags';
import { catalogOutputs } from './mcpCatalogContracts';
import { registerAssistantTools, type ResolveSession } from '../assistant/register';
import { assistantTools } from '../assistant/tools';
import { filterRequestSchema } from '../validators/animeFilters';
import { mangaFilterRequestSchema } from '../validators/mangaFilters';
import { NUMERIC_FIELDS } from '../types/anime';
import { MANGA_NUMERIC_FIELDS } from '../types/manga';
import { READ_PAGE_MAX } from './readPagination';

// MCP server: a thin protocol adapter over the existing /api/* endpoints.
// Each tool dispatches to the corresponding endpoint and returns the body.
// Public tools send no auth header; watchlist tools forward the caller's
// PAT Authorization header or a product-verified federated bearer so the
// existing requireAuth middleware handles authentication. Browser-session
// JWTs and cookies are intentionally excluded.

const AUTH_ERROR_MESSAGE =
  'Authentication required: provide a valid Personal Access Token (anime_list_...) via the Authorization header. Create a token at /mcp.';
const MAX_RESPONSE_BYTES = 1_000_000;
const REQUEST_TIMEOUT_MS = 10_000;
type DispatchApi = (url: string, init: RequestInit) => Response | Promise<Response>;
const watchlistPageInput = {
  limit: z.number().int().min(1).max(READ_PAGE_MAX).default(50),
  offset: z.number().int().min(0).max(1_000_000).default(0),
};

const outputSchema = z.object({
  schemaVersion: z.literal('1'),
  ok: z.boolean(),
  tool: z.string(),
  generatedAt: z.string(),
  retrievalMode: z.enum(['public-catalog', 'owner-watchlist', 'error']),
  truncated: z.boolean(),
  nextCall: z
    .object({
      name: z.string(),
      arguments: z.record(z.string(), z.unknown()),
    })
    .nullable()
    .optional()
    .describe(
      'Pass this object to tools/call to retrieve the next page. Null means the last page.'
    ),
  data: z.unknown().optional(),
  sourceUrl: z.string().url().optional(),
  error: z
    .object({
      code: z.enum([
        'invalid_argument',
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

function searchBody(args: Record<string, unknown>) {
  const { query, ...search } = args;
  if (typeof query === 'string')
    search.filters = [
      ...(Array.isArray(search.filters) ? search.filters : []),
      { field: 'title', action: 'CONTAINS', value: query },
    ];
  if (search.sortBy === 'recommended' && search.hideWatched === undefined && !search.includeWatched)
    search.hideWatched = ['Done', 'Completed', 'Dropped', 'Avoiding'];
  return search;
}
const queryField = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .optional()
  .describe('Match a canonical, English, Japanese, or alternative title.');
const TOOLS: ToolDef[] = [
  {
    name: 'search_anime',
    description:
      'Search and page through the anime catalog. Input: { filters: [{field, action, value}], sortBy (use "recommended" with a connected account for personalized ranking), airing: "any"|"yes"|"no", pagesize, offset }. Returns filteredList plus pageInfo { total, returned, hasMore, nextOffset }; when nextCall is present, call it to continue.',
    method: 'POST',
    path: '/api/search',
    auth: false,
    buildBody: searchBody,
    inputSchema: {
      query: queryField,
      hideWatched: z
        .array(watchTagSchema)
        .max(30)
        .optional()
        .describe(
          'Exclude entries with these watch statuses. In recommended order pass an empty list to include all statuses.'
        ),
      includeWatched: z
        .array(watchTagSchema)
        .nonempty()
        .max(30)
        .optional()
        .describe('Only return entries with one of these saved watch statuses.'),
      filters: filterRequestSchema.shape.filters.max(20).default([]),
      sortBy: z
        .enum([...NUMERIC_FIELDS, 'released_at', 'created_at', 'recommended', 'time'])
        .optional(),
      airing: z.enum(['any', 'yes', 'no']).default('any'),
      pagesize: z.number().int().min(1).max(READ_PAGE_MAX).default(20),
      offset: z.number().int().min(0).max(1_000_000).default(0),
    },
  },
  {
    name: 'search_manga',
    description:
      'Search and page through the manga catalog. Input: { filters, sortBy, pagesize, offset }. Returns filteredList plus pageInfo { total, returned, hasMore, nextOffset }; when nextCall is present, call it to continue.',
    method: 'POST',
    path: '/api/manga/search',
    auth: false,
    buildBody: searchBody,
    inputSchema: {
      query: queryField,
      hideWatched: z
        .array(watchTagSchema)
        .max(30)
        .optional()
        .describe('Exclude manga with any of these watch statuses.'),
      filters: mangaFilterRequestSchema.shape.filters.max(20).default([]),
      sortBy: z.enum([...MANGA_NUMERIC_FIELDS, 'released_at', 'created_at', 'time']).optional(),
      pagesize: z.number().int().min(1).max(READ_PAGE_MAX).default(20),
      offset: z.number().int().min(0).max(1_000_000).default(0),
    },
  },
  {
    name: 'list_search_fields',
    description:
      'List the numeric, string and array fields available for catalog search filters, grouped by type.',
    method: 'GET',
    path: '/api/fields',
    auth: false,
    buildUrl: (origin, args) => `${origin}/api/${args.media === 'manga' ? 'manga/' : ''}fields`,
    inputSchema: { media: z.enum(['anime', 'manga']).default('anime') },
  },
  {
    name: 'list_filter_actions',
    description:
      'List the comparison and array actions accepted by search filters for the selected catalog.',
    method: 'GET',
    path: '/api/filters',
    auth: false,
    buildUrl: (origin, args) => `${origin}/api/${args.media === 'manga' ? 'manga/' : ''}filters`,
    inputSchema: { media: z.enum(['anime', 'manga']).default('anime') },
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
      'Use get_watchlist for filtered anime and manga entries, ratings and notes. This anime view supports existing clients. Follow nextCall to continue. Requires a connected account.',
    method: 'GET',
    path: '/api/watchlist',
    auth: true,
    buildUrl: (origin, a) => `${origin}/api/watchlist?limit=${a.limit}&offset=${a.offset}`,
    inputSchema: watchlistPageInput,
  },
  {
    name: 'list_manga_watchlist',
    description:
      'Use get_watchlist for filtered anime and manga entries, ratings and notes. This manga view supports existing clients. Follow nextCall to continue. Requires a connected account.',
    method: 'GET',
    path: '/api/manga/watchlist',
    auth: true,
    buildUrl: (origin, a) => `${origin}/api/manga/watchlist?limit=${a.limit}&offset=${a.offset}`,
    inputSchema: watchlistPageInput,
  },
  {
    name: 'list_watchlist_tags',
    description:
      'For classification tags across anime and manga, use list_library_tags. This view includes anime watch status tags. Follow nextCall to continue. Requires a connected account.',
    method: 'GET',
    path: '/api/watchlist/tags',
    auth: true,
    buildUrl: (origin, a) => `${origin}/api/watchlist/tags?limit=${a.limit}&offset=${a.offset}`,
    inputSchema: watchlistPageInput,
  },
  {
    name: 'get_manga_watchlist_enriched',
    description:
      'Use get_watchlist for filtered anime and manga entries, ratings and notes. This manga view supports existing clients. Follow nextCall to continue. Requires a connected account.',
    method: 'GET',
    path: '/api/manga/watchlist/enriched',
    auth: true,
    buildUrl: (origin, a) =>
      `${origin}/api/manga/watchlist/enriched?limit=${a.limit}&offset=${a.offset}`,
    inputSchema: watchlistPageInput,
  },
  {
    name: 'get_watchlist_enriched',
    description:
      'Use get_watchlist for filtered anime and manga entries, ratings and notes. This anime view supports existing clients. Follow nextCall to continue. Requires a connected account.',
    method: 'GET',
    path: '/api/watchlist/enriched',
    auth: true,
    buildUrl: (origin, a) => `${origin}/api/watchlist/enriched?limit=${a.limit}&offset=${a.offset}`,
    inputSchema: watchlistPageInput,
  },
];

type StableErrorCode =
  | 'invalid_argument'
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
  if (Array.isArray(value)) return value.map((item) => stripSensitive(item, depth + 1));
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

async function dispatchWithTimeout(dispatch: DispatchApi, url: string, init: RequestInit) {
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let abort: () => void = () => {};
  const timeout = new Promise<never>((_, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
  });
  try {
    return await Promise.race([dispatch(url, { ...init, signal }), timeout]);
  } finally {
    signal.removeEventListener('abort', abort);
  }
}

async function boundedFetch(
  dispatch: DispatchApi,
  url: string,
  init: RequestInit
): Promise<Response> {
  let lastResponse: Response | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await dispatchWithTimeout(dispatch, url, init);
      if ((response.status === 429 || response.status >= 500) && attempt === 0) {
        lastResponse = response;
        continue;
      }
      return response;
    } catch (error) {
      // A timed-out in-process handler may still be completing its read.
      if (attempt === 0 && !isTimeout(error)) continue;
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
  if (status === 400 || status === 422)
    return stableError(
      tool,
      'invalid_argument',
      'Invalid input. Check the supported filter fields, values, and operator types in the tool schema.'
    );
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
  if (readCredential) headers['Authorization'] = readCredential;

  const init: RequestInit = { method: tool.method, headers };
  if (tool.method === 'POST' && tool.buildBody) {
    init.body = JSON.stringify(tool.buildBody(args));
  }
  return init;
}

function isTimeout(error: unknown) {
  return (
    error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')
  );
}

function fetchErrorResult(tool: ToolDef, error: unknown) {
  const timedOut = isTimeout(error);
  return stableError(
    tool,
    timedOut ? 'timeout' : 'upstream_unavailable',
    timedOut ? 'Anime List read timed out.' : 'Anime List is temporarily unavailable.',
    true
  );
}

function parseResponseText(tool: ToolDef, text: string | null) {
  if (text === null)
    return {
      error: stableError(
        tool,
        'invalid_upstream_response',
        'Anime List response exceeded the read bound.'
      ),
    };
  try {
    return { value: JSON.parse(text) as unknown };
  } catch {
    return {
      error: stableError(tool, 'invalid_upstream_response', 'Anime List returned invalid JSON.'),
    };
  }
}

function continuation(tool: ToolDef, args: Record<string, unknown>, parsed: unknown) {
  if (!parsed || typeof parsed !== 'object') return undefined;
  const page = 'pageInfo' in parsed ? parsed.pageInfo : parsed;
  if (!page || typeof page !== 'object' || !('nextOffset' in page)) return undefined;
  if (typeof page.nextOffset !== 'number') return null;
  return { name: tool.name, arguments: { ...args, offset: page.nextOffset } };
}

function addCatalogPageInfo(
  parsed: unknown,
  tool: ToolDef,
  args: Record<string, unknown>
): unknown {
  if (!['search_anime', 'search_manga'].includes(tool.name)) return parsed;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return parsed;

  const record = parsed as Record<string, unknown>;
  const results = Array.isArray(record.filteredList) ? record.filteredList : [];
  const total = Number(record.totalFiltered);
  const limit = Number(args.pagesize ?? 20);
  const offset = Number(args.offset ?? 0);
  if (!Number.isFinite(total) || !Number.isFinite(limit) || !Number.isFinite(offset)) return parsed;

  const returned = results.length;
  const nextOffset = offset + returned;
  const hasMore = returned > 0 && nextOffset < total;

  return {
    ...record,
    pageInfo: {
      limit,
      offset,
      returned,
      total,
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(total / limit),
      hasMore,
      nextOffset: hasMore ? nextOffset : null,
    },
  };
}

function buildToolHandler(
  dispatch: DispatchApi,
  origin: string,
  tool: ToolDef,
  readCredential: string | null
) {
  return async (args: Record<string, unknown>) => {
    const url = tool.buildUrl ? tool.buildUrl(origin, args) : `${origin}${tool.path}`;
    const personal =
      tool.auth ||
      args.sortBy === 'recommended' ||
      [args.includeWatched, args.hideWatched].some(
        (list) => Array.isArray(list) && list.length > 0
      );
    if (personal && !readCredential) {
      return stableError(tool, 'unauthorized', AUTH_ERROR_MESSAGE);
    }

    let res: Response;
    try {
      res = await boundedFetch(
        dispatch,
        url,
        buildRequestInit(tool, args, personal ? readCredential : null)
      );
    } catch (error) {
      return fetchErrorResult(tool, error);
    }

    if (!res.ok) return errorForStatus(tool, res.status);

    const parsed = parseResponseText(tool, await boundedResponseText(res));
    if (parsed.error) return parsed.error;
    const normalized = addCatalogPageInfo(parsed.value, tool, args);
    const nextCall = continuation(tool, args, normalized);
    const safeData = stripSensitive(addCanonicalUrls(normalized, tool.name));
    const data = {
      schemaVersion: '1' as const,
      ok: true,
      tool: tool.name,
      generatedAt: new Date().toISOString(),
      retrievalMode: personal ? ('owner-watchlist' as const) : ('public-catalog' as const),
      data: safeData,
      truncated: Boolean(nextCall),
      nextCall,
      sourceUrl: url,
    };
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            tool: tool.name,
            nextCall,
            truncated: data.truncated,
            data: safeData,
          }),
        },
      ],
      structuredContent: outputSchema.parse(data),
    };
  };
}

function buildServer(
  dispatch: DispatchApi,
  origin: string,
  authHeader: string | null,
  federated: boolean,
  session: ResolveSession
): McpServer {
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
        inputSchema: z.strictObject(tool.inputSchema ?? {}),
        outputSchema: outputSchema.extend({ data: catalogOutputs[tool.name].optional() }),
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: !tool.auth,
        },
      },
      buildToolHandler(dispatch, origin, tool, readCredential)
    );
  }

  registerAssistantTools(server, assistantTools, session);
  return server;
}

export async function handleMcpRequest(
  request: Request,
  dispatch: DispatchApi,
  authHeader: string | null,
  federated = false,
  session: ResolveSession = async () => ({ userId: '', canWrite: false, env: {} })
): Promise<Response> {
  const origin = new URL(request.url).origin;
  // Stateless, JSON responses — no SSE, no session state. Ideal for
  // read-only tools on Workers where isolates don't share in-memory state.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  // Preserve protocol negotiation while giving SDK validation failures a machine-readable code.
  const send = transport.send.bind(transport);
  transport.send = (message, options) => {
    if ('result' in message && message.result.isError && !message.result.structuredContent) {
      const content = message.result.content;
      const text =
        Array.isArray(content) && typeof content[0]?.text === 'string' ? content[0].text : '';
      const invalid = text.includes('Invalid arguments for tool');
      const error = invalid
        ? { code: 'invalid_argument', message: text.slice(0, 1500), retryable: false }
        : {
            code: 'upstream_unavailable',
            message: 'The tool could not complete the request.',
            retryable: true,
          };
      return send(
        {
          ...message,
          result: {
            isError: true,
            structuredContent: { ok: false, error },
            content: [{ type: 'text', text: error.message }],
          },
        },
        options
      );
    }
    return send(message, options);
  };
  const server = buildServer(dispatch, origin, authHeader, federated, session);
  await server.connect(transport);
  const response = await transport.handleRequest(request);
  await server.close();
  return response;
}
