import type { FieldOptions, FilterActions } from "./types";

export const DEFAULT_FIELD_OPTIONS: FieldOptions = {
  numeric: ["score", "scored_by", "rank", "popularity", "members", "favorites", "year", "episodes"],
  array: ["genres", "themes", "demographics"],
  string: ["title", "title_english", "type", "season", "synopsis"],
};

export const DEFAULT_FILTER_ACTIONS: FilterActions = {
  comparison: ["EQUALS", "GREATER_THAN", "GREATER_THAN_OR_EQUALS", "LESS_THAN", "LESS_THAN_OR_EQUALS"],
  array: ["INCLUDES_ALL", "INCLUDES_ANY", "EXCLUDES"],
};

export const DEFAULT_MANGA_FIELD_OPTIONS: FieldOptions & { boolean?: string[] } = {
  numeric: ["score", "scored_by", "rank", "popularity", "members", "favorites", "year", "chapters", "volumes"],
  array: ["genres", "themes", "demographics", "available_languages"],
  string: ["title", "title_english", "type", "status", "synopsis"],
  boolean: ["has_colored", "is_completed", "available_in_english"],
};
