export enum AnimeField {
  MalId = 'mal_id',
  Title = 'title',
  TitleEnglish = 'title_english',
  Type = 'type',
  Episodes = 'episodes',
  Score = 'score',
  ScoredBy = 'scored_by',
  Rank = 'rank',
  Popularity = 'popularity',
  Members = 'members',
  Favorites = 'favorites',
  Year = 'year',
  Season = 'season',
  Synopsis = 'synopsis',
  Genres = 'genres',
  Themes = 'themes',
  Demographics = 'demographics',
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
