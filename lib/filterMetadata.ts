import { createParser } from 'nuqs';
import { serializeFilters } from './filterSerialization';
import type { FieldOptions, FilterActions, SearchFilter } from './types';

/**
 * URL-state parser for advanced filter arrays.
 *
 * The nuqs TanStack Router adapter reads from the router's already-parsed
 * `search` object. TanStack auto-JSON-parses values, so a bare JSON array
 * (`af=[{...}]`) comes back as a real JS array — which the adapter then
 * treats as a repeated-key param and coerces each element to "[object Object]",
 * corrupting the round-trip so filters always read back as []. Wrapping the
 * payload in an object keeps it on the adapter's object branch, which
 * JSON-stringifies it back intact.
 */
export const filtersParser = createParser<SearchFilter[]>({
  parse(value) {
    try {
      const parsed = JSON.parse(value) as unknown;
      const arr = Array.isArray(parsed) ? parsed : (parsed as { f?: unknown } | null)?.f;
      return Array.isArray(arr) ? (arr as SearchFilter[]) : null;
    } catch {
      return null;
    }
  },
  serialize(value) {
    return serializeFilters(value);
  },
});

export const DEFAULT_FIELD_OPTIONS: FieldOptions = {
  numeric: ['score', 'scored_by', 'rank', 'popularity', 'members', 'favorites', 'year', 'episodes'],
  array: ['genres', 'themes', 'demographics'],
  string: ['title', 'title_english', 'type', 'season', 'synopsis'],
};

export const DEFAULT_FILTER_ACTIONS: FilterActions = {
  comparison: [
    'EQUALS',
    'GREATER_THAN',
    'GREATER_THAN_OR_EQUALS',
    'LESS_THAN',
    'LESS_THAN_OR_EQUALS',
  ],
  array: ['INCLUDES_ALL', 'INCLUDES_ANY', 'EXCLUDES'],
};

export const DEFAULT_MANGA_FIELD_OPTIONS: FieldOptions & { boolean?: string[] } = {
  numeric: [
    'score',
    'scored_by',
    'rank',
    'popularity',
    'members',
    'favorites',
    'year',
    'chapters',
    'volumes',
  ],
  array: ['genres', 'themes', 'demographics', 'available_languages'],
  string: ['title', 'title_english', 'type', 'status', 'synopsis'],
  boolean: ['has_colored', 'is_completed', 'available_in_english'],
};
