import { NUMERIC_FIELDS, type NumericField } from '@/src/types/animeFields';

export const QUICK_GENRES = [
  'Action',
  'Comedy',
  'Drama',
  'Fantasy',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Adventure',
  'Mystery',
  'Horror',
  'Supernatural',
  'Sports',
  'Suspense',
] as const;

export const POPULARITY_PRESETS = [
  { value: 0, label: 'Any popularity' },
  { value: 10_000, label: '10k+ members' },
  { value: 50_000, label: '50k+ members' },
  { value: 100_000, label: '100k+ members' },
] as const;

export const RECOMMENDED_SORT = 'recommended';

export const normalizeTimeSort = (value: string): string =>
  value === 'year' || value === 'time' ? 'released_at' : value;

const NUMERIC_SORT_LABELS: Record<NumericField, string> = {
  score: 'Score',
  scored_by: 'Number of ratings',
  rank: 'Rank',
  popularity: 'Popularity rank',
  members: 'Popularity',
  favorites: 'Favorites',
  year: 'Release time',
  episodes: 'Episodes',
};

export const ANIME_SORT_OPTIONS = [
  { value: RECOMMENDED_SORT, label: 'Recommended for you' },
  ...NUMERIC_FIELDS.map((field) => ({
    value: normalizeTimeSort(field),
    label: NUMERIC_SORT_LABELS[field],
  })),
  { value: 'created_at', label: 'Catalog added time' },
  { value: 'relevance', label: 'Relevance' },
] as const;

export const MANGA_SORT_OPTIONS = [
  { value: 'score', label: 'Score' },
  { value: 'members', label: 'Popularity' },
  { value: 'released_at', label: 'Release time' },
  { value: 'created_at', label: 'Catalog added time' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'chapters', label: 'Chapters' },
  { value: 'volumes', label: 'Volumes' },
] as const;
