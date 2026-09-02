/// <reference types="@cloudflare/workers-types" />
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { isAllowedOrigin } from './corsOrigins';
import { SignJWT, jwtVerify, createRemoteJWKSet } from 'jose';
import { isRs256Jwt, verifyAnimeAuth0Subject } from './auth0Mcp';
import { handleAgentEdge } from './agent-edge.mjs';
import { isWriteFrozenRequest } from './writeFreeze';
import {
  CATALOG_UNAVAILABLE_CODE,
  CATALOG_UNAVAILABLE_MESSAGE,
  isCatalogDatabaseError,
} from '../lib/apiErrors';

// Business logic imports (all unchanged files)
import {
  addDismissedAnime,
  deleteUserTag,
  getAnimeWatchlist,
  getAnimeWatchlistEntry,
  getDismissedAnime,
  getMangaWatchlist,
  importAnimeWatchlistEntries,
  upsertAnimeWatchlist,
  updateAnimeWatchlistNote,
  deleteFromAnimeWatchlist,
  getUserTags,
  updateUserTag,
  upsertUserTag,
} from './db/watchlist';
import { getAnimeStats } from './statistics';
import { animeStore } from './store/animeStore';
import { mangaStore } from './store/mangaStore';
import {
  getAnimeByMalId,
  getLastDataUpdate,
  getRecentChanges,
  getSimpleAnimeSearchPage,
} from './db/animeData';
import { getLastMangaDataUpdate } from './db/mangaData';
import { findOrCreateUser, findUserByGoogleId } from './db/users';
import {
  hideWatchedItems,
  includeOnlyWatchedItems,
  parseTagQuery,
  takePage,
} from './controllers/helpers';
import { filterRequestSchema } from './validators/animeFilters';
import { watchedListRemoveSchema, watchedListSchema } from './validators/watchedList';
import {
  watchlistTagDeleteSchema,
  watchlistTagSchema,
  watchlistTagUpdateSchema,
} from './validators/watchlistTags';
import {
  buildAniListExport,
  buildShelfCsvExport,
  buildShelfJsonExport,
  applyImportMode,
  parseImportPayload,
  withImportConflicts,
  type WatchlistImportMode,
  type WatchlistImportPreview,
} from './watchlistSync';
import {
  addToScheduleSchema,
  updateScheduleItemSchema,
  removeFromScheduleSchema,
  reorderScheduleSchema,
} from './validators/schedule';
import {
  updateScheduleItem as dbUpdateScheduleItem,
  removeScheduleItems,
  reorderSchedule as dbReorderSchedule,
} from './db/schedule';
import { bindD1Database } from './db/client';
import { getAnimeDetailSupplementalData } from './controllers/animeDetailService';
import { executeSearch } from './controllers/searchController';
import { buildScheduleTimelineResponse, addScheduleItems } from './services/scheduleService';
import { buildTasteRecommendations } from './recommendations';
import { registerMangaRoutes } from './worker/mangaRoutes';
import { handleMcpRequest } from './worker/mcpRoutes';
import { boundedReadPage, compareWatchlistIds, pageReadItems } from './worker/readPagination';
import {
  createApiToken,
  isApiToken,
  listApiTokens,
  revokeApiToken,
  resolveApiToken,
  touchApiTokenLastUsed,
} from './db/apiTokens';
import { createTokenSchema, revokeTokenParamsSchema } from './validators/apiTokens';
import {
  NUMERIC_FIELDS,
  ARRAY_FIELDS,
  STRING_FIELDS,
  COMPARISON_ACTIONS,
  ARRAY_ACTIONS,
} from './types/anime';
import type { AnimeDetailResponse } from './types/animeDetail';
import { animeDetailNoteSchema, animeMalIdParamsSchema } from './validators/animeDetail';
import { z } from 'zod';

const discoverDismissSchema = z.object({
  mal_ids: z.array(z.string().or(z.number())).min(1),
});

// ── Types ──────────────────────────────────────────────────────────────

interface AuthPayload {
  userId: string;
  email: string;
  name: string;
  picture?: string;
}

type Env = {
  DB: D1Database;
  WRITE_FREEZE?: string;
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  POSTHOG_API_KEY?: string;
  AUTH0_ISSUER?: string;
  AUTH0_MCP_AUDIENCE?: string;
};

const STATS_CACHE_TTL_SECONDS = 300;
// last-updated is a global, public, non-user value that changes once daily via
// the cron sync. Edge-caching it keeps the only previously-uncached public read
// endpoint off two full-table MAX(updated_at) scans on every request.
const LAST_UPDATED_CACHE_TTL_SECONDS = 300;
const LAST_UPDATED_CACHE_URL = 'https://mal-cache.local/api/last-updated?v=2';

// ── JWT helpers (using jose instead of jsonwebtoken) ───────────────────

const getJwtSecret = () =>
  new TextEncoder().encode(process.env.JWT_SECRET || 'mal-explorer-dev-secret-change-in-prod');

async function signToken(payload: AuthPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(getJwtSecret());
}

async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as AuthPayload;
  } catch {
    return null;
  }
}

function extractBearerToken(header: string | undefined): string | null {
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

// ── Cookie helpers (XSS hardening: token lives in httpOnly cookie) ─────

const AUTH_COOKIE_NAME = 'mal_auth_token';
const AUTH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days, matches signToken TTL

function isLocalhostHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function buildAuthCookie(token: string, host: string): string {
  // Local dev runs on plain HTTP localhost, so we must avoid Secure there.
  // Production and preview deployments still use cross-site cookies.
  if (isLocalhostHost(host)) {
    return `${AUTH_COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${AUTH_COOKIE_MAX_AGE}`;
  }
  return `${AUTH_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${AUTH_COOKIE_MAX_AGE}`;
}

function buildAuthClearCookie(host: string): string {
  if (isLocalhostHost(host)) {
    return `${AUTH_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
  }
  return `${AUTH_COOKIE_NAME}=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`;
}

function getRequestHostname(c: { req: { url: string } }): string {
  return new URL(c.req.url).hostname;
}

function readAuthCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)mal_auth_token=([^;]+)/);
  return match?.[1] ?? null;
}

function extractToken(c: { req: { header: (name: string) => string | undefined } }): string | null {
  return (
    extractBearerToken(c.req.header('Authorization')) || readAuthCookie(c.req.header('Cookie'))
  );
}

// Resolve a bearer or cookie token to a user. Accepts a Personal Access Token
// (anime_list_..., bearer-only; legacy shelf_ tokens remain valid) or an existing JWT.
// PATs are looked up by hash and
// their last_used_at is touched best-effort via waitUntil.
async function resolveUser(
  token: string,
  env: Env,
  ctx?: { waitUntil: (p: Promise<unknown>) => void }
): Promise<AuthPayload | null> {
  if (isApiToken(token)) {
    const resolved = await resolveApiToken(token);
    if (!resolved) return null;
    if (ctx) ctx.waitUntil(touchApiTokenLastUsed(resolved.tokenId));
    return { userId: resolved.userId, email: '', name: '' };
  }
  if (isRs256Jwt(token)) {
    const googleId = await verifyAnimeAuth0Subject(token, env);
    if (!googleId) return null;
    const user = await findUserByGoogleId(googleId);
    return user
      ? { userId: user.id, email: user.email, name: user.name, picture: user.picture }
      : null;
  }
  return verifyToken(token);
}

// ── Google OAuth (using jose JWKS instead of google-auth-library) ──────

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

// ── Hono app ───────────────────────────────────────────────────────────

type AppContext = Context<{ Bindings: Env; Variables: { user?: AuthPayload } }>;

const app = new Hono<{ Bindings: Env; Variables: { user?: AuthPayload } }>();

// Fleet agent indexing (GEO) — must register before SPA asset fallback.
app.use('*', async (c, next) => {
  const agent = handleAgentEdge(c.req.raw);
  if (agent) return agent;
  return next();
});

const toDetailAnime = (anime: NonNullable<Awaited<ReturnType<typeof getAnimeByMalId>>>) => ({
  mal_id: anime.mal_id,
  url: anime.url,
  title: anime.title,
  title_english: anime.title_english,
  type: anime.type,
  episodes: anime.episodes,
  score: anime.score,
  scored_by: anime.scored_by,
  rank: anime.rank,
  status: anime.status,
  popularity: anime.popularity,
  members: anime.members,
  favorites: anime.favorites,
  synopsis: anime.synopsis,
  year: anime.year,
  season: anime.season,
  image: anime.image,
  genres: Object.keys(anime.genres ?? {}),
  themes: Object.keys(anime.themes ?? {}),
  demographics: Object.keys(anime.demographics ?? {}),
});

// Bind relational persistence before any route touches domain state.
app.use('*', async (c, next) => {
  bindD1Database(c.env.DB);
  if (isWriteFrozenRequest(c.req.method, c.env.WRITE_FREEZE)) {
    c.header('Retry-After', '60');
    return c.json(
      {
        error: 'Writes are briefly paused while database maintenance completes.',
        code: 'write_frozen',
      },
      503
    );
  }
  process.env.JWT_SECRET = c.env.JWT_SECRET;
  process.env.GOOGLE_CLIENT_ID = c.env.GOOGLE_CLIENT_ID;
  await next();
});

// CORS
app.use(
  '*',
  cors({
    origin: (origin) => (isAllowedOrigin(origin) ? origin : undefined),
    allowMethods: ['GET', 'POST'],
    allowHeaders: ['Content-Type', 'Authorization'],
    // Required for the browser to attach the httpOnly cookie cross-origin.
    credentials: true,
  })
);

// ── Auth middleware ─────────────────────────────────────────────────────

const optionalAuth = async (
  c: {
    req: { header: (name: string) => string | undefined };
    set: (key: string, value: unknown) => void;
    executionCtx: { waitUntil: (p: Promise<unknown>) => void };
  },
  next: () => Promise<void>
) => {
  const token = extractToken(c);
  if (token) {
    const user = await resolveUser(token, c.env as Env, c.executionCtx);
    if (user) c.set('user', user);
  }
  await next();
};

const requireAuth = async (
  c: {
    req: { header: (name: string) => string | undefined };
    set: (key: string, value: unknown) => void;
    json: (data: unknown, status?: number) => Response;
    executionCtx: { waitUntil: (p: Promise<unknown>) => void };
    env: Env;
  },
  next: () => Promise<void>
) => {
  const token = extractToken(c);
  if (!token) return c.json({ error: 'Authentication required' }, 401);
  const user = await resolveUser(token, c.env, c.executionCtx);
  if (!user) return c.json({ error: 'Invalid or expired token' }, 401);
  c.set('user', user);
  await next();
};

// ── Routes ─────────────────────────────────────────────────────────────

// Auth
app.post('/api/auth/google', async (c) => {
  const { credential } = await c.req.json();
  if (!credential || typeof credential !== 'string') {
    return c.json({ error: 'Missing Google credential token' }, 400);
  }

  const clientId = c.env.GOOGLE_CLIENT_ID;
  if (!clientId) return c.json({ error: 'Google OAuth not configured' }, 500);

  try {
    const { payload } = await jwtVerify(credential, GOOGLE_JWKS, {
      audience: clientId,
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
    });

    if (!payload.sub || !payload.email) {
      return c.json({ error: 'Invalid Google token' }, 400);
    }

    const user = await findOrCreateUser({
      googleId: payload.sub,
      email: payload.email as string,
      name: (payload.name as string) || (payload.email as string),
      picture: payload.picture as string | undefined,
    });

    const token = await signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
    });

    // Set token in httpOnly cookie (XSS hardening). The token is also returned
    // in the body for backward compatibility during migration; the frontend
    // no longer needs to persist it.
    c.header('Set-Cookie', buildAuthCookie(token, getRequestHostname(c)), { append: true });

    return c.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
  } catch (err) {
    console.error('Google OAuth error:', err);
    return c.json({ error: 'Invalid Google token' }, 400);
  }
});

// Logout: clear the auth cookie
app.post('/api/auth/logout', (c) => {
  c.header('Set-Cookie', buildAuthClearCookie(new URL(c.req.url).hostname), { append: true });
  return c.json({ ok: true });
});

// Static data
app.get('/api/fields', (c) =>
  c.json({
    numeric: NUMERIC_FIELDS,
    array: ARRAY_FIELDS,
    string: STRING_FIELDS,
  })
);

app.get('/api/filters', (c) => c.json({ comparison: COMPARISON_ACTIONS, array: ARRAY_ACTIONS }));

app.get('/api/last-updated', async (c) => {
  const edgeCache = (caches as unknown as { default: Cache }).default;
  const cacheRequest = new Request(LAST_UPDATED_CACHE_URL);

  const cachedResponse = await edgeCache.match(cacheRequest);
  if (cachedResponse) {
    const response = new Response(cachedResponse.body, cachedResponse);
    response.headers.set('X-Last-Updated-Cache', 'HIT');
    return response;
  }

  const [anime, manga] = await Promise.all([getLastDataUpdate(), getLastMangaDataUpdate()]);
  const timestamps = [anime, manga].filter(Boolean) as string[];
  const lastUpdated =
    timestamps.length > 0
      ? timestamps.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
      : null;

  const response = c.json({ lastUpdated, anime, manga });
  response.headers.set('X-Last-Updated-Cache', 'MISS');
  const cacheableResponse = new Response(response.body, response);
  cacheableResponse.headers.set(
    'Cache-Control',
    `public, max-age=0, s-maxage=${LAST_UPDATED_CACHE_TTL_SECONDS}`
  );
  c.executionCtx.waitUntil(edgeCache.put(cacheRequest, cacheableResponse.clone()));
  return cacheableResponse;
});

app.get('/api/changelog', async (c) => {
  const limit = Math.min(Number(c.req.query('limit')) || 200, 500);
  const changes = await getRecentChanges(limit);
  return c.json({ changes });
});

// Search
app.post('/api/search', optionalAuth, async (c) => {
  const body = await c.req.json();
  const parsed = filterRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: 'Invalid search payload',
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      },
      400
    );
  }
  const user = c.get('user');
  const { filters, sortBy, airing, hideWatched, includeWatched, pagesize, offset } = parsed.data;
  const result = await executeSearch({
    filters,
    sortBy,
    airing,
    hideWatched,
    includeWatched,
    pagesize,
    offset,
    userId: user?.userId,
  });
  const response = c.json({
    totalFiltered: result.totalFiltered,
    filteredList: result.filteredList,
  });
  response.headers.set('X-Search-Cache', 'BYPASS');
  response.headers.set('X-Search-Path', result.cachePath);
  return response;
});

// Stats
const STATS_CACHE_URL = 'https://mal-cache.local/api/stats?v=1';

async function filterStatsAnimeList(
  userId: string | undefined,
  includeWatched: string[],
  hideWatched: string[]
): Promise<AnimeItem[]> {
  let animeList = await animeStore.getAnimeList();

  if (userId && includeWatched.length > 0) {
    animeList = await includeOnlyWatchedItems(
      animeList,
      includeWatched,
      () => getAnimeWatchlist(userId),
      (list) => list.anime
    );
  } else if (userId && hideWatched.length > 0) {
    const watchlist = await getAnimeWatchlist(userId);
    const includeWatchedFromHide = watchlist
      ? Array.from(
          new Set(
            Object.values(watchlist.anime)
              .map((item) => item.status)
              .filter((status) => !hideWatched.includes(status))
          )
        )
      : [];
    animeList = await includeOnlyWatchedItems(
      animeList,
      includeWatchedFromHide,
      () => getAnimeWatchlist(userId),
      (list) => list.anime
    );
  }
  return animeList;
}

app.get('/api/stats', optionalAuth, async (c) => {
  const user = c.get('user');
  const includeWatched = parseTagQuery(c.req.query('includeWatched'));
  const hideWatched = parseTagQuery(c.req.query('hideWatched'));

  const isBaseStats = !user?.userId && includeWatched.length === 0 && hideWatched.length === 0;
  const edgeCache = (caches as unknown as { default: Cache }).default;
  const baseCacheRequest = isBaseStats ? new Request(STATS_CACHE_URL) : null;

  if (baseCacheRequest) {
    const cachedResponse = await edgeCache.match(baseCacheRequest);
    if (cachedResponse) {
      const response = new Response(cachedResponse.body, cachedResponse);
      response.headers.set('X-Stats-Cache', 'HIT');
      return response;
    }
  }

  const animeList = await filterStatsAnimeList(user?.userId, includeWatched, hideWatched);
  const stats = await getAnimeStats(animeList);
  const response = c.json(stats);

  if (baseCacheRequest) {
    response.headers.set('X-Stats-Cache', 'MISS');
    const cacheableResponse = new Response(response.body, response);
    cacheableResponse.headers.set(
      'Cache-Control',
      `public, max-age=0, s-maxage=${STATS_CACHE_TTL_SECONDS}`
    );
    c.executionCtx.waitUntil(edgeCache.put(baseCacheRequest, cacheableResponse.clone()));
    return cacheableResponse;
  }

  response.headers.set('X-Stats-Cache', 'BYPASS');
  return response;
});

// NOTE: must be registered before /api/anime/:malId — Hono matches routes in
// registration order, so the param route would otherwise swallow "random"
// and return 400 from the malId validator.
app.get('/api/anime/random', async (c) => {
  const genre = (c.req.query('genre') || '').trim();
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '1', 10) || 1, 1), 20);

  let catalog = await animeStore.getAnimeList();
  if (genre) {
    const normalizedGenre = genre.toLowerCase();
    catalog = catalog.filter((anime) =>
      Object.keys(anime.genres).some((g) => g.toLowerCase() === normalizedGenre)
    );
  }

  if (catalog.length === 0) {
    return c.json({ results: [] });
  }

  const shuffled = [...catalog].sort(() => Math.random() - 0.5);
  const results = shuffled.slice(0, limit).map((anime) => ({
    mal_id: anime.mal_id,
    id: anime.mal_id,
    title: anime.title,
    title_english: anime.title_english,
  }));

  return c.json({ results });
});

// Anime / manga catalogs refresh once per day, so detail responses for
// anonymous traffic are safe to cache for ~24h. Signed-in users embed
// per-user watchlist state into the response, so we deliberately skip
// the cache entirely when a user is attached. Cache key bumps via the
// :v1 suffix below.
const ANIME_DETAIL_CACHE_TTL_SECONDS = 24 * 60 * 60;
const ANIME_DETAIL_CACHE_KEY_PREFIX = 'https://mal-cache.local/api/anime/';

app.get('/api/anime/:malId', optionalAuth, async (c) => {
  const parsed = animeMalIdParamsSchema.safeParse({
    malId: c.req.param('malId'),
  });
  if (!parsed.success) {
    return c.json({ error: 'Invalid anime id', details: parsed.error.issues }, 400);
  }

  const malId = parsed.data.malId;
  const user = c.get('user');
  // Only cache anonymous responses — authenticated responses embed the
  // signed-in user's watchlistEntry, which is per-user data.
  const edgeCache = (caches as unknown as { default: Cache }).default;
  const cacheUrl = user ? null : `${ANIME_DETAIL_CACHE_KEY_PREFIX}${malId}:v1`;

  if (cacheUrl) {
    const cached = await edgeCache.match(cacheUrl);
    if (cached) {
      const hit = new Response(cached.body, cached);
      hit.headers.set('X-Detail-Cache', 'HIT');
      return hit;
    }
  }

  const anime = await getAnimeByMalId(malId);

  if (!anime) {
    return c.json({ error: 'Anime not found' }, 404);
  }

  const [supplemental, watchlistEntry, animeList] = await Promise.all([
    getAnimeDetailSupplementalData(malId),
    user ? getAnimeWatchlistEntry(String(malId), user.userId) : Promise.resolve(null),
    animeStore.getAnimeList(),
  ]);
  const animeMap = new Map(animeList.map((item) => [item.mal_id, item] as const));

  const response: AnimeDetailResponse = {
    anime: toDetailAnime(anime),
    relations: supplemental.relations.flatMap((group) =>
      group.entries.map((entry) => {
        const relatedAnime = animeMap.get(entry.mal_id);
        return {
          mal_id: entry.mal_id,
          relation: group.relation,
          title: relatedAnime?.title || entry.name,
          title_english: relatedAnime?.title_english,
          image: relatedAnime?.image,
          type: relatedAnime?.type || entry.type,
          status: relatedAnime?.status,
          episodes: relatedAnime?.episodes,
          year: relatedAnime?.year,
          url: relatedAnime?.url || entry.url,
        };
      })
    ),
    recommendations: supplemental.recommendations.map((recommendation) => {
      const recommendedAnime = animeMap.get(recommendation.entry.mal_id);
      return {
        mal_id: recommendation.entry.mal_id,
        title: recommendedAnime?.title || recommendation.entry.title,
        title_english: recommendedAnime?.title_english,
        image: recommendedAnime?.image || recommendation.entry.image,
        type: recommendedAnime?.type,
        status: recommendedAnime?.status,
        episodes: recommendedAnime?.episodes,
        year: recommendedAnime?.year,
        url: recommendedAnime?.url || recommendation.entry.url,
        votes: recommendation.votes ?? 0,
      };
    }),
    watchlistEntry: watchlistEntry
      ? {
          status: watchlistEntry.status,
          note: watchlistEntry.note || null,
        }
      : null,
  };

  const jsonResponse = c.json(response);
  if (cacheUrl) {
    const cacheable = new Response(jsonResponse.body, jsonResponse);
    cacheable.headers.set(
      'Cache-Control',
      `public, max-age=0, s-maxage=${ANIME_DETAIL_CACHE_TTL_SECONDS}`
    );
    cacheable.headers.set('X-Detail-Cache', 'MISS');
    c.executionCtx.waitUntil(edgeCache.put(cacheUrl, cacheable.clone()));
    return cacheable;
  }
  jsonResponse.headers.set('X-Detail-Cache', 'BYPASS');
  return jsonResponse;
});

app.post('/api/anime/:malId/note', requireAuth, async (c) => {
  const parsedParams = animeMalIdParamsSchema.safeParse({
    malId: c.req.param('malId'),
  });
  if (!parsedParams.success) {
    return c.json({ error: 'Invalid anime id', details: parsedParams.error.issues }, 400);
  }

  const body = await c.req.json();
  const parsedBody = animeDetailNoteSchema.safeParse(body);
  if (!parsedBody.success) {
    return c.json({ error: 'Invalid anime note payload', details: parsedBody.error.issues }, 400);
  }

  const user = c.get('user')!;
  const normalizedNote = parsedBody.data.note.trim();
  const updated = await updateAnimeWatchlistNote(
    String(parsedParams.data.malId),
    normalizedNote.length > 0 ? normalizedNote : null,
    user.userId
  );

  if (!updated) {
    return c.json({ error: 'Anime is not in the watchlist' }, 404);
  }

  return c.json({ success: true, message: 'Watchlist note updated' });
});

// Watchlist
app.get('/api/watchlist', requireAuth, async (c) => {
  const user = c.get('user')!;
  const watchlist = await getAnimeWatchlist(user.userId);
  const status = (c.req.query('status') || '').trim();

  if (!watchlist) return c.json({ error: 'Watchlist not found' }, 404);

  const filteredAnime = Object.values(watchlist.anime)
    .filter((item) => !status || item.status === status)
    .sort(compareWatchlistIds);
  const paginated = c.req.query('limit') !== undefined || c.req.query('offset') !== undefined;

  if (paginated) {
    return c.json(
      pageReadItems(filteredAnime, boundedReadPage(c.req.query('limit'), c.req.query('offset')))
    );
  }

  if (status) return c.json(filteredAnime);

  return c.json(watchlist);
});

app.get('/api/watchlist/tags', requireAuth, async (c) => {
  const user = c.get('user')!;
  const tags = await getUserTags(user.userId);
  const paginated = c.req.query('limit') !== undefined || c.req.query('offset') !== undefined;
  return c.json(
    paginated
      ? pageReadItems(tags, boundedReadPage(c.req.query('limit'), c.req.query('offset')))
      : { tags }
  );
});

app.post('/api/watchlist/tags', requireAuth, async (c) => {
  const body = await c.req.json();
  const parsed = watchlistTagSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid watchlist tag payload', details: parsed.error.issues }, 400);
  }

  const user = c.get('user')!;
  await upsertUserTag(parsed.data.tag, user.userId, parsed.data.color);
  return c.json({ success: true, message: 'Tag saved' });
});

app.post('/api/watchlist/tags/:tagId/update', requireAuth, async (c) => {
  const body = await c.req.json();
  const parsed = watchlistTagUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: 'Invalid watchlist tag update payload', details: parsed.error.issues },
      400
    );
  }

  const user = c.get('user')!;
  await updateUserTag(c.req.param('tagId'), user.userId, {
    tag: parsed.data.tag,
    color: parsed.data.color,
  });
  return c.json({ success: true, message: 'Tag updated' });
});

app.post('/api/watchlist/tags/:tagId/delete', requireAuth, async (c) => {
  const body = await c.req.json();
  const parsed = watchlistTagDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: 'Invalid watchlist tag delete payload', details: parsed.error.issues },
      400
    );
  }

  const user = c.get('user')!;
  await deleteUserTag(c.req.param('tagId'), user.userId, parsed.data.moveToTagId);
  return c.json({ success: true, message: 'Tag deleted' });
});

app.get('/api/watchlist/recommendations', requireAuth, async (c) => {
  const user = c.get('user')!;
  const watchlist = await getAnimeWatchlist(user.userId);

  if (!watchlist) {
    return c.json({
      profile: {
        favoriteGenres: [],
        favoriteThemes: [],
        preferredTypes: [],
        sampledTitles: 0,
      },
      recommendations: [],
    });
  }

  const allAnime = await animeStore.getAnimeList();
  return c.json(buildTasteRecommendations(allAnime, watchlist));
});

app.get('/api/watchlist/enriched', requireAuth, async (c) => {
  const user = c.get('user')!;
  const watchlist = await getAnimeWatchlist(user.userId);

  if (!watchlist) return c.json({ items: [] });

  const allAnime = await animeStore.getAnimeList();
  const animeMap = new Map(allAnime.map((a) => [a.mal_id.toString(), a]));

  // Synopsis was historically included but is unused by the watchlist UI; on
  // a 500-row list it added ~150 KB of body. Detail page fetches the full
  // anime payload separately.
  const items = Object.values(watchlist.anime)
    .sort(compareWatchlistIds)
    .map((entry) => {
      const anime = animeMap.get(entry.id);
      return {
        mal_id: entry.id,
        watchStatus: entry.status,
        note: entry.note,
        title: anime?.title_english || anime?.title || entry.title || `ID: ${entry.id}`,
        image: anime?.image,
        score: anime?.score,
        year: anime?.year,
        type: anime?.type,
        episodes: anime?.episodes,
        members: anime?.members,
        genres: anime ? Object.keys(anime.genres) : [],
        url: anime?.url,
      };
    });

  const paginated = c.req.query('limit') !== undefined || c.req.query('offset') !== undefined;
  return c.json(
    paginated
      ? pageReadItems(items, boundedReadPage(c.req.query('limit'), c.req.query('offset')))
      : { items }
  );
});

type WatchlistImportSource = 'mal' | 'anilist' | 'shelf';

type ImportRequestResult =
  | { ok: true; source: WatchlistImportSource; preview: WatchlistImportPreview }
  | { ok: false; error: string; status: number };

function parseImportRequest(body: { source?: unknown; payload?: unknown }): ImportRequestResult {
  const source: WatchlistImportSource =
    body.source === 'anilist' ? 'anilist' : body.source === 'shelf' ? 'shelf' : 'mal';
  const payload = typeof body.payload === 'string' ? body.payload : '';
  if (!payload.trim()) {
    return { ok: false, error: 'Import payload is required', status: 400 };
  }
  const preview = parseImportPayload(source, payload);
  if (!preview) {
    return { ok: false, error: 'Invalid import payload', status: 400 };
  }
  return { ok: true, source, preview };
}

app.post('/api/watchlist/import/preview', requireAuth, async (c) => {
  const body = await c.req.json();
  const user = c.get('user')!;
  const parsed = parseImportRequest(body);
  if (!parsed.ok) {
    return c.json({ error: parsed.error }, parsed.status);
  }
  const watchlist = await getAnimeWatchlist(user.userId);
  return c.json(withImportConflicts(parsed.preview, watchlist?.anime ?? {}));
});

app.post('/api/watchlist/import/apply', requireAuth, async (c) => {
  const body = await c.req.json();
  const user = c.get('user')!;
  const parsed = parseImportRequest(body);
  if (!parsed.ok) {
    return c.json({ error: parsed.error }, parsed.status);
  }
  const mode: WatchlistImportMode =
    body.mode === 'replace' ? 'replace' : body.mode === 'skip' ? 'skip' : 'merge';
  const watchlist = await getAnimeWatchlist(user.userId);
  const existing = watchlist?.anime ?? {};
  const resolvedPreview = withImportConflicts(parsed.preview, existing);
  const entries = applyImportMode(resolvedPreview, existing, mode);
  const result = await importAnimeWatchlistEntries(entries, user.userId);
  return c.json({ ...resolvedPreview, imported: result.imported, mode });
});

app.get('/api/watchlist/export/anilist', requireAuth, async (c) => {
  const user = c.get('user')!;
  const watchlist = await getAnimeWatchlist(user.userId);
  return c.json({
    source: 'anilist',
    entries: watchlist ? buildAniListExport(watchlist.anime) : [],
  });
});

app.get('/api/watchlist/export/json', requireAuth, async (c) => {
  const user = c.get('user')!;
  const watchlist = await getAnimeWatchlist(user.userId);
  return c.json(watchlist ? buildShelfJsonExport(watchlist.anime) : { version: 1, anime: [] });
});

app.get('/api/watchlist/export/csv', requireAuth, async (c) => {
  const user = c.get('user')!;
  const watchlist = await getAnimeWatchlist(user.userId);
  const csv = watchlist
    ? buildShelfCsvExport(watchlist.anime)
    : 'mal_id,title,status,type,episodes,note';
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="anime-list-watchlist.csv"',
    },
  });
});

app.post('/api/watched/add', requireAuth, async (c) => {
  const body = await c.req.json();
  const parsed = watchedListSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid watchlist payload', details: parsed.error.issues }, 400);
  }

  const user = c.get('user')!;
  await upsertAnimeWatchlist(
    parsed.data.mal_ids,
    parsed.data.status,
    user.userId,
    parsed.data.tagColor
  );
  return c.json({ success: true, message: 'Anime added to watched list' });
});

app.post('/api/watched/remove', requireAuth, async (c) => {
  const body = await c.req.json();
  const parsed = watchedListRemoveSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid watchlist payload', details: parsed.error.issues }, 400);
  }

  const user = c.get('user')!;
  await deleteFromAnimeWatchlist(parsed.data.mal_ids, user.userId);
  return c.json({ success: true, message: 'Anime removed from watchlist' });
});

// Schedule
app.get('/api/schedule/timeline', requireAuth, async (c) => {
  const user = c.get('user')!;
  return c.json(await buildScheduleTimelineResponse(user.userId));
});

app.post('/api/schedule/add', requireAuth, async (c) => {
  const body = await c.req.json();
  const parsed = addToScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid schedule payload', details: parsed.error.issues }, 400);
  }
  const user = c.get('user')!;
  await addScheduleItems(user.userId, parsed.data.mal_ids, parsed.data.episodes_per_day);
  return c.json({ success: true, message: 'Added to schedule' });
});

app.post('/api/schedule/:malId/update', requireAuth, async (c) => {
  const body = await c.req.json();
  const parsed = updateScheduleItemSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid schedule update payload', details: parsed.error.issues }, 400);
  }
  const user = c.get('user')!;
  await dbUpdateScheduleItem(user.userId, c.req.param('malId'), {
    episodesPerDay: parsed.data.episodes_per_day,
    episodesWatched: parsed.data.episodes_watched,
  });
  return c.json({ success: true, message: 'Schedule item updated' });
});

app.post('/api/schedule/remove', requireAuth, async (c) => {
  const body = await c.req.json();
  const parsed = removeFromScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid schedule payload', details: parsed.error.issues }, 400);
  }
  const user = c.get('user')!;
  await removeScheduleItems(user.userId, parsed.data.mal_ids);
  return c.json({ success: true, message: 'Removed from schedule' });
});

app.post('/api/schedule/reorder', requireAuth, async (c) => {
  const body = await c.req.json();
  const parsed = reorderScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid schedule reorder payload', details: parsed.error.issues }, 400);
  }
  const user = c.get('user')!;
  await dbReorderSchedule(user.userId, parsed.data.mal_ids);
  return c.json({ success: true, message: 'Schedule reordered' });
});

// Discovery Queue

const STATUS_WEIGHTS: Record<string, number> = {
  watching: 1.4,
  completed: 1.3,
  done: 1.3,
  brr: 1.15,
  avoiding: -1.6,
  deferred: -0.8,
  dropped: -1.2,
};

function getSeasonsToInclude(now: Date) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const currentSeason = ['winter', 'spring', 'summer', 'fall'][Math.floor(month / 3)];
  let prevYear = year;
  let prevSeason = currentSeason;
  if (month < 3) {
    prevSeason = 'fall';
    prevYear = year - 1;
  } else if (month < 6) prevSeason = 'winter';
  else if (month < 9) prevSeason = 'spring';
  else prevSeason = 'summer';
  return {
    year,
    currentSeason,
    seasonsToInclude: [
      { year, season: currentSeason },
      { year: prevYear, season: prevSeason },
    ],
  };
}

function buildTasteWeights(
  watchlist: { anime?: Record<string, { status?: string }> } | null,
  animeById: Map<string, { genres: Record<string, unknown>; themes: Record<string, unknown> }>
) {
  const genreWeights = new Map<string, number>();
  const themeWeights = new Map<string, number>();
  for (const [malId, entry] of Object.entries(watchlist?.anime || {})) {
    const a = animeById.get(malId);
    if (!a) continue;
    const w = STATUS_WEIGHTS[entry.status?.toLowerCase() ?? ''] ?? 0.5;
    for (const g of Object.keys(a.genres)) genreWeights.set(g, (genreWeights.get(g) ?? 0) + w);
    for (const t of Object.keys(a.themes)) themeWeights.set(t, (themeWeights.get(t) ?? 0) + w);
  }
  return { genreWeights, themeWeights, hasTaste: genreWeights.size > 0 };
}

function scoreAnime(
  anime: AnimeItem,
  genreWeights: Map<string, number>,
  themeWeights: Map<string, number>,
  hasTaste: boolean,
  year: number,
  currentSeason: string
) {
  let tasteScore = 0;
  const reasons: string[] = [];
  if (hasTaste) {
    for (const g of Object.keys(anime.genres)) {
      const w = genreWeights.get(g) ?? 0;
      if (w > 0) {
        tasteScore += w * 2;
        reasons.push(g);
      } else if (w < 0) tasteScore += w;
    }
    for (const t of Object.keys(anime.themes)) {
      const w = themeWeights.get(t) ?? 0;
      if (w > 0) tasteScore += w * 1.4;
      else if (w < 0) tasteScore += w * 0.7;
    }
  }
  const qualityScore = (anime.score ?? 0) + Math.log10(Math.max(1, anime.members ?? 1)) * 0.2;
  const isCurrent = anime.year === year && anime.season?.toLowerCase() === currentSeason;
  return { anime, tasteScore, qualityScore, reasons: reasons.slice(0, 3), isCurrent };
}

function toAnimeQueueItem(anime: AnimeItem, reasons: string[]) {
  return {
    mal_id: anime.mal_id,
    id: anime.mal_id,
    title: anime.title,
    title_english: anime.title_english,
    synopsis: anime.synopsis,
    image: anime.image,
    genres: Object.keys(anime.genres),
    themes: Object.keys(anime.themes),
    year: anime.year,
    season: anime.season as string | undefined,
    score: anime.score,
    members: anime.members,
    status: anime.status as string | undefined,
    reasons,
    mediaType: 'anime' as const,
  };
}

function toMangaQueueItem(m: MangaItem) {
  return {
    mal_id: m.mal_id,
    id: m.mal_id,
    title: m.title,
    title_english: m.title_english,
    synopsis: m.synopsis,
    image: m.image,
    genres: Object.keys(m.genres),
    themes: Object.keys(m.themes),
    year: m.year,
    season: undefined as string | undefined,
    score: m.score,
    members: m.members,
    status: m.status as string | undefined,
    reasons: [] as string[],
    mediaType: 'manga' as const,
  };
}

function interleaveResults(
  animeResults: typeof toAnimeQueueItem extends () => infer R ? R[] : never,
  mangaResults: typeof toMangaQueueItem extends () => infer R ? R[] : never,
  limit: number
) {
  const blended: typeof animeResults = [];
  let ai = 0,
    mi = 0;
  const total = Math.min(limit, animeResults.length + mangaResults.length);
  for (let i = 0; i < total; i++) {
    if (mi < mangaResults.length && ai > 0 && ai % 5 === 0) blended.push(mangaResults[mi++]);
    else if (ai < animeResults.length) blended.push(animeResults[ai++]);
    else if (mi < mangaResults.length) blended.push(mangaResults[mi++]);
  }
  return blended;
}

function isSeasonalCandidate(
  anime: AnimeItem,
  seasonsToInclude: { year: number; season: string }[],
  watchlistIds: Set<string>,
  dismissedIds: Set<string>
) {
  return (
    seasonsToInclude.some(
      (s) => anime.year === s.year && anime.season?.toLowerCase() === s.season
    ) &&
    !watchlistIds.has(anime.mal_id.toString()) &&
    !dismissedIds.has(anime.mal_id.toString()) &&
    (anime.members ?? 0) >= 5000 &&
    (anime.score ?? 0) >= 6.5
  );
}

function sortByTasteAndQuality(
  a: { isCurrent: boolean; tasteScore: number; qualityScore: number },
  b: { isCurrent: boolean; tasteScore: number; qualityScore: number },
  hasTaste: boolean
) {
  if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
  const sa = hasTaste ? a.tasteScore * 0.6 + a.qualityScore * 0.4 : a.qualityScore;
  const sb = hasTaste ? b.tasteScore * 0.6 + b.qualityScore * 0.4 : b.qualityScore;
  return sb - sa;
}

function isMangaCandidate(m: MangaItem, mangaWatchlistIds: Set<string>) {
  return (
    !mangaWatchlistIds.has(m.mal_id.toString()) &&
    (m.score ?? 0) >= 7.5 &&
    (m.members ?? 0) >= 50000
  );
}

app.get('/api/discover/queue', requireAuth, async (c) => {
  const user = c.get('user')!;
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '50', 10) || 50, 1), 200);

  const { year, currentSeason, seasonsToInclude } = getSeasonsToInclude(new Date());

  const [allAnime, watchlist, dismissed, allManga, mangaWatchlist] = await Promise.all([
    animeStore.getAnimeList(),
    getAnimeWatchlist(user.userId),
    getDismissedAnime(user.userId),
    mangaStore.getMangaList(),
    getMangaWatchlist(user.userId),
  ]);

  const watchlistIds = new Set(Object.keys(watchlist?.anime || {}));
  const dismissedIds = new Set(dismissed);
  const mangaWatchlistIds = new Set(Object.keys(mangaWatchlist?.manga || {}));
  const animeById = new Map(allAnime.map((a) => [a.mal_id.toString(), a]));

  const { genreWeights, themeWeights, hasTaste } = buildTasteWeights(watchlist, animeById);

  const animeResults = allAnime
    .filter((anime) => isSeasonalCandidate(anime, seasonsToInclude, watchlistIds, dismissedIds))
    .map((anime) => scoreAnime(anime, genreWeights, themeWeights, hasTaste, year, currentSeason))
    .sort((a, b) => sortByTasteAndQuality(a, b, hasTaste))
    .map(({ anime, reasons }) => toAnimeQueueItem(anime, reasons));

  const mangaResults = allManga
    .filter((m) => isMangaCandidate(m, mangaWatchlistIds))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 12)
    .map(toMangaQueueItem);

  const blended = interleaveResults(animeResults, mangaResults, limit);

  return c.json({ meta: { currentSeason, currentYear: year }, results: blended });
});

app.post('/api/discover/dismiss', requireAuth, async (c) => {
  const body = await c.req.json();
  const parsed = discoverDismissSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid dismiss payload', details: parsed.error.issues }, 400);
  }

  const user = c.get('user')!;
  const malIds = parsed.data.mal_ids.map(String);
  await addDismissedAnime(user.userId, malIds);

  return c.json({ success: true, message: 'Dismissed' });
});

registerMangaRoutes(app, { requireAuth, optionalAuth });

// ── MCP server ─────────────────────────────────────────────────────────
// Thin protocol adapter over the existing /api/* endpoints. Public tools
// work without auth; watchlist tools forward the caller's Authorization
// header (PAT or JWT) to the existing requireAuth-gated routes.
app.all('/api/mcp', async (c) => {
  // Reject non-POST/GET/DELETE early — the transport handles the rest, but
  // we don't want e.g. PUT hitting the SPA asset fallback.
  const method = c.req.method;
  if (method !== 'POST' && method !== 'GET' && method !== 'DELETE') {
    return c.json({ error: 'Method not allowed' }, 405);
  }
  const authHeader = c.req.header('Authorization') ?? null;
  const token = extractBearerToken(authHeader ?? undefined);
  let federated = false;
  if (token && isRs256Jwt(token)) {
    const googleId = await verifyAnimeAuth0Subject(token, c.env);
    if (!googleId)
      return c.json({ code: 'UNAUTHORIZED', message: 'Valid Anime List OAuth required.' }, 401);
    const user = await findUserByGoogleId(googleId);
    if (!user) {
      return c.json(
        {
          code: 'ACCOUNT_NOT_FOUND',
          message: 'Sign in to Anime List with the same Google account first.',
        },
        403
      );
    }
    federated = true;
  }
  return handleMcpRequest(c.req.raw, authHeader, federated);
});

// ── Personal Access Tokens ─────────────────────────────────────────────
app.post('/api/tokens', requireAuth, async (c) => {
  const body = await c.req.json();
  const parsed = createTokenSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid token payload', details: parsed.error.issues }, 400);
  }
  const user = c.get('user')!;
  const created = await createApiToken(user.userId, parsed.data.name);
  return c.json(created);
});

app.get('/api/tokens', requireAuth, async (c) => {
  const user = c.get('user')!;
  const tokens = await listApiTokens(user.userId);
  return c.json({ tokens });
});

app.post('/api/tokens/:id/revoke', requireAuth, async (c) => {
  const parsed = revokeTokenParamsSchema.safeParse({ id: c.req.param('id') });
  if (!parsed.success) {
    return c.json({ error: 'Invalid token id', details: parsed.error.issues }, 400);
  }
  const user = c.get('user')!;
  const result = await revokeApiToken(user.userId, parsed.data.id);
  if (result.notFound) return c.json({ error: 'Token not found' }, 404);
  return c.json({ success: true });
});

app.onError((err, c) => {
  console.error(`[error] ${c.req.method} ${c.req.path}:`, err.message, err.stack);
  if (isCatalogDatabaseError(err)) {
    c.header('Retry-After', '300');
    return c.json(
      {
        error: CATALOG_UNAVAILABLE_MESSAGE,
        code: CATALOG_UNAVAILABLE_CODE,
      },
      503
    );
  }
  return c.json({ error: 'Internal Server Error' }, 500);
});

// ── Export ──────────────────────────────────────────────────────────────

import { withTiming } from './lib/timing';

export default {
  fetch: withTiming((request: Request, env: Env, ctx: ExecutionContext) =>
    app.fetch(request, env, ctx)
  ),
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    bindD1Database(env.DB);
    console.log('Cron: refreshing anime and manga caches from D1');
    await Promise.all([animeStore.setAnimeList(), mangaStore.setMangaList()]);
    console.log('Cron: caches refreshed');
  },
};
