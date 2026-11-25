import { z } from 'zod';

const strings = z.array(z.string());
const metric = z.number().nullish();
const text = z.string().nullish();
const title = z.looseObject({
  id: z.union([z.number(), z.string()]).optional(),
  mal_id: z.union([z.number(), z.string()]).optional(),
  title: text,
  title_english: text,
  name: text,
  synopsis: text,
  canonicalUrl: text,
  url: text,
  image: text,
  type: text,
  status: text,
  episodes: metric,
  chapters: metric,
  volumes: metric,
  score: metric,
  year: metric,
  members: metric,
  genres: strings.optional(),
  themes: strings.optional(),
});
const listPage = z.looseObject({
  items: z.array(title),
  total: z.number().optional(),
  returned: z.number().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  hasMore: z.boolean().optional(),
  nextOffset: z.number().nullable().optional(),
});
const counts = z.array(z.object({ field: z.string(), count: z.number() }));
const search = z.object({
  totalFiltered: z.number(),
  filteredList: z.array(title),
  pageInfo: z.object({
    total: z.number(),
    returned: z.number(),
    offset: z.number(),
    limit: z.number(),
    page: z.number(),
    totalPages: z.number(),
    hasMore: z.boolean(),
    nextOffset: z.number().nullable(),
  }),
});
const watchlistEntry = z.object({ status: z.string(), note: text }).nullable();
const animeDetail = z.object({
  anime: title,
  relations: z.array(title),
  recommendations: z.array(title),
  watchlistEntry,
});
const mangaDetail = z.object({ manga: title, watchlistEntry });

export const catalogOutputs: Record<string, z.ZodType> = {
  search_anime: search,
  search_manga: search,
  get_anime_detail: animeDetail,
  get_manga_detail: mangaDetail,
  get_random_anime: z.object({ results: z.array(title) }),
  list_search_fields: z.looseObject({
    numeric: strings,
    array: strings,
    string: strings,
    boolean: strings.optional(),
  }),
  list_filter_actions: z.looseObject({
    comparison: strings,
    array: strings,
    text: strings.optional(),
  }),
  get_anime_stats: z.looseObject({
    totalAnime: z.number(),
    genreCounts: counts.optional(),
    themeCounts: counts.optional(),
    demographicCounts: counts.optional(),
  }),
  list_watchlist: listPage,
  list_manga_watchlist: listPage,
  list_watchlist_tags: listPage.extend({
    items: z.array(z.looseObject({ id: z.string(), name: z.string() })),
  }),
  get_watchlist_enriched: listPage,
  get_manga_watchlist_enriched: listPage,
};
