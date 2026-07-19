import { AnimeField, FilterAction } from '../config';

export interface BaseAnimeItem {
  mal_id: number;
  url: string;
  title: string;
  title_english?: string;
  type?: string;
  episodes?: number;
  aired?: { from: string; to: string };
  score?: number;
  scored_by?: number;
  rank?: number;
  status?: string;
  popularity?: number;
  members?: number;
  favorites?: number;
  synopsis?: string;
  year?: number;
  season?: string;
  image?: string;
}

export interface AnimeItem extends BaseAnimeItem {
  genres: { [key: string]: number };
  themes: { [key: string]: number };
  demographics: { [key: string]: number };
}

export type RawAnimeData = ({
  genres?: Array<{ name: string }>;
  themes?: Array<{ name: string }>;
  demographics?: Array<{ name: string }>;
  images?: { webp?: { image_url?: string }; jpg?: { image_url?: string } };
} & BaseAnimeItem)[];

export type ScoreMultiplier<T> = T extends string[] ? { [subCategory: string]: number } : number;

export interface Filter<T extends string | number | string[] = string | number | string[]> {
  field: AnimeField;
  value: T;
  action: FilterAction;
  score_multiplier?: ScoreMultiplier<T>;
}

export type NumericField =
  | AnimeField.Score
  | AnimeField.ScoredBy
  | AnimeField.Rank
  | AnimeField.Popularity
  | AnimeField.Members
  | AnimeField.Favorites
  | AnimeField.Year
  | AnimeField.Episodes;

export type ArrayField = AnimeField.Genres | AnimeField.Themes | AnimeField.Demographics;

export type StringField =
  | AnimeField.Title
  | AnimeField.TitleEnglish
  | AnimeField.Type
  | AnimeField.Season
  | AnimeField.Synopsis;

export const NUMERIC_FIELDS: NumericField[] = [
  AnimeField.Score,
  AnimeField.ScoredBy,
  AnimeField.Rank,
  AnimeField.Popularity,
  AnimeField.Members,
  AnimeField.Favorites,
  AnimeField.Year,
  AnimeField.Episodes,
];

export const ARRAY_FIELDS: ArrayField[] = [
  AnimeField.Genres,
  AnimeField.Themes,
  AnimeField.Demographics,
];

export const STRING_FIELDS: StringField[] = [
  AnimeField.Title,
  AnimeField.TitleEnglish,
  AnimeField.Type,
  AnimeField.Season,
  AnimeField.Synopsis,
];

export const COMPARISON_ACTIONS = [
  FilterAction.Equals,
  FilterAction.GreaterThan,
  FilterAction.GreaterThanOrEquals,
  FilterAction.LessThan,
  FilterAction.LessThanOrEquals,
] as const;

export const ARRAY_ACTIONS = [
  FilterAction.IncludesAll,
  FilterAction.IncludesAny,
  FilterAction.Excludes,
] as const;

export const TEXT_SEARCH_ACTIONS = [FilterAction.Equals, FilterAction.Contains] as const;

// Type guards
export const isNumericField = (field: AnimeField): field is NumericField => {
  return NUMERIC_FIELDS.includes(field as NumericField);
};

export const isArrayField = (field: AnimeField): field is ArrayField => {
  return ARRAY_FIELDS.includes(field as ArrayField);
};

export const isStringField = (field: AnimeField): field is StringField => {
  return STRING_FIELDS.includes(field as StringField);
};
