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

export const ANIME_SORT_OPTIONS = [
  { value: 'score', label: 'Score' },
  { value: 'members', label: 'Popularity' },
  { value: 'year', label: 'Time' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'relevance', label: 'Relevance' },
] as const;

export const MANGA_SORT_OPTIONS = [
  { value: 'score', label: 'Score' },
  { value: 'members', label: 'Popularity' },
  { value: 'year', label: 'Time' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'chapters', label: 'Chapters' },
  { value: 'volumes', label: 'Volumes' },
] as const;
