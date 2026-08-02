#!/usr/bin/env node
import 'dotenv/config';
import { readJsonFile } from '../utils/file';
import { FILE_PATHS } from '../config';
import type { AnimeItem } from '../types/anime';
import { upsertAnimeBatch } from '../db/animeData';
import { configureOperatorDatabaseFromArgs } from '../db/operatorClient';

/**
 * Seed the anime catalog through Wrangler's local-by-default D1 boundary.
 */
async function main() {
  configureOperatorDatabaseFromArgs();
  console.log('Starting anime catalog seed to D1...');

  // Read existing JSON data
  const animeData = await readJsonFile<Record<string, AnimeItem>>(FILE_PATHS.cleanAnimeData);

  if (!animeData) {
    console.error('No anime data found in JSON file. Run data fetch first.');
    process.exit(1);
  }

  const animeList = Object.values(animeData);
  console.log(`Found ${animeList.length} anime in JSON file`);

  // Insert into D1 in bounded batches.
  await upsertAnimeBatch(animeList);

  console.log('✓ Anime data migration completed successfully');
  process.exit(0);
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
