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

const NUMERIC_COMPARATORS: Partial<Record<FilterAction, (a: number, b: number) => boolean>> = {
  [FilterAction.Equals]: (a, b) => a === b,
  [FilterAction.GreaterThan]: (a, b) => a > b,
  [FilterAction.LessThan]: (a, b) => a < b,
  [FilterAction.GreaterThanOrEquals]: (a, b) => a >= b,
  [FilterAction.LessThanOrEquals]: (a, b) => a <= b,
};

function evaluateNumericFilter(value: number, filterValue: number, action: FilterAction): boolean {
  return NUMERIC_COMPARATORS[action]?.(value, filterValue) ?? false;
}

const ARRAY_MATCHERS: Partial<
  Record<FilterAction, (mapValue: { [key: string]: number }, values: string[]) => boolean>
> = {
  [FilterAction.Excludes]: (mapValue, values) => !values.some((v) => mapValue[v]),
  [FilterAction.IncludesAll]: (mapValue, values) => values.every((v) => mapValue[v]),
  [FilterAction.IncludesAny]: (mapValue, values) =>
    values.length === 0 || values.some((v) => mapValue[v]),
};

function evaluateArrayFilter(
  mapValue: { [key: string]: number },
  filterValue: string | string[],
  action: FilterAction
): boolean {
  const values = Array.isArray(filterValue) ? filterValue : [filterValue];
  return ARRAY_MATCHERS[action]?.(mapValue, values) ?? false;
}

function lowerNeedles(filterValue: unknown): string[] | null {
  if (!Array.isArray(filterValue)) return null;
  return filterValue
    .filter((needle): needle is string => typeof needle === 'string' && needle.length > 0)
    .map((needle) => needle.toLowerCase());
}

function matchesStringFilter(value: unknown, filterValue: unknown, action: FilterAction): boolean {
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
    const needles = lowerNeedles(filterValue);
    if (!needles || needles.length === 0) return true;
    return needles.every((needle) => !value.toLowerCase().includes(needle));
  }

  if (action === FilterAction.IncludesAll || action === FilterAction.IncludesAny) {
    const needles = lowerNeedles(filterValue);
    if (!needles) return false;
    if (needles.length === 0) return true;
    const haystack = value.toLowerCase();
    return action === FilterAction.IncludesAll
      ? needles.every((needle) => haystack.includes(needle))
      : needles.some((needle) => haystack.includes(needle));
  }

  return false;
}

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

const ANIME_FIELD_ACCESSORS: Record<AnimeField, (anime: AnimeItem) => unknown> = {
  [AnimeField.MalId]: (a) => a.mal_id,
  [AnimeField.Title]: (a) => a.title,
  [AnimeField.TitleEnglish]: (a) => a.title_english,
  [AnimeField.Type]: (a) => a.type,
  [AnimeField.Episodes]: (a) => a.episodes,
  [AnimeField.Score]: (a) => a.score,
  [AnimeField.ScoredBy]: (a) => a.scored_by,
  [AnimeField.Rank]: (a) => a.rank,
  [AnimeField.Popularity]: (a) => a.popularity,
  [AnimeField.Members]: (a) => a.members,
  [AnimeField.Favorites]: (a) => a.favorites,
  [AnimeField.Year]: (a) => a.year,
  [AnimeField.Season]: (a) => a.season,
  [AnimeField.Synopsis]: (a) => a.synopsis,
  [AnimeField.Genres]: (a) => a.genres,
  [AnimeField.Themes]: (a) => a.themes,
  [AnimeField.Demographics]: (a) => a.demographics,
};

const getAnimeFieldValue = (anime: AnimeItem, field: AnimeField): unknown =>
  ANIME_FIELD_ACCESSORS[field]?.(anime);

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
