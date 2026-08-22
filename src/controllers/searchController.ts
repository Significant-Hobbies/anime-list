import { trace } from '../telemetry';
import { filterAnimeList } from '../filterEngine';
import { getAnimeWatchlist } from '../db/watchlist';
import { getScoreSortedList } from '../utils/statistics';
import { getSimpleAnimeSearchPage } from '../db/animeData';
import { hideWatchedItems, includeOnlyWatchedItems, takePage } from './helpers';
import type { AnimeItem, Filter, NumericField } from '../types/anime';

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
  sortBy: NumericField | undefined;
  airing: 'yes' | 'no' | 'any';
  hideWatched: string[];
  includeWatched: string[];
  pagesize: number;
  offset: number;
  userId?: string;
}

export async function executeSearch(params: SearchParams): Promise<SearchResult> {
  const { filters, sortBy, airing, hideWatched, includeWatched, pagesize, offset, userId } = params;
  const canUseD1Search = hideWatched.length === 0 && includeWatched.length === 0;

  const simpleSearchPage = canUseD1Search
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

  let filtered: AnimeItem[] = await trace('db:search', () => filterAnimeList(filters), {
    project: 'mal-api',
  });

  if (airing !== 'any') {
    filtered = filtered.filter((anime) => {
      const isAiring = anime.status?.toLowerCase() === 'currently airing';
      return airing === 'yes' ? isAiring : !isAiring;
    });
  }

  if (userId && includeWatched.length > 0) {
    filtered = await includeOnlyWatchedItems(
      filtered,
      includeWatched,
      () => getAnimeWatchlist(userId),
      (list) => list.anime
    );
  } else if (userId) {
    filtered = await hideWatchedItems(
      filtered,
      hideWatched,
      () => getAnimeWatchlist(userId),
      (list) => list.anime
    );
  }

  const sorted = getScoreSortedList(filtered, filters, sortBy, pagesize + offset);

  return {
    totalFiltered: filtered.length,
    filteredList: takePage(sorted, pagesize, offset).map(toSearchAnime),
    cachePath: 'memory',
  };
}
