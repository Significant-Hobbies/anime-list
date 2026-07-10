#!/usr/bin/env node
import axios from 'axios';
import dotenv from 'dotenv';
import { API_CONFIG } from '../config';
import { getAllAnime, upsertAnimeBatchNoSummary } from '../db/animeData';
import { runAllMigrations } from '../db/migrations';
import {
  applyAniListStatusUpdates,
  applyDirectStatusUpdates,
  type AnimeStatusChange,
  type AniListStatusRecord,
  type DirectStatusRecord,
} from '../services/anilistStatusSync';

dotenv.config({ path: '.env.local' });
dotenv.config();

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';
const QUERY = `
  query ($ids: [Int], $perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      media(type: ANIME, idMal_in: $ids) {
        idMal
        status
        episodes
      }
    }
  }
`;

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_ANILIST_DELAY_MS = 2200;
const DEFAULT_JIKAN_DELAY_MS = API_CONFIG.rateLimit;
const DEFAULT_MAX_RETRIES = 5;
const CURRENTLY_AIRING_STATUS = 'Currently Airing';

interface JikanAnimeResponse {
  data?: {
    mal_id: number;
    status?: string | null;
    episodes?: number | null;
  };
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function getNumberArg(name: string, fallback: number): number {
  const prefix = `${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function ensureRequiredEnv(): void {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    throw new Error(
      'TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required to run the quarterly anime sync.'
    );
  }
}

async function fetchAniListBatch(
  malIds: number[],
  maxRetries: number,
  baseDelayMs: number
): Promise<AniListStatusRecord[]> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post<{
        data?: {
          Page?: {
            media?: AniListStatusRecord[];
          };
        };
      }>(
        ANILIST_GRAPHQL_URL,
        {
          query: QUERY,
          variables: {
            ids: malIds,
            perPage: malIds.length,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          timeout: 30000,
        }
      );

      return response.data.data?.Page?.media ?? [];
    } catch (error) {
      if (!axios.isAxiosError(error)) {
        throw error;
      }

      const statusCode = error.response?.status;
      const retryAfterSeconds = Number(error.response?.headers['retry-after']);
      const shouldRetry =
        attempt < maxRetries && (!statusCode || statusCode === 429 || statusCode >= 500);

      if (!shouldRetry) {
        throw error;
      }

      const delayMs =
        Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds * 1000
          : Math.min(60000, baseDelayMs * 2 ** attempt);

      console.warn(
        `AniList batch failed with ${statusCode ?? 'network error'} on attempt ${attempt}/${maxRetries}. Retrying in ${delayMs}ms...`
      );
      await delay(delayMs);
    }
  }

  return [];
}

async function fetchJikanAnimeByMalId(
  malId: number,
  maxRetries: number,
  baseDelayMs: number
): Promise<DirectStatusRecord | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get<JikanAnimeResponse>(`${API_CONFIG.baseUrl}/anime/${malId}`, {
        headers: {
          Accept: 'application/json',
        },
        timeout: 30000,
      });

      const anime = response.data.data;
      if (!anime) {
        return null;
      }

      return {
        malId: anime.mal_id,
        status: anime.status,
        episodes: anime.episodes,
      };
    } catch (error) {
      if (!axios.isAxiosError(error)) {
        throw error;
      }

      const statusCode = error.response?.status;
      if (statusCode === 404) {
        return null;
      }

      const retryAfterSeconds = Number(error.response?.headers['retry-after']);
      const shouldRetry =
        attempt < maxRetries && (!statusCode || statusCode === 429 || statusCode >= 500);

      if (!shouldRetry) {
        console.warn(
          `Jikan lookup for ${malId} failed with ${statusCode ?? 'network error'} after ${attempt}/${maxRetries} attempts. Skipping this fallback candidate.`
        );
        return null;
      }

      const delayMs =
        Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds * 1000
          : Math.min(60000, baseDelayMs * 2 ** attempt);

      console.warn(
        `Jikan lookup for ${malId} failed with ${statusCode ?? 'network error'} on attempt ${attempt}/${maxRetries}. Retrying in ${delayMs}ms...`
      );
      await delay(delayMs);
    }
  }

  console.warn(
    `Jikan lookup for ${malId} exhausted ${maxRetries} attempts. Skipping this fallback candidate.`
  );
  return null;
}

function hasTrackedChange(
  originalAnime: { status?: string; episodes?: number },
  nextAnime: { status?: string; episodes?: number }
): boolean {
  return originalAnime.status !== nextAnime.status || originalAnime.episodes !== nextAnime.episodes;
}

function toFinalChange(
  originalAnime: {
    mal_id: number;
    title: string;
    title_english?: string;
    status?: string;
    episodes?: number;
  },
  nextAnime: { mal_id: number; status?: string; episodes?: number }
): AnimeStatusChange | null {
  if (!hasTrackedChange(originalAnime, nextAnime)) {
    return null;
  }

  return {
    malId: originalAnime.mal_id,
    title: originalAnime.title_english || originalAnime.title,
    previousStatus: originalAnime.status !== nextAnime.status ? originalAnime.status : undefined,
    nextStatus: originalAnime.status !== nextAnime.status ? nextAnime.status : undefined,
    previousEpisodes:
      originalAnime.episodes !== nextAnime.episodes ? originalAnime.episodes : undefined,
    nextEpisodes: originalAnime.episodes !== nextAnime.episodes ? nextAnime.episodes : undefined,
  };
}

async function main() {
  ensureRequiredEnv();

  const startedAt = Date.now();
  const isDryRun = process.argv.includes('--dry-run');
  const batchSize = getNumberArg('--batch-size', DEFAULT_BATCH_SIZE);
  const aniListDelayMs = getNumberArg('--anilist-delay-ms', DEFAULT_ANILIST_DELAY_MS);
  const jikanDelayMs = getNumberArg('--jikan-delay-ms', DEFAULT_JIKAN_DELAY_MS);
  const limit = getNumberArg('--limit', 0);
  const skipJikanFallback = process.argv.includes('--skip-jikan-fallback');

  console.log(`[${new Date().toISOString()}] Starting quarterly anime sync...`);
  console.log(
    `Mode=${isDryRun ? 'dry-run' : 'write'}, batchSize=${batchSize}, aniListDelayMs=${aniListDelayMs}, jikanDelayMs=${jikanDelayMs}, jikanFallback=${skipJikanFallback ? 'off' : 'on'}${limit ? `, limit=${limit}` : ''}`
  );

  await runAllMigrations();

  const animeList = await getAllAnime();
  const scopedAnimeList = limit > 0 ? animeList.slice(0, limit) : animeList;
  const originalAnimeMap = new Map(scopedAnimeList.map((anime) => [anime.mal_id, anime] as const));
  const allMissingMalIds: number[] = [];
  const changedAnimeMap = new Map<number, (typeof scopedAnimeList)[number]>();

  for (let offset = 0; offset < scopedAnimeList.length; offset += batchSize) {
    const batch = scopedAnimeList.slice(offset, offset + batchSize);
    const malIds = batch.map((anime) => anime.mal_id);
    const updates = await fetchAniListBatch(malIds, DEFAULT_MAX_RETRIES, aniListDelayMs);
    const { changedAnime, missingMalIds } = applyAniListStatusUpdates(batch, updates);

    for (const anime of changedAnime) {
      const originalAnime = originalAnimeMap.get(anime.mal_id);
      if (originalAnime && hasTrackedChange(originalAnime, anime)) {
        changedAnimeMap.set(anime.mal_id, anime);
      }
    }

    allMissingMalIds.push(...missingMalIds);

    const processed = Math.min(offset + batch.length, scopedAnimeList.length);
    console.log(
      `AniList processed ${processed}/${scopedAnimeList.length} anime. Changed=${changedAnimeMap.size}, missing=${allMissingMalIds.length}`
    );

    if (processed < scopedAnimeList.length) {
      await delay(aniListDelayMs);
    }
  }

  const aniListMissingSet = new Set(allMissingMalIds);
  const jikanFallbackCandidates = skipJikanFallback
    ? []
    : scopedAnimeList.filter((anime) => {
        const currentAnime = changedAnimeMap.get(anime.mal_id) ?? anime;
        return (
          currentAnime.status === CURRENTLY_AIRING_STATUS || aniListMissingSet.has(anime.mal_id)
        );
      });
  const jikanNotFoundMalIds: number[] = [];

  if (jikanFallbackCandidates.length > 0) {
    console.log(
      `\nStarting targeted Jikan fallback for ${jikanFallbackCandidates.length} anime (currently airing or AniList-missing)...`
    );

    for (const [index, candidate] of jikanFallbackCandidates.entries()) {
      const currentAnime = changedAnimeMap.get(candidate.mal_id) ?? candidate;
      const jikanUpdate = await fetchJikanAnimeByMalId(
        candidate.mal_id,
        DEFAULT_MAX_RETRIES,
        jikanDelayMs
      );

      if (!jikanUpdate) {
        jikanNotFoundMalIds.push(candidate.mal_id);
      } else {
        const { changedAnime } = applyDirectStatusUpdates([currentAnime], [jikanUpdate]);
        if (changedAnime.length > 0) {
          const nextAnime = changedAnime[0];
          const originalAnime = originalAnimeMap.get(nextAnime.mal_id);
          if (originalAnime && hasTrackedChange(originalAnime, nextAnime)) {
            changedAnimeMap.set(nextAnime.mal_id, nextAnime);
          } else {
            changedAnimeMap.delete(nextAnime.mal_id);
          }
        }
      }

      const processed = index + 1;
      if (processed % 25 === 0 || processed === jikanFallbackCandidates.length) {
        console.log(
          `Jikan verified ${processed}/${jikanFallbackCandidates.length} fallback candidates. Changed=${changedAnimeMap.size}, jikanMissing=${jikanNotFoundMalIds.length}`
        );
      }

      if (processed < jikanFallbackCandidates.length) {
        await delay(jikanDelayMs);
      }
    }
  }

  const changedAnime = Array.from(changedAnimeMap.values());
  const finalChanges = changedAnime
    .map((anime) => {
      const originalAnime = originalAnimeMap.get(anime.mal_id);
      return originalAnime ? toFinalChange(originalAnime, anime) : null;
    })
    .filter((change): change is AnimeStatusChange => change !== null);

  console.log(`\nSummary:`);
  console.log(`- Checked: ${scopedAnimeList.length}`);
  console.log(`- Changed: ${changedAnime.length}`);
  console.log(`- Missing on AniList: ${allMissingMalIds.length}`);
  console.log(`- Checked with Jikan fallback: ${jikanFallbackCandidates.length}`);
  console.log(`- Missing on Jikan fallback: ${jikanNotFoundMalIds.length}`);

  if (finalChanges.length > 0) {
    console.log(`\nSample changes:`);
    for (const change of finalChanges.slice(0, 20)) {
      const statusDelta =
        change.previousStatus !== change.nextStatus
          ? `status: ${change.previousStatus ?? 'unset'} -> ${change.nextStatus ?? 'unset'}`
          : '';
      const episodesDelta =
        change.previousEpisodes !== change.nextEpisodes
          ? `episodes: ${change.previousEpisodes ?? 'unset'} -> ${change.nextEpisodes ?? 'unset'}`
          : '';
      const pieces = [statusDelta, episodesDelta].filter(Boolean);
      console.log(`- ${change.title} (${change.malId}): ${pieces.join(', ')}`);
    }
  }

  if (!isDryRun && changedAnime.length > 0) {
    await upsertAnimeBatchNoSummary(changedAnime);
    console.log(`\nPersisted ${changedAnime.length} changed anime records.`);
  } else if (isDryRun) {
    console.log(`\nDry run complete. No database changes were written.`);
  } else {
    console.log(`\nNo database changes were necessary.`);
  }

  const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[${new Date().toISOString()}] Done in ${durationSeconds}s.`);
}

main().catch((error) => {
  console.error(
    `[${new Date().toISOString()}] ✗ Error running quarterly anime sync:`,
    error instanceof Error ? error.message : error
  );
  process.exit(1);
});
