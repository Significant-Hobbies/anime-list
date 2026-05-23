import { existsSync, statSync } from "fs";
import {
  fetchAllMangaPages,
} from "../api";
import { FILE_PATHS } from "../config";
import {
  cleanExistingMangaJsonFile,
} from "../dataProcessor";
import { animeStore } from "../store/animeStore";
import { mangaStore } from "../store/mangaStore";
import { runAllMigrations } from "../db/migrations";
import { getAnimeCount } from "../db/animeData";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function isFileOlderThan(filePath: string, maxAgeMs: number): boolean {
  try {
    const { mtimeMs } = statSync(filePath);
    return Date.now() - mtimeMs > maxAgeMs;
  } catch {
    return true;
  }
}

/**
 * Load anime data from Turso database into memory
 */
export async function loadAnimeData(): Promise<void> {
  try {
    console.log("Loading anime data from database...");

    // Ensure database tables exist
    await runAllMigrations();

    // Check if database has data
    const count = await getAnimeCount();

    if (count === 0) {
      console.warn("⚠ No anime data in database. Run 'npm run db:seed' to import data.");
      console.warn("  Or run 'npm run db:update' to fetch latest seasons.");
      return;
    }

    // Load data into memory cache
    await animeStore.setAnimeList();

    console.log(`✓ Loaded ${count} anime from database`);
  } catch (error) {
    console.error("Error loading anime data:", error);
    throw error;
  }
}

// Manga data loading functions
async function initMangaData() {
  await fetchAllMangaPages();
  mangaStore.setMangaList(await cleanExistingMangaJsonFile());
}

export async function loadMangaData(): Promise<void> {
  const fileExists = existsSync(FILE_PATHS.cleanMangaData);
  if (!fileExists) {
    console.log("Manga data file not found. Initializing...");
    return initMangaData();
  }

  if (isFileOlderThan(FILE_PATHS.cleanMangaData, THIRTY_DAYS_MS)) {
    console.log("Monthly manga reclean starting in background");
    initMangaData();
  }
  await mangaStore.setMangaList();
  console.log("Manga data loaded successfully");
}
