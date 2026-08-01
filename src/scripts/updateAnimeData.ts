#!/usr/bin/env node
import 'dotenv/config';
import { updateLatestTwoSeasonData } from '../api';
import { configureOperatorDatabaseFromArgs } from '../db/operatorClient';
import { animeStore } from '../store/animeStore';

/**
 * Fetch current and previous season anime and save them through Wrangler D1.
 */
async function main() {
  configureOperatorDatabaseFromArgs();
  console.log(`[${new Date().toISOString()}] Starting anime data update...`);

  try {
    // Fetch latest two seasons and save through the explicit Wrangler D1 boundary.
    await updateLatestTwoSeasonData();

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
