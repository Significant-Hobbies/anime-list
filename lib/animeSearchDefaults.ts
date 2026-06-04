import type { SearchFilter } from "./types";

export const DEFAULT_ANIME_PAGE_SIZE = 40;
export const DEFAULT_ANIME_MIN_MEMBERS = 100_000;

export const DEFAULT_ANIME_SEARCH_FILTERS: SearchFilter[] = [
  {
    field: "members",
    action: "GREATER_THAN_OR_EQUALS",
    value: DEFAULT_ANIME_MIN_MEMBERS,
  },
];

export const DEFAULT_ANIME_SEARCH_OPTS = {
  pagesize: DEFAULT_ANIME_PAGE_SIZE,
  offset: 0,
  sortBy: "score",
  airing: "any" as const,
  hideWatched: [] as string[],
  includeWatched: [] as string[],
};

export const DEFAULT_ANIME_SEARCH_KEY = JSON.stringify({
  filters: DEFAULT_ANIME_SEARCH_FILTERS,
  opts: DEFAULT_ANIME_SEARCH_OPTS,
});
