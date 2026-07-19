import type { AnimeItem } from './types/anime';
import type { WatchlistData } from './types/watchlist';

interface TasteSignal {
  name: string;
  weight: number;
}

export interface TasteProfile {
  favoriteGenres: TasteSignal[];
  favoriteThemes: TasteSignal[];
  preferredTypes: TasteSignal[];
  sampledTitles: number;
}

export interface TasteRecommendation {
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

const POSITIVE_STATUS_WEIGHTS: Record<string, number> = {
  watching: 1.4,
  completed: 1.3,
  done: 1.3,
  brr: 1.15,
};

const NEGATIVE_STATUS_WEIGHTS: Record<string, number> = {
  avoiding: -1.6,
  deferred: -0.8,
  dropped: -1.2,
};

export function buildTasteRecommendations(
  catalog: AnimeItem[],
  watchlist: WatchlistData,
  limit = 12
): { profile: TasteProfile; recommendations: TasteRecommendation[] } {
  const watchedIds = new Set(Object.keys(watchlist.anime));
  const watchedAnime = catalog.filter((anime) => watchedIds.has(String(anime.mal_id)));
  const genreWeights = new Map<string, number>();
  const themeWeights = new Map<string, number>();
  const typeWeights = new Map<string, number>();

  for (const anime of watchedAnime) {
    const status = watchlist.anime[String(anime.mal_id)]?.status ?? '';
    const weight = statusWeight(status);
    addMapWeights(genreWeights, Object.keys(anime.genres), weight);
    addMapWeights(themeWeights, Object.keys(anime.themes), weight);
    if (anime.type) addMapWeights(typeWeights, [anime.type], weight * 0.7);
  }

  const profile = {
    favoriteGenres: topSignals(genreWeights, 5),
    favoriteThemes: topSignals(themeWeights, 5),
    preferredTypes: topSignals(typeWeights, 3),
    sampledTitles: watchedAnime.length,
  };

  const recommendations = catalog
    .filter((anime) => !watchedIds.has(String(anime.mal_id)))
    .map((anime) => scoreAnime(anime, genreWeights, themeWeights, typeWeights))
    .filter((item) => item.tasteScore > 0)
    .sort((a, b) => b.tasteScore - a.tasteScore || (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);

  return { profile, recommendations };
}

function scoreAnime(
  anime: AnimeItem,
  genreWeights: Map<string, number>,
  themeWeights: Map<string, number>,
  typeWeights: Map<string, number>
): TasteRecommendation {
  const reasons: string[] = [];
  let tasteScore = 0;

  for (const genre of Object.keys(anime.genres)) {
    const weight = genreWeights.get(genre) ?? 0;
    if (weight > 0) {
      tasteScore += weight * 2;
      reasons.push(`matches ${genre}`);
    } else if (weight < 0) {
      tasteScore += weight;
    }
  }

  for (const theme of Object.keys(anime.themes)) {
    const weight = themeWeights.get(theme) ?? 0;
    if (weight > 0) {
      tasteScore += weight * 1.4;
      reasons.push(`shares ${theme}`);
    } else if (weight < 0) {
      tasteScore += weight * 0.7;
    }
  }

  if (anime.type) {
    tasteScore += typeWeights.get(anime.type) ?? 0;
  }

  tasteScore += Math.min(2, Math.max(0, (anime.score ?? 0) - 7));
  tasteScore += Math.min(1, Math.log10(Math.max(1, anime.members ?? 1)) / 8);

  return {
    mal_id: anime.mal_id,
    title: anime.title,
    title_english: anime.title_english,
    image: anime.image,
    type: anime.type,
    score: anime.score,
    year: anime.year,
    url: anime.url,
    genres: Object.keys(anime.genres),
    themes: Object.keys(anime.themes),
    tasteScore: Math.round(tasteScore * 10) / 10,
    reasons: Array.from(new Set(reasons)).slice(0, 4),
  };
}

function statusWeight(status: string) {
  const normalized = status.trim().toLowerCase();
  return POSITIVE_STATUS_WEIGHTS[normalized] ?? NEGATIVE_STATUS_WEIGHTS[normalized] ?? 0.5;
}

function addMapWeights(map: Map<string, number>, keys: string[], weight: number) {
  for (const key of keys) {
    map.set(key, (map.get(key) ?? 0) + weight);
  }
}

function topSignals(map: Map<string, number>, limit: number): TasteSignal[] {
  return Array.from(map.entries())
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, weight]) => ({ name, weight: Math.round(weight * 10) / 10 }));
}
