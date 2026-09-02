import axios from 'axios';
import { API_CONFIG } from '../config';
import {
  getAnimeRecommendationsCache,
  getAnimeRelationsCache,
  upsertAnimeRecommendationsCache,
  upsertAnimeRelationsCache,
} from '../db/animeDetailCache';
import type { AnimeRelation, AnimeRecommendation } from '../types/animeDetail';
import { logger } from '../utils/logger';

// Supplemental data (relations + recommendations) is essentially static
// for a given anime — relations almost never change post-airing. A 7d TTL
// turns cache misses from a per-day event into a per-week one while still
// catching the occasional MAL edit.
const DETAIL_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CATALOG_API_TIMEOUT_MS = 10_000;

type CatalogImageSet = {
  webp?: { image_url?: string | null };
  jpg?: { image_url?: string | null };
};

interface CatalogListResponse<T> {
  data: T[];
}

interface CatalogRelationItem {
  relation?: string;
  entry?: Array<{
    mal_id?: number;
    type?: string;
    name?: string;
    url?: string;
  }>;
}

interface CatalogRecommendationItem {
  entry?: {
    mal_id?: number;
    url?: string;
    title?: string;
    images?: CatalogImageSet;
  };
  url?: string;
  votes?: number;
}

const isFresh = (fetchedAt?: string): boolean => {
  if (!fetchedAt) return false;
  const parsed = Date.parse(fetchedAt);
  if (Number.isNaN(parsed)) return false;
  return Date.now() - parsed < DETAIL_CACHE_TTL_MS;
};

const toImageUrl = (images?: CatalogImageSet): string | undefined =>
  images?.webp?.image_url || images?.jpg?.image_url || undefined;

const normalizeRelations = (items: CatalogRelationItem[]): AnimeRelation[] =>
  items
    .map((item) => ({
      relation: item.relation?.trim() || 'Other',
      entries: (item.entry || [])
        .filter(
          (entry): entry is Required<NonNullable<CatalogRelationItem['entry']>[number]> =>
            typeof entry.mal_id === 'number' &&
            typeof entry.type === 'string' &&
            typeof entry.name === 'string' &&
            typeof entry.url === 'string'
        )
        .map((entry) => ({
          mal_id: entry.mal_id,
          type: entry.type,
          name: entry.name,
          url: entry.url,
        })),
    }))
    .filter((item) => item.entries.length > 0);

const normalizeRecommendations = (items: CatalogRecommendationItem[]): AnimeRecommendation[] =>
  items
    .filter(
      (
        item
      ): item is CatalogRecommendationItem & {
        entry: NonNullable<CatalogRecommendationItem['entry']>;
      } =>
        !!item.entry &&
        typeof item.entry.mal_id === 'number' &&
        typeof item.entry.url === 'string' &&
        typeof item.entry.title === 'string'
    )
    .map((item) => ({
      entry: {
        mal_id: item.entry.mal_id!,
        url: item.entry.url!,
        title: item.entry.title!,
        image: toImageUrl(item.entry.images),
      },
      url: item.url,
      votes: item.votes,
    }));

async function fetchCatalogCollection<T>(path: string): Promise<T[]> {
  const response = await axios.get<CatalogListResponse<T>>(`${API_CONFIG.baseUrl}${path}`, {
    timeout: CATALOG_API_TIMEOUT_MS,
  });
  return Array.isArray(response.data?.data) ? response.data.data : [];
}

async function loadRelations(malId: number): Promise<AnimeRelation[]> {
  const cached = await getAnimeRelationsCache(malId);
  if (cached && isFresh(cached.fetchedAt)) {
    return cached.data;
  }

  try {
    const remote = normalizeRelations(
      await fetchCatalogCollection<CatalogRelationItem>(`/anime/${malId}/relations`)
    );
    await upsertAnimeRelationsCache(malId, remote);
    return remote;
  } catch (error) {
    logger.warn(
      { err: error, malId },
      `Failed to refresh anime relations from ${API_CONFIG.providerName}; falling back to cache`
    );
    return cached?.data || [];
  }
}

async function loadRecommendations(malId: number): Promise<AnimeRecommendation[]> {
  const cached = await getAnimeRecommendationsCache(malId);
  if (cached && isFresh(cached.fetchedAt)) {
    return cached.data;
  }

  try {
    const remote = normalizeRecommendations(
      await fetchCatalogCollection<CatalogRecommendationItem>(`/anime/${malId}/recommendations`)
    );
    await upsertAnimeRecommendationsCache(malId, remote);
    return remote;
  } catch (error) {
    logger.warn(
      { err: error, malId },
      `Failed to refresh anime recommendations from ${API_CONFIG.providerName}; falling back to cache`
    );
    return cached?.data || [];
  }
}

export async function getAnimeDetailSupplementalData(malId: number): Promise<{
  relations: AnimeRelation[];
  recommendations: AnimeRecommendation[];
}> {
  const [relations, recommendations] = await Promise.all([
    loadRelations(malId),
    loadRecommendations(malId),
  ]);

  return { relations, recommendations };
}
