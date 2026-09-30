import { getDb } from './client';
import type {
  AnimeDetailCacheRecord,
  AnimeRelation,
  AnimeRecommendation,
} from '../types/animeDetail';

export interface AnimeDetailCacheRecords {
  relations: AnimeDetailCacheRecord<AnimeRelation> | null;
  recommendations: AnimeDetailCacheRecord<AnimeRecommendation> | null;
}

const parseCachedPayload = <T>(value: unknown): T[] => {
  if (typeof value !== 'string') return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

function cacheRecordFromRows<T>(rows: Record<string, unknown>[]): AnimeDetailCacheRecord<T> | null {
  const row = rows[0];
  if (!row) return null;
  return {
    malId: Number(row.mal_id),
    data: parseCachedPayload<T>(row.payload),
    fetchedAt: row.fetched_at as string,
  };
}

async function getCachedCollection<T>(
  tableName: 'anime_relations_cache' | 'anime_recommendations_cache',
  malId: number
): Promise<AnimeDetailCacheRecord<T> | null> {
  const db = getDb();
  const result = await db.execute({
    sql: `
      SELECT mal_id, payload, fetched_at
      FROM ${tableName}
      WHERE mal_id = ?
      LIMIT 1
    `,
    args: [malId],
  });
  return cacheRecordFromRows(result.rows);
}

/** Read both global detail caches in one D1 round trip. */
export async function getAnimeDetailCacheRecords(malId: number): Promise<AnimeDetailCacheRecords> {
  const [relations, recommendations] = await getDb().batch(
    [
      {
        sql: `SELECT mal_id, payload, fetched_at
              FROM anime_relations_cache WHERE mal_id = ? LIMIT 1`,
        args: [malId],
      },
      {
        sql: `SELECT mal_id, payload, fetched_at
              FROM anime_recommendations_cache WHERE mal_id = ? LIMIT 1`,
        args: [malId],
      },
    ],
    'read'
  );
  return {
    relations: cacheRecordFromRows<AnimeRelation>(relations?.rows ?? []),
    recommendations: cacheRecordFromRows<AnimeRecommendation>(recommendations?.rows ?? []),
  };
}

async function upsertCachedCollection<T>(
  tableName: 'anime_relations_cache' | 'anime_recommendations_cache',
  malId: number,
  data: T[]
): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `
      INSERT INTO ${tableName} (mal_id, payload, fetched_at)
      VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ON CONFLICT(mal_id) DO UPDATE SET
        payload = excluded.payload,
        fetched_at = excluded.fetched_at
    `,
    args: [malId, JSON.stringify(data)],
  });
}

export function getAnimeRelationsCache(
  malId: number
): Promise<AnimeDetailCacheRecord<AnimeRelation> | null> {
  return getCachedCollection<AnimeRelation>('anime_relations_cache', malId);
}

export function getAnimeRecommendationsCache(
  malId: number
): Promise<AnimeDetailCacheRecord<AnimeRecommendation> | null> {
  return getCachedCollection<AnimeRecommendation>('anime_recommendations_cache', malId);
}

export function upsertAnimeRelationsCache(
  malId: number,
  relations: AnimeRelation[]
): Promise<void> {
  return upsertCachedCollection('anime_relations_cache', malId, relations);
}

export function upsertAnimeRecommendationsCache(
  malId: number,
  recommendations: AnimeRecommendation[]
): Promise<void> {
  return upsertCachedCollection('anime_recommendations_cache', malId, recommendations);
}
