interface AnimeDetailAnime {
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

interface AnimeRelationEntry {
  mal_id: number;
  type: string;
  name: string;
  url: string;
}

export interface AnimeRelation {
  relation: string;
  entries: AnimeRelationEntry[];
}

interface AnimeRecommendationEntry {
  mal_id: number;
  url: string;
  title: string;
  image?: string;
}

export interface AnimeRecommendation {
  entry: AnimeRecommendationEntry;
  url?: string;
  votes?: number;
}

interface AnimeDetailRelationItem {
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

interface AnimeDetailRecommendationItem {
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

interface AnimeWatchlistDetails {
  status: string;
  note: string | null;
}

export interface AnimeDetailResponse {
  anime: AnimeDetailAnime;
  relations: AnimeDetailRelationItem[];
  recommendations: AnimeDetailRecommendationItem[];
  watchlistEntry: AnimeWatchlistDetails | null;
}

export interface AnimeDetailCacheRecord<T> {
  malId: number;
  data: T[];
  fetchedAt: string;
}
