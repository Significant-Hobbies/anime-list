import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test } from 'vitest';

import { buildTasteRecommendations } from './recommendations';
import type { AnimeItem } from './types/anime';
import type { WatchlistData } from './types/watchlist';

const CATALOG = JSON.parse(
  readFileSync(resolve(process.cwd(), 'cleaned_anime_data.json'), 'utf8')
) as AnimeItem[];
const CATALOG_SIZES = [1_000, 5_000, CATALOG.length];
const ITERATIONS = 20;
const STATUSES = ['Completed', 'Watching', 'BRR', 'Deferred'] as const;
const watchlist: WatchlistData = {
  user: { id: 'performance-fixture', name: 'Performance fixture' },
  anime: Object.fromEntries(
    CATALOG.slice(0, 120).map((anime, index) => [
      String(anime.mal_id),
      {
        id: String(anime.mal_id),
        status: STATUSES[index % STATUSES.length],
      },
    ])
  ),
};
const watchedIds = new Set(Object.keys(watchlist.anime));

test('scales taste recommendations across the checked-in catalog', () => {
  expect(CATALOG).toHaveLength(14_841);
  const metrics: string[] = [];

  for (const size of CATALOG_SIZES) {
    const catalog = CATALOG.slice(0, size);
    const warmup = buildTasteRecommendations(catalog, watchlist, 12);
    expect(warmup.recommendations).toHaveLength(12);
    expect(warmup.recommendations.every((item) => !watchedIds.has(String(item.mal_id)))).toBe(true);

    let duration = 0;
    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      const startedAt = performance.now();
      const result = buildTasteRecommendations(catalog, watchlist, 12);
      duration += performance.now() - startedAt;
      expect(result.recommendations.map((item) => item.mal_id)).toEqual(
        warmup.recommendations.map((item) => item.mal_id)
      );
    }
    metrics.push(`size${size}=${(duration / ITERATIONS).toFixed(3)}ms/op`);
  }

  console.log(`[benchmark] ${metrics.join(' ')} (${ITERATIONS} iterations)`);
});
