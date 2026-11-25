import { trace } from '../telemetry';
import { AnimeField, FilterAction } from '../config';
import { filterAnimeList } from '../filterEngine';
import { animeStore } from '../store/animeStore';
import { sortSearchByTaste } from '../recommendations';
import { getAnimeWatchlist } from '../db/watchlist';
import { getScoreSortedList } from '../utils/statistics';
import { getSimpleAnimeSearchPage } from '../db/animeData';
import { hideWatchedItems, includeOnlyWatchedItems, takePage } from './helpers';
import type { AnimeItem, AnimeSortField, Filter } from '../types/anime';

const SEARCH_SYNOPSIS_MAX = 220;

const truncateSynopsis = (text: string | undefined): string | undefined => {
  if (!text) return text;
  if (text.length <= SEARCH_SYNOPSIS_MAX) return text;
  return `${text.slice(0, SEARCH_SYNOPSIS_MAX - 1).trimEnd()}...`;
};

const toSearchAnime = (anime: {
  mal_id: number;
  score?: number;
  points?: number;
  title: string;
  title_english?: string;
  url: string;
  synopsis?: string;
  members?: number;
  favorites?: number;
  year?: number;
  status?: string;
  genres: Record<string, number>;
  themes: Record<string, number>;
  type?: string;
  image?: string;
}) => ({
  id: anime.mal_id,
  score: anime.score,
  points: anime.points,
  name: anime.title,
  title_english: anime.title_english,
  link: anime.url,
  synopsis: truncateSynopsis(anime.synopsis),
  members: anime.members,
  favorites: anime.favorites,
  year: anime.year,
  status: anime.status,
  genres: Object.keys(anime.genres),
  themes: Object.keys(anime.themes),
  type: anime.type,
  image: anime.image,
});

type SearchAnimeResult = ReturnType<typeof toSearchAnime>;

export type SearchResult = {
  totalFiltered: number;
  filteredList: SearchAnimeResult[];
  cachePath: string;
};

export interface SearchParams {
  filters: Filter[];
  sortBy: AnimeSortField | 'recommended' | undefined;
  airing: 'yes' | 'no' | 'any';
  hideWatched: string[];
  includeWatched: string[];
  pagesize: number;
  offset: number;
  userId?: string;
}

function prepareTitleSearch(filters: Filter[]) {
  const exactTitles = new Set<string>();
  const normalized = filters.map((filter) => {
    if (
      (filter.field !== AnimeField.Title && filter.field !== AnimeField.TitleEnglish) ||
      filter.action !== FilterAction.Contains ||
      typeof filter.value !== 'string'
    )
      return filter;
    const value = filter.value.trim();
    if (!value) return filter;
    exactTitles.add(value.toLowerCase());
    return { ...filter, value };
  });
  return { filters: normalized, exactTitles };
}

export async function executeSearch(params: SearchParams): Promise<SearchResult> {
  const { sortBy, airing, hideWatched, includeWatched, pagesize, offset, userId } = params;
  const { filters, exactTitles } = prepareTitleSearch(params.filters);
  const canUseD1Search = hideWatched.length === 0 && includeWatched.length === 0;

  const simpleSearchPage =
    canUseD1Search && sortBy !== 'recommended'
      ? await trace(
          'db:search:simple',
          () => getSimpleAnimeSearchPage({ filters, sortBy, airing, pagesize, offset }),
          { project: 'mal-api' }
        )
      : null;

  if (simpleSearchPage) {
    return {
      totalFiltered: simpleSearchPage.totalFiltered,
      filteredList: simpleSearchPage.page.map(toSearchAnime),
      cachePath: 'd1',
    };
  }

  const catalog = await trace('db:search', () => animeStore.getAnimeList(), { project: 'mal-api' });
  let filtered = filterAnimeList(catalog, filters);

  if (airing !== 'any') {
    filtered = filtered.filter((anime) => {
      const isAiring = anime.status?.toLowerCase() === 'currently airing';
      return airing === 'yes' ? isAiring : !isAiring;
    });
  }

  const watchlist =
    userId && (sortBy === 'recommended' || includeWatched.length || hideWatched.length)
      ? await getAnimeWatchlist(userId)
      : null;
  if (userId && includeWatched.length > 0) {
    filtered = await includeOnlyWatchedItems(
      filtered,
      includeWatched,
      async () => watchlist,
      (list) => list.anime
    );
  } else if (userId) {
    filtered = await hideWatchedItems(
      filtered,
      hideWatched,
      async () => watchlist,
      (list) => list.anime
    );
  }

  if (sortBy === 'recommended') {
    const ranked = sortSearchByTaste(catalog, filtered, watchlist, exactTitles);
    return {
      totalFiltered: ranked.length,
      filteredList: takePage(ranked, pagesize, offset).map(({ anime, points }) =>
        toSearchAnime({ ...anime, points })
      ),
      cachePath: 'memory',
    };
  }

  const sorted = getScoreSortedList(filtered, filters, sortBy, pagesize + offset);

  return {
    totalFiltered: filtered.length,
    filteredList: takePage(sorted, pagesize, offset).map(toSearchAnime),
    cachePath: 'memory',
  };
}
