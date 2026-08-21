import { delay } from './utils/file';
import { API_CONFIG } from './config';
import type { BaseAnimeItem, AnimeItem } from './types/anime';
import type { BaseMangaItem } from './types/manga';
import { upsertAnimeBatch } from './db/animeData';
import { upsertMangaBatch } from './db/mangaData';
import { transformRawAnime, transformRawManga } from './dataProcessor';
import type { MangaItem } from './types/manga';

type RawAnimeItem = BaseAnimeItem & {
  genres?: Array<{ name: string }>;
  themes?: Array<{ name: string }>;
  demographics?: Array<{ name: string }>;
  images?: { webp?: { image_url?: string }; jpg?: { image_url?: string } };
};

type RawMangaItem = BaseMangaItem & {
  genres?: Array<{ name: string }>;
  themes?: Array<{ name: string }>;
  demographics?: Array<{ name: string }>;
  images?: { webp?: { image_url?: string }; jpg?: { image_url?: string } };
};

interface ApiResponse<T> {
  data: T;
  pagination?: {
    has_next_page: boolean;
  };
}

const MAX_API_ATTEMPTS = 3;

export const fetchFromApi = async <T>(
  url: string,
  maxAttempts: number = MAX_API_ATTEMPTS
): Promise<T | null> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Always complete the rate-limit delay, including when the request fails.
      const [request] = await Promise.allSettled([
        fetch(url, { headers: { Accept: 'application/json' } }),
        delay(API_CONFIG.rateLimit),
      ]);
      if (request.status === 'rejected') throw request.reason;
      if (!request.value.ok) {
        throw new Error(`Request failed with status code ${request.value.status}`);
      }
      return (await request.value.json()) as T;
    } catch (error) {
      console.error(
        `Error fetching ${url} (attempt ${attempt}/${maxAttempts}):`,
        error instanceof Error ? error.message : String(error)
      );
      if (attempt < maxAttempts) {
        console.warn(`Retrying ${url}...`);
      }
    }
  }

  return null;
};

export function assertCatalogRowsFetched(kind: 'anime' | 'manga', count: number): void {
  if (count === 0) {
    throw new Error(
      `Catalog refresh failed: Jikan returned no usable ${kind} rows. Refusing to report success.`
    );
  }
}

export function assertCatalogRefreshComplete(kind: 'anime' | 'manga', failedPages: string[]): void {
  if (failedPages.length > 0) {
    throw new Error(
      `Catalog refresh incomplete: Jikan failed for ${kind} ${failedPages.join(', ')} after retries.`
    );
  }
}

export function isRequiredSeasonPage(page: number): boolean {
  return page === 1;
}

const getSeason = (month: number): string => {
  if (month >= 1 && month <= 3) return 'winter';
  if (month >= 4 && month <= 6) return 'spring';
  if (month >= 7 && month <= 9) return 'summer';
  return 'fall';
};

const getPreviousSeason = (season: string, year: number): { season: string; year: number } => {
  const seasons = ['winter', 'spring', 'summer', 'fall'];
  const currentIndex = seasons.indexOf(season);
  if (currentIndex === 0) {
    return { season: 'fall', year: year - 1 };
  }
  return { season: seasons[currentIndex - 1], year };
};

function isCompleteAnime(anime: AnimeItem): boolean {
  return Boolean(anime.score && anime.scored_by && anime.members && anime.favorites && anime.year);
}

async function fetchSeasonAnime(
  season: string,
  year: number,
  allFetchedAnime: AnimeItem[],
  failedPages: string[]
): Promise<void> {
  console.log(`Fetching ${season} ${year}...`);
  const seasonStartCount = allFetchedAnime.length;
  let page = 1;
  while (true) {
    const url = `${API_CONFIG.baseUrl}/seasons/${year}/${season}?page=${page}&limit=25`;
    const data = await fetchFromApi<ApiResponse<RawAnimeItem[]>>(url);

    if (!data?.data || !Array.isArray(data.data)) {
      const failedPage = `${season} ${year} page ${page}`;
      if (isRequiredSeasonPage(page)) {
        failedPages.push(failedPage);
      } else {
        console.warn(
          `Jikan failed for optional ${failedPage} after retries; keeping ${allFetchedAnime.length - seasonStartCount} fetched rows for this season.`
        );
      }
      break;
    }

    for (const rawAnime of data.data) {
      const anime = transformRawAnime(rawAnime);
      if (isCompleteAnime(anime)) {
        allFetchedAnime.push(anime);
      }
    }

    if (!data.pagination?.has_next_page) break;
    page++;
  }
  console.log(`✓ ${season} ${year} - fetched ${allFetchedAnime.length} anime so far`);
}

function logUpsertSummary(summary: {
  added: { mal_id: number; title: string }[];
  updated: { mal_id: number; title: string }[];
}): void {
  if (summary.added.length > 0) {
    console.log(`\n📥 NEW (${summary.added.length}):`);
    for (const a of summary.added) {
      console.log(`  + ${a.title} (${a.mal_id})`);
    }
  }
  if (summary.updated.length > 0) {
    console.log(`\n🔄 UPDATED (${summary.updated.length}):`);
    for (const a of summary.updated) {
      console.log(`  ~ ${a.title} (${a.mal_id})`);
    }
  }
  if (summary.added.length === 0 && summary.updated.length === 0) {
    console.log('No changes detected.');
  }
}

// Fetch the last two seasons and update the bound D1 database.
export const updateLatestTwoSeasonData = async (): Promise<void> => {
  const p0 = performance.now();

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const currentSeason = getSeason(currentMonth);
  const previousSeasonData = getPreviousSeason(currentSeason, currentYear);

  const seasonsToFetch = [
    { season: currentSeason, year: currentYear },
    { season: previousSeasonData.season, year: previousSeasonData.year },
  ];

  const allFetchedAnime: AnimeItem[] = [];
  const failedPages: string[] = [];

  for (const { season, year } of seasonsToFetch) {
    await fetchSeasonAnime(season, year, allFetchedAnime, failedPages);
  }

  assertCatalogRowsFetched('anime', allFetchedAnime.length);

  // Save through the configured D1 boundary.
  console.log(`Saving ${allFetchedAnime.length} anime to database...`);
  const summary = await upsertAnimeBatch(allFetchedAnime);
  logUpsertSummary(summary);

  assertCatalogRefreshComplete('anime', failedPages);

  console.log(`\n✓ Season update completed in ${(performance.now() - p0) / 1000}s`);
};

/** Refresh popular manga from Jikan top list into D1 (daily incremental sync). */
export const updateLatestTopMangaData = async (
  maxPages: number = API_CONFIG.mangaDailyUpdatePages
): Promise<void> => {
  const p0 = performance.now();
  let pending: MangaItem[] = [];
  let totalSaved = 0;
  let uniqueCount = 0;
  let stalePages = 0;
  const failedPages: string[] = [];
  const seenMalIds = new Set<number>();
  const FLUSH_EVERY_PAGES = 25;
  const MAX_STALE_PAGES = 5;

  console.log(`Fetching top manga (up to ${maxPages} pages)...`);

  const flushPending = async (): Promise<void> => {
    if (pending.length === 0) return;
    const batch = pending;
    pending = [];
    await upsertMangaBatch(batch);
    totalSaved += batch.length;
    console.log(`  saved ${totalSaved} titles to catalog database`);
  };

  for (let page = 1; page <= maxPages; page++) {
    const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.topManga}?page=${page}&limit=20`;
    const data = await fetchFromApi<ApiResponse<RawMangaItem[]>>(url);

    if (!data?.data || !Array.isArray(data.data)) {
      console.error(`Invalid manga data on page ${page} after retries`);
      failedPages.push(`page ${page}`);
      break;
    }

    let newThisPage = 0;
    for (const rawManga of data.data) {
      const manga = transformRawManga(rawManga);
      if (
        manga.score &&
        manga.scored_by &&
        manga.members &&
        manga.favorites &&
        manga.year &&
        !seenMalIds.has(manga.mal_id)
      ) {
        seenMalIds.add(manga.mal_id);
        pending.push(manga);
        newThisPage++;
      }
    }
    uniqueCount += newThisPage;

    if (newThisPage === 0) {
      stalePages++;
      if (stalePages >= MAX_STALE_PAGES) {
        console.log(`  stopping after ${MAX_STALE_PAGES} pages with no new titles (page ${page})`);
        break;
      }
    } else {
      stalePages = 0;
    }

    if (page % FLUSH_EVERY_PAGES === 0) {
      console.log(`  page ${page}/${maxPages} — ${uniqueCount} unique titles fetched`);
      await flushPending();
    }

    if (!data.pagination?.has_next_page) break;
  }

  await flushPending();

  assertCatalogRowsFetched('manga', totalSaved);
  assertCatalogRefreshComplete('manga', failedPages);
  console.log(`Saved ${totalSaved} manga total.`);

  console.log(
    `\n✓ Manga update completed in ${((performance.now() - p0) / 1000).toFixed(1)}s (${uniqueCount} unique titles)`
  );
};
