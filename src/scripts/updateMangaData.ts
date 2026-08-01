#!/usr/bin/env node
import dotenv from 'dotenv';
import { updateLatestTopMangaData } from '../api';
import { API_CONFIG } from '../config';
import { configureOperatorDatabaseFromArgs } from '../db/operatorClient';
import { mangaStore } from '../store/mangaStore';

dotenv.config({ path: '.env.local' });
dotenv.config();

function resolveMaxPages(): number {
  if (process.argv.includes('--full')) {
    return API_CONFIG.totalPages;
  }
  const pagesArg = process.argv.find((arg) => arg.startsWith('--pages='));
  if (pagesArg) {
    const parsed = Number(pagesArg.slice('--pages='.length));
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return API_CONFIG.mangaDailyUpdatePages;
}

/**
 * Fetch top-ranked manga from Jikan and upsert them through Wrangler D1.
 */
async function main() {
  configureOperatorDatabaseFromArgs();
  const maxPages = resolveMaxPages();
  console.log(
    `[${new Date().toISOString()}] Starting manga data update (${maxPages} pages max)...`
  );

  try {
    await updateLatestTopMangaData(maxPages);
    await mangaStore.setMangaList();

    console.log(`[${new Date().toISOString()}] ✓ Manga data update completed successfully`);
    process.exit(0);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ✗ Error updating manga data:`, error);
    process.exit(1);
  }
}

main();
