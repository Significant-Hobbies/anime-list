import axios from "axios";
import { delay, writeJsonFile } from "./utils/file";
import { API_CONFIG, FILE_PATHS } from "./config";
import { BaseAnimeItem, AnimeItem } from "./types/anime";
import { BaseMangaItem } from "./types/manga";
import { upsertAnimeBatch } from "./db/animeData";
import { transformRawAnime } from "./dataProcessor";

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

const fetchFromApi = async <T>(url: string): Promise<T | null> => {
  try {
    // Run delay and API call in parallel for efficient rate limiting
    const [response] = await Promise.all([
      axios.get(url),
      delay(API_CONFIG.rateLimit),
    ]);
    return response.data;
  } catch (error) {
    console.error(
      `Error fetching ${url}:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
};

// Fetch last 2 seasons and update Turso database
export const updateLatestTwoSeasonData = async (): Promise<void> => {
  const p0 = performance.now();

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const getSeason = (month: number): string => {
    if (month >= 1 && month <= 3) return "winter";
    else if (month >= 4 && month <= 6) return "spring";
    else if (month >= 7 && month <= 9) return "summer";
    else return "fall";
  };

  const getPreviousSeason = (
    season: string,
    year: number
  ): { season: string; year: number } => {
    const seasons = ["winter", "spring", "summer", "fall"];
    const currentIndex = seasons.indexOf(season);
    if (currentIndex === 0) {
      return { season: "fall", year: year - 1 };
    }
    return { season: seasons[currentIndex - 1], year };
  };

  const currentSeason = getSeason(currentMonth);
  const previousSeasonData = getPreviousSeason(currentSeason, currentYear);

  const seasonsToFetch = [
    { season: currentSeason, year: currentYear },
    { season: previousSeasonData.season, year: previousSeasonData.year },
  ];

  const allFetchedAnime: AnimeItem[] = [];

  for (const { season, year } of seasonsToFetch) {
    console.log(`Fetching ${season} ${year}...`);
    let page = 1;
    while (true) {
      const url = `${API_CONFIG.baseUrl}/seasons/${year}/${season}?page=${page}&limit=25`;
      const data = await fetchFromApi<ApiResponse<RawAnimeItem[]>>(url);

      if (!data?.data || !Array.isArray(data.data)) break;

      // Transform and collect anime
      for (const rawAnime of data.data) {
        const anime = transformRawAnime(rawAnime);
        // Only include anime with complete data
        if (anime.score && anime.scored_by && anime.members && anime.favorites && anime.year) {
          allFetchedAnime.push(anime);
        }
      }

      if (!data.pagination?.has_next_page) break;
      page++;
    }
    console.log(`✓ ${season} ${year} - fetched ${allFetchedAnime.length} anime so far`);
  }

  // Save to Turso database
  if (allFetchedAnime.length > 0) {
    console.log(`Saving ${allFetchedAnime.length} anime to database...`);
    const summary = await upsertAnimeBatch(allFetchedAnime);

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
      console.log("No changes detected.");
    }
  }

  console.log(`\n✓ Season update completed in ${(performance.now() - p0) / 1000}s`);
};

// Manga API functions
export const fetchAllMangaPages = async (): Promise<void> => {
  const fetchedManga: RawMangaItem[] = [];
  let page = 1;

  const p0 = performance.now();

  while (page <= API_CONFIG.totalPages) {
    const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.topManga}?page=${page}&limit=20`;
    const data = await fetchFromApi<ApiResponse<RawMangaItem[]>>(url);

    if (!data?.data || !Array.isArray(data.data)) {
      console.error(`Invalid data format on page ${page}`);
      break;
    }

    fetchedManga.push(...data.data);
    if (!data.pagination?.has_next_page) break;
    if (page % 10 === 0) console.log(`Fetched manga page ${page}`);
    page++;
  }

  const existingManga: Record<string, RawMangaItem> = {};
  for (const manga of fetchedManga) {
    existingManga[manga.mal_id.toString()] = manga;
  }

  await writeJsonFile(FILE_PATHS.mangaData, existingManga);
  console.log(`Updated all manga in ${performance.now() - p0}ms`);
};
