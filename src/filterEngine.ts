/**
 * Pure filter/matching logic with zero file-system or native module dependencies.
 * Safe to import from Cloudflare Workers.
 */
import { AnimeField, FilterAction } from './config';
import {
  type AnimeItem,
  type Filter,
  isNumericField,
  isArrayField,
  isStringField,
} from './types/anime';
import { animeStore } from './store/animeStore';

// ── Primitive matchers ─────────────────────────────────────────────────

const evaluateNumericFilter = (
  value: number,
  filterValue: number,
  action: FilterAction
): boolean => {
  switch (action) {
    case FilterAction.Equals:
      return value === filterValue;
    case FilterAction.GreaterThan:
      return value > filterValue;
    case FilterAction.LessThan:
      return value < filterValue;
    case FilterAction.GreaterThanOrEquals:
      return value >= filterValue;
    case FilterAction.LessThanOrEquals:
      return value <= filterValue;
    default:
      return false;
  }
};

const evaluateArrayFilter = (
  mapValue: { [key: string]: number },
  filterValue: string | string[],
  action: FilterAction
): boolean => {
  const values = Array.isArray(filterValue) ? filterValue : [filterValue];
  switch (action) {
    case FilterAction.Excludes:
      return !values.some((v) => mapValue[v]);
    case FilterAction.IncludesAll:
      return values.every((v) => mapValue[v]);
    case FilterAction.IncludesAny:
      return values.length === 0 || values.some((v) => mapValue[v]);
    default:
      return false;
  }
};

const matchesStringFilter = (
  value: unknown,
  filterValue: unknown,
  action: FilterAction
): boolean => {
  if (typeof value !== 'string') return false;

  if (action === FilterAction.Equals) {
    return typeof filterValue === 'string' && value === filterValue;
  }

  if (action === FilterAction.Contains) {
    return (
      typeof filterValue === 'string' && value.toLowerCase().includes(filterValue.toLowerCase())
    );
  }

  if (action === FilterAction.Excludes) {
    if (typeof filterValue === 'string') {
      return !value.toLowerCase().includes(filterValue.toLowerCase());
    }

    if (Array.isArray(filterValue)) {
      const needles = filterValue
        .filter((needle): needle is string => typeof needle === 'string' && needle.length > 0)
        .map((needle) => needle.toLowerCase());
      if (needles.length === 0) {
        return true;
      }
      return needles.every((needle) => !value.toLowerCase().includes(needle));
    }

    return false;
  }

  if (action === FilterAction.IncludesAll || action === FilterAction.IncludesAny) {
    if (!Array.isArray(filterValue)) return false;
    const haystack = value.toLowerCase();
    const needles = filterValue
      .filter((needle): needle is string => typeof needle === 'string' && needle.length > 0)
      .map((needle) => needle.toLowerCase());
    if (needles.length === 0) {
      return true;
    }
    return action === FilterAction.IncludesAll
      ? needles.every((needle) => haystack.includes(needle))
      : needles.some((needle) => haystack.includes(needle));
  }

  return false;
};

// ── Generic filter matcher ─────────────────────────────────────────────

const matchesFilter = <
  TItem,
  TField,
  TFilter extends { field: TField; value: unknown; action: FilterAction },
>(
  item: TItem,
  filter: TFilter,
  ctx: {
    getFieldValue: (item: TItem, field: TField) => unknown;
    isNumericField: (field: TField) => boolean;
    isArrayField: (field: TField) => boolean;
    isStringField: (field: TField) => boolean;
  }
): boolean => {
  const value = ctx.getFieldValue(item, filter.field);
  if (value === undefined) return false;

  if (ctx.isNumericField(filter.field)) {
    return evaluateNumericFilter(value as number, filter.value as number, filter.action);
  }

  if (ctx.isArrayField(filter.field)) {
    return evaluateArrayFilter(
      value as { [key: string]: number },
      filter.value as string | string[],
      filter.action
    );
  }

  if (ctx.isStringField(filter.field)) {
    return matchesStringFilter(value, filter.value, filter.action);
  }

  return false;
};

export const filterCollection = <
  TItem,
  TField,
  TFilter extends { field: TField; value: unknown; action: FilterAction },
>(
  items: TItem[],
  filters: TFilter[],
  ctx: {
    getFieldValue: (item: TItem, field: TField) => unknown;
    isNumericField: (field: TField) => boolean;
    isArrayField: (field: TField) => boolean;
    isStringField: (field: TField) => boolean;
  }
): TItem[] => items.filter((item) => filters.every((filter) => matchesFilter(item, filter, ctx)));

// ── Anime field accessor ───────────────────────────────────────────────

const getAnimeFieldValue = (anime: AnimeItem, field: AnimeField): unknown => {
  switch (field) {
    case AnimeField.MalId:
      return anime.mal_id;
    case AnimeField.Title:
      return anime.title;
    case AnimeField.TitleEnglish:
      return anime.title_english;
    case AnimeField.Type:
      return anime.type;
    case AnimeField.Episodes:
      return anime.episodes;
    case AnimeField.Score:
      return anime.score;
    case AnimeField.ScoredBy:
      return anime.scored_by;
    case AnimeField.Rank:
      return anime.rank;
    case AnimeField.Popularity:
      return anime.popularity;
    case AnimeField.Members:
      return anime.members;
    case AnimeField.Favorites:
      return anime.favorites;
    case AnimeField.Year:
      return anime.year;
    case AnimeField.Season:
      return anime.season;
    case AnimeField.Synopsis:
      return anime.synopsis;
    case AnimeField.Genres:
      return anime.genres;
    case AnimeField.Themes:
      return anime.themes;
    case AnimeField.Demographics:
      return anime.demographics;
    default:
      return undefined;
  }
};

// ── Anime-specific filter (checks both title and title_english) ────────

const matchesAnimeFilter = (
  anime: AnimeItem,
  filter: Filter,
  ctx: {
    getFieldValue: (item: AnimeItem, field: AnimeField) => unknown;
    isNumericField: (field: AnimeField) => boolean;
    isArrayField: (field: AnimeField) => boolean;
    isStringField: (field: AnimeField) => boolean;
  }
): boolean => {
  if (filter.field === AnimeField.Title && filter.action === FilterAction.Contains) {
    const searchValue = filter.value as string;
    const titleMatch = matchesStringFilter(anime.title, searchValue, FilterAction.Contains);
    const englishTitleMatch = anime.title_english
      ? matchesStringFilter(anime.title_english, searchValue, FilterAction.Contains)
      : false;
    return titleMatch || englishTitleMatch;
  }

  return matchesFilter(anime, filter, ctx);
};

// ── Public API ─────────────────────────────────────────────────────────

export const filterAnimeList = async (filters: Filter[]): Promise<AnimeItem[]> => {
  const animeList = await animeStore.getAnimeList();

  return animeList.filter((anime) =>
    filters.every((filter) =>
      matchesAnimeFilter(anime, filter, {
        getFieldValue: getAnimeFieldValue,
        isNumericField,
        isArrayField,
        isStringField,
      })
    )
  );
};
