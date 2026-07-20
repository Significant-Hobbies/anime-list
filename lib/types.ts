export interface AnimeSummary {
  id: number;
  score: number;
  points: number;
  name: string;
  title_english?: string;
  link: string;
  synopsis: string;
  members: number;
  favorites: number;
  year: number;
  status: string;
  genres: string[];
  themes: string[];
  type: string;
  image?: string;
  chapters?: number;
  volumes?: number;
}

export interface SearchResponse {
  totalFiltered: number;
  filteredList: AnimeSummary[];
}

export interface FieldOptions {
  numeric: string[];
  array: string[];
  string: string[];
}

export interface FilterActions {
  comparison: string[];
  array: string[];
}

export interface Distribution {
  range: string;
  count: number;
}

export interface FieldCount {
  field: string;
  count: number;
}

interface Percentiles {
  p99: number;
  p95: number;
  p90: number;
  p75: number;
  median: number;
  mean: number;
  top100: number;
  top200: number;
  top500: number;
  top1000: number;
}

interface TypeDistribution {
  type: string;
  count: number;
}

export interface AnimeStats {
  totalAnime: number;
  scoreDistribution: Distribution[];
  membersDistribution: Distribution[];
  favoritesDistribution: Distribution[];
  yearDistribution: Distribution[];
  percentiles: Record<string, Percentiles>;
  genreCounts: FieldCount[];
  themeCounts: FieldCount[];
  demographicCounts: FieldCount[];
  typeDistribution: TypeDistribution[];
}

export interface SearchFilter {
  field: string;
  action: string;
  value: string | number | string[];
  score_multiplier?: number | Record<string, number>;
}

interface WatchedAnime {
  status: string;
  id: string;
  [key: string]: string | number;
}

export interface WatchlistData {
  user: { id: string; name: string };
  anime: Record<string, WatchedAnime>;
}

export interface EnrichedWatchlistItem {
  mal_id: string;
  watchStatus: string;
  note?: string;
  title: string;
  image?: string;
  score?: number;
  year?: number;
  type?: string;
  episodes?: number;
  members?: number;
  genres: string[];
  url?: string;
}

export interface EnrichedWatchlistResponse {
  items: EnrichedWatchlistItem[];
}

export interface AnimeRelationItem {
  mal_id: number;
  relation: string;
  title: string;
  title_english?: string;
  image?: string;
  type?: string;
  status?: string;
  episodes?: number;
  year?: number;
  url?: string;
}

export interface AnimeRecommendationItem {
  mal_id: number;
  title: string;
  title_english?: string;
  image?: string;
  type?: string;
  status?: string;
  episodes?: number;
  year?: number;
  url?: string;
  votes: number;
}

interface AnimeDetail {
  mal_id: number;
  url: string;
  title: string;
  title_english?: string;
  type?: string;
  episodes?: number;
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
  genres: string[];
  themes: string[];
  demographics: string[];
}

export interface AnimeDetailResponse {
  anime: AnimeDetail;
  relations: AnimeRelationItem[];
  recommendations: AnimeRecommendationItem[];
  watchlistEntry: {
    status: string;
    note: string | null;
  } | null;
}

export interface WatchlistTag {
  id: string;
  tag: string;
  count: number;
  color: string;
}

interface TasteSignal {
  name: string;
  weight: number;
}

interface TasteRecommendation {
  mal_id: number;
  title: string;
  title_english?: string;
  image?: string;
  type?: string;
  score?: number;
  year?: number;
  url?: string;
  genres: string[];
  themes: string[];
  tasteScore: number;
  reasons: string[];
}

export interface TasteRecommendationsResponse {
  profile: {
    favoriteGenres: TasteSignal[];
    favoriteThemes: TasteSignal[];
    preferredTypes: TasteSignal[];
    sampledTitles: number;
  };
  recommendations: TasteRecommendation[];
}

interface WatchlistImportConflict {
  malId: string;
  title?: string;
  incomingStatus: string;
  existingStatus: string;
}

export interface WatchlistImportPreview {
  source: 'mal' | 'anilist' | 'shelf';
  entries: {
    malId: string;
    status: string;
    title?: string;
    type?: string;
    episodes?: number;
    note?: string;
  }[];
  statusCounts: Record<string, number>;
  skipped: number;
  conflicts?: WatchlistImportConflict[];
  newCount?: number;
  imported?: number;
  mode?: 'merge' | 'replace' | 'skip';
}

export interface SavedSearch {
  id: string;
  user_id: string;
  name: string;
  filters_json: string;
  channel: string;
  frequency: string;
  paused: number;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedSearchAlert {
  id: string;
  saved_search_id: string;
  mal_id: string;
  title_type: string;
  title: string | null;
  match_reason: string | null;
  created_at: string;
  seen_at: string | null;
  search_name: string;
}

export interface CollectionSummary {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  description: string;
  visibility: string;
  cover_mode: string;
  created_at: string;
  updated_at: string;
}

export interface CollectionItem {
  id: string;
  collection_id: string;
  mal_id: string;
  media_type: string;
  position: number;
  note: string | null;
  title?: string;
  image?: string;
  score?: number;
  year?: number;
  url?: string;
}

export interface AniListExportResponse {
  source: 'anilist';
  entries: {
    mediaIdMal: number;
    status: string;
    notes: string;
  }[];
}

// Schedule types

export interface ScheduleItem {
  mal_id: string;
  episodes_per_day: number;
  sort_order: number;
  episodes_watched: number;
  title: string;
  image?: string;
  episodes?: number;
  type?: string;
  score?: number;
  url?: string;
  watchStatus: string;
}

interface ScheduleTimelineEntry {
  mal_id: string;
  title: string;
  image?: string;
  episodes_today: number;
  episode_range: [number, number];
  is_final_day: boolean;
}

export interface ScheduleTimelineDay {
  day: number;
  date: string;
  entries: ScheduleTimelineEntry[];
}

export interface ScheduleTimelineResponse {
  items: ScheduleItem[];
  timeline: ScheduleTimelineDay[];
  stats: {
    total_episodes: number;
    total_days: number;
    start_date: string;
    finish_date: string;
  };
}

export interface MangaWatchlistData {
  user: { id: string; name: string };
  manga: Record<string, { id: string; status: string }>;
}

export interface EnrichedMangaWatchlistItem {
  mal_id: string;
  watchStatus: string;
  title: string;
  image?: string;
  score?: number;
  year?: number;
  type?: string;
  chapters?: number;
  volumes?: number;
  members?: number;
  genres: string[];
  url?: string;
}

export interface EnrichedMangaWatchlistResponse {
  items: EnrichedMangaWatchlistItem[];
}

export interface MangaDetailResponse {
  manga: {
    mal_id: number;
    url: string;
    title: string;
    title_english?: string;
    type?: string;
    chapters?: number;
    volumes?: number;
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
    genres: string[];
    themes: string[];
    demographics: string[];
  };
  watchlistEntry: { status: string } | null;
}

export interface DiscoveryQueueResponse {
  meta?: {
    currentSeason: string;
    currentYear: number;
  };
  results: {
    mal_id: number;
    id: number;
    title: string;
    title_english?: string;
    synopsis?: string;
    image?: string;
    genres: string[];
    themes: string[];
    year?: number;
    season?: string;
    score?: number;
    members?: number;
    status?: string;
    reasons?: string[];
    mediaType?: 'anime' | 'manga';
  }[];
}
