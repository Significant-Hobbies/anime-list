#!/usr/bin/env node
import 'dotenv/config';
import { updateLatestTopAnimeData, updateLatestTwoSeasonData } from '../api';
import { API_CONFIG } from '../config';
import { configureOperatorDatabaseFromArgs } from '../db/operatorClient';
import { animeStore } from '../store/animeStore';

/** Fetch the seasonal or full anime catalog and save it through Wrangler D1. */
async function main() {
  configureOperatorDatabaseFromArgs();
  const isFull = process.argv.includes('--full');
  const pagesArg = process.argv.find((arg) => arg.startsWith('--pages='));
  const parsedPages = pagesArg ? Number(pagesArg.slice('--pages='.length)) : API_CONFIG.totalPages;
  const maxPages =
    Number.isFinite(parsedPages) && parsedPages > 0 ? parsedPages : API_CONFIG.totalPages;
  console.log(
    `[${new Date().toISOString()}] Starting ${isFull ? 'full ' : ''}anime data update...`
  );

  try {
    if (isFull) {
      await updateLatestTopAnimeData(maxPages);
    } else {
      // Fetch latest two seasons and save through the explicit Wrangler D1 boundary.
      await updateLatestTwoSeasonData();
    }

    // Refresh the in-memory store cache
    await animeStore.setAnimeList();

    console.log(`[${new Date().toISOString()}] ✓ Anime data update completed successfully`);
    process.exit(0);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ✗ Error updating anime data:`, error);
    process.exit(1);
  }
}

main();
