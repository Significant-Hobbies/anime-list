import type { Hono } from 'hono';
import { filterMangaList, getMangaFieldValue } from '../dataProcessor';
import { deleteFromMangaWatchlist, getMangaWatchlist, upsertMangaWatchlist } from '../db/watchlist';
import { getMangaByMalId } from '../db/mangaData';
import { migrateMangaCatalogTable } from '../db/mangaMigrations';
import { mangaStore } from '../store/mangaStore';
import { hideWatchedItems, takePage } from '../controllers/helpers';
import { mangaFilterRequestSchema } from '../validators/mangaFilters';
import { watchedListRemoveSchema, watchedListSchema } from '../validators/watchedList';
import { ARRAY_ACTIONS, COMPARISON_ACTIONS, TEXT_SEARCH_ACTIONS } from '../types/anime';
import {
  MANGA_ARRAY_FIELDS,
  MANGA_BOOLEAN_FIELDS,
  MANGA_NUMERIC_FIELDS,
  MANGA_STRING_FIELDS,
} from '../types/manga';
import type { MangaFilterRequestBody } from '../validators/mangaFilters';
import type { MangaItem } from '../types/manga';

type AuthMiddleware = (
  c: {
    req: {
      header: (name: string) => string | undefined;
      param: (name: string) => string;
      json: () => Promise<unknown>;
      query: (name: string) => string | undefined;
    };
    set: (key: string, value: unknown) => void;
    get: (key: string) => { userId: string } | undefined;
    json: (data: unknown, status?: number) => Response;
    executionCtx: { waitUntil: (p: Promise<unknown>) => void };
  },
  next: () => Promise<void>
) => Promise<Response | undefined>;

function truncateSynopsis(text?: string, max = 180): string | undefined {
  if (!text) return undefined;
  return text.length <= max ? text : `${text.slice(0, max).trim()}…`;
}

function sortMangaList(list: MangaItem[], sortBy: MangaFilterRequestBody['sortBy']) {
  if (!sortBy) return list;
  return [...list].sort((a, b) => {
    const aValue = (getMangaFieldValue(a, sortBy) as number) || 0;
    const bValue = (getMangaFieldValue(b, sortBy) as number) || 0;
    return bValue - aValue;
  });
}

function toSummary(manga: MangaItem) {
  return {
    id: manga.mal_id,
    score: manga.score,
    points: manga.score ?? 0,
    name: manga.title,
    title_english: manga.title_english,
    link: manga.url,
    synopsis: truncateSynopsis(manga.synopsis),
    members: manga.members,
    favorites: manga.favorites,
    year: manga.year,
    status: manga.status,
    genres: Object.keys(manga.genres),
    themes: Object.keys(manga.themes),
    type: manga.type,
    image: manga.image,
    chapters: manga.chapters,
    volumes: manga.volumes,
  };
}

let mangaCatalogInitialized = false;

export function registerMangaRoutes(
  app: Hono,
  middleware: { requireAuth: AuthMiddleware; optionalAuth: AuthMiddleware }
) {
  const { requireAuth, optionalAuth } = middleware;

  app.use('/api/manga/*', async (_c, next) => {
    if (!mangaCatalogInitialized) {
      await migrateMangaCatalogTable();
      mangaCatalogInitialized = true;
    }
    await next();
  });

  app.get('/api/manga/fields', (c) =>
    c.json({
      numeric: MANGA_NUMERIC_FIELDS,
      array: MANGA_ARRAY_FIELDS,
      string: MANGA_STRING_FIELDS,
      boolean: MANGA_BOOLEAN_FIELDS,
    })
  );

  app.get('/api/manga/filters', (c) =>
    c.json({
      comparison: COMPARISON_ACTIONS,
      array: ARRAY_ACTIONS,
      text: TEXT_SEARCH_ACTIONS,
    })
  );

  app.post('/api/manga/search', optionalAuth, async (c) => {
    const body = await c.req.json();
    const parsed = mangaFilterRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          error: 'Invalid manga search payload',
          details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
        },
        400
      );
    }

    const { filters, hideWatched, pagesize, offset, sortBy } = parsed.data;
    const user = c.get('user');
    let filtered = await filterMangaList(filters);

    if (user?.userId) {
      filtered = await hideWatchedItems(
        filtered,
        hideWatched,
        () => getMangaWatchlist(user.userId),
        (list) => list.manga
      );
    }

    const sorted = sortMangaList(filtered, sortBy);
    return c.json({
      totalFiltered: filtered.length,
      filteredList: takePage(sorted, pagesize, offset).map(toSummary),
    });
  });

  app.get('/api/manga/stats', optionalAuth, async (c) => {
    const user = c.get('user');
    const hideWatched = (c.req.query('hideWatched') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    let mangaList = await mangaStore.getMangaList();
    if (user?.userId && hideWatched.length > 0) {
      mangaList = await hideWatchedItems(
        mangaList,
        hideWatched,
        () => getMangaWatchlist(user.userId),
        (list) => list.manga
      );
    }

    if (mangaList.length === 0) {
      return c.json({ error: 'No manga data found. Run db:seed:manga first.' }, 404);
    }

    const { getMangaStats } = await import('../statistics');
    return c.json(await getMangaStats(mangaList));
  });

  app.get('/api/manga/random', async (c) => {
    const genre = (c.req.query('genre') || '').trim();
    const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '1', 10) || 1, 1), 20);

    let catalog = await mangaStore.getMangaList();
    if (genre) {
      const normalizedGenre = genre.toLowerCase();
      catalog = catalog.filter((item) =>
        Object.keys(item.genres).some((g) => g.toLowerCase() === normalizedGenre)
      );
    }

    if (catalog.length === 0) {
      return c.json({ results: [] });
    }

    const shuffled = [...catalog].sort(() => Math.random() - 0.5);
    const results = shuffled.slice(0, limit).map((item) => ({
      mal_id: item.mal_id,
      id: item.mal_id,
      title: item.title,
      title_english: item.title_english,
    }));
    return c.json({ results });
  });

  app.get('/api/manga/watchlist/enriched', requireAuth, async (c) => {
    const user = c.get('user')!;
    const watchlist = await getMangaWatchlist(user.userId);
    if (!watchlist) return c.json({ items: [] });

    const allManga = await mangaStore.getMangaList();
    const mangaMap = new Map(allManga.map((m) => [m.mal_id.toString(), m]));

    const items = Object.values(watchlist.manga).map((entry) => {
      const manga = mangaMap.get(entry.id);
      return {
        mal_id: entry.id,
        watchStatus: entry.status,
        title: manga?.title_english || manga?.title || `ID: ${entry.id}`,
        image: manga?.image,
        score: manga?.score,
        year: manga?.year,
        type: manga?.type,
        chapters: manga?.chapters,
        volumes: manga?.volumes,
        members: manga?.members,
        genres: manga ? Object.keys(manga.genres) : [],
        url: manga?.url,
      };
    });

    return c.json({ items });
  });

  app.get('/api/manga/watchlist', requireAuth, async (c) => {
    const user = c.get('user')!;
    const watchlist = await getMangaWatchlist(user.userId);
    if (!watchlist) return c.json({ error: 'Manga watchlist not found' }, 404);
    return c.json(watchlist);
  });

  app.post('/api/manga/watched/add', requireAuth, async (c) => {
    const body = await c.req.json();
    const parsed = watchedListSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid watchlist payload', details: parsed.error.issues }, 400);
    }
    const user = c.get('user')!;
    await upsertMangaWatchlist(
      parsed.data.mal_ids.map(String),
      parsed.data.status,
      user.userId,
      parsed.data.tagColor
    );
    return c.json({ success: true, message: 'Manga added to watchlist' });
  });

  app.post('/api/manga/watched/remove', requireAuth, async (c) => {
    const body = await c.req.json();
    const parsed = watchedListRemoveSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid watchlist payload', details: parsed.error.issues }, 400);
    }
    const user = c.get('user')!;
    await deleteFromMangaWatchlist(parsed.data.mal_ids.map(String), user.userId);
    return c.json({ success: true, message: 'Manga removed from watchlist' });
  });

  // Catalog data refreshes once a day, so anonymous detail responses are
  // safe to cache for ~24h. Signed-in responses embed per-user watchlist
  // state, so we bypass the cache when a user is present. Bump :v1 to
  // invalidate after response-shape changes.
  const MANGA_DETAIL_CACHE_TTL_SECONDS = 24 * 60 * 60;
  const MANGA_DETAIL_CACHE_KEY_PREFIX = 'https://mal-cache.local/api/manga/';

  app.get('/api/manga/:malId', optionalAuth, async (c) => {
    const malId = Number(c.req.param('malId'));
    if (!Number.isInteger(malId) || malId <= 0) {
      return c.json({ error: 'Invalid manga id' }, 400);
    }

    const user = c.get('user');
    const edgeCache = (caches as unknown as { default: Cache }).default;
    const cacheUrl = user ? null : `${MANGA_DETAIL_CACHE_KEY_PREFIX}${malId}:v1`;

    if (cacheUrl) {
      const cached = await edgeCache.match(cacheUrl);
      if (cached) {
        const hit = new Response(cached.body, cached);
        hit.headers.set('X-Detail-Cache', 'HIT');
        return hit;
      }
    }

    const [manga, watchlist] = await Promise.all([
      getMangaByMalId(malId),
      user?.userId ? getMangaWatchlist(user.userId) : Promise.resolve(null),
    ]);

    if (!manga) {
      return c.json({ error: 'Manga not found' }, 404);
    }

    const entry = watchlist?.manga[String(malId)];
    const jsonResponse = c.json({
      manga: {
        mal_id: manga.mal_id,
        url: manga.url,
        title: manga.title,
        title_english: manga.title_english,
        type: manga.type,
        chapters: manga.chapters,
        volumes: manga.volumes,
        score: manga.score,
        scored_by: manga.scored_by,
        rank: manga.rank,
        status: manga.status,
        popularity: manga.popularity,
        members: manga.members,
        favorites: manga.favorites,
        synopsis: manga.synopsis,
        year: manga.year,
        image: manga.image,
        has_colored: manga.has_colored,
        is_completed: manga.is_completed,
        available_in_english: manga.available_in_english,
        available_languages: manga.available_languages,
        genres: Object.keys(manga.genres),
        themes: Object.keys(manga.themes),
        demographics: Object.keys(manga.demographics),
      },
      watchlistEntry: entry ? { status: entry.status } : null,
    });

    if (cacheUrl) {
      const cacheable = new Response(jsonResponse.body, jsonResponse);
      cacheable.headers.set(
        'Cache-Control',
        `public, max-age=0, s-maxage=${MANGA_DETAIL_CACHE_TTL_SECONDS}`
      );
      cacheable.headers.set('X-Detail-Cache', 'MISS');
      c.executionCtx.waitUntil(edgeCache.put(cacheUrl, cacheable.clone()));
      return cacheable;
    }
    jsonResponse.headers.set('X-Detail-Cache', 'BYPASS');
    return jsonResponse;
  });
}
