import type { FilterAction } from '../config';

export interface BaseMangaItem {
  mal_id: number;
  url: string;
  title: string;
  title_english?: string;
  type?: string;
  chapters?: number;
  volumes?: number;
  published?: { from: string; to: string };
  score?: number;
  scored_by?: number;
  rank?: number;
  status?: string;
  popularity?: number;
  members?: number;
  favorites?: number;
  synopsis?: string;
  year?: number;
  image?: string;
  has_colored?: boolean;
  is_completed?: boolean;
  available_in_english?: boolean;
  available_languages?: string[];
}

export interface MangaItem extends BaseMangaItem {
  genres: { [key: string]: number };
  themes: { [key: string]: number };
  demographics: { [key: string]: number };
}

export type RawMangaData = ({
  genres?: Array<{ name: string }>;
  themes?: Array<{ name: string }>;
  demographics?: Array<{ name: string }>;
  images?: { webp?: { image_url?: string }; jpg?: { image_url?: string } };
} & BaseMangaItem)[];

export enum MangaField {
  MalId = 'mal_id',
  Url = 'url',
  Title = 'title',
  TitleEnglish = 'title_english',
  Type = 'type',
  Chapters = 'chapters',
  Volumes = 'volumes',
  Published = 'published',
  Score = 'score',
  ScoredBy = 'scored_by',
  Rank = 'rank',
  Status = 'status',
  Popularity = 'popularity',
  Members = 'members',
  Favorites = 'favorites',
  Year = 'year',
  Synopsis = 'synopsis',
  Genres = 'genres',
  Themes = 'themes',
  Demographics = 'demographics',
  HasColored = 'has_colored',
  IsCompleted = 'is_completed',
  AvailableInEnglish = 'available_in_english',
  AvailableLanguages = 'available_languages',
}

export interface MangaFilter<T extends string | number | string[] = string | number | string[]> {
  field: MangaField;
  value: T;
  action: FilterAction;
  score_multiplier?: T extends string[] ? { [subCategory: string]: number } : number;
}

export type MangaNumericField =
  | MangaField.Score
  | MangaField.ScoredBy
  | MangaField.Rank
  | MangaField.Popularity
  | MangaField.Members
  | MangaField.Favorites
  | MangaField.Year
  | MangaField.Chapters
  | MangaField.Volumes;

export type MangaArrayField =
  | MangaField.Genres
  | MangaField.Themes
  | MangaField.Demographics
  | MangaField.AvailableLanguages;

export type MangaStringField =
  | MangaField.Title
  | MangaField.TitleEnglish
  | MangaField.Type
  | MangaField.Status
  | MangaField.Synopsis;

export const MANGA_NUMERIC_FIELDS: MangaNumericField[] = [
  MangaField.Score,
  MangaField.ScoredBy,
  MangaField.Rank,
  MangaField.Popularity,
  MangaField.Members,
  MangaField.Favorites,
  MangaField.Year,
  MangaField.Chapters,
  MangaField.Volumes,
];

export const MANGA_ARRAY_FIELDS: MangaArrayField[] = [
  MangaField.Genres,
  MangaField.Themes,
  MangaField.Demographics,
  MangaField.AvailableLanguages,
];

export const MANGA_STRING_FIELDS: MangaStringField[] = [
  MangaField.Title,
  MangaField.TitleEnglish,
  MangaField.Type,
  MangaField.Status,
  MangaField.Synopsis,
];

export type MangaBooleanField =
  | MangaField.HasColored
  | MangaField.IsCompleted
  | MangaField.AvailableInEnglish;

export const MANGA_BOOLEAN_FIELDS: MangaBooleanField[] = [
  MangaField.HasColored,
  MangaField.IsCompleted,
  MangaField.AvailableInEnglish,
];

// Type guards
export const isMangaNumericField = (field: MangaField): field is MangaNumericField => {
  return MANGA_NUMERIC_FIELDS.includes(field as MangaNumericField);
};

export const isMangaArrayField = (field: MangaField): field is MangaArrayField => {
  return MANGA_ARRAY_FIELDS.includes(field as MangaArrayField);
};

export const isMangaStringField = (field: MangaField): field is MangaStringField => {
  return MANGA_STRING_FIELDS.includes(field as MangaStringField);
};
