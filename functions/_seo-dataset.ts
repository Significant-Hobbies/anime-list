/**
 * Shared SEO dataset loader for Pages Functions.
 *
 * The JSON files are imported at build time and bundled with the function.
 * ~4 MB total (2.9 MB anime + 1.3 MB manga) — well under the 10 MB
 * Workers limit, with headroom for growth.
 */

import animeData from '../src/data/seo-anime.json';
import mangaData from '../src/data/seo-manga.json';
import type { SeoEntry } from '../src/seoRewrite';

// Build lookup maps for O(1) access by mal_id
const animeMap = new Map<number, SeoEntry>();
for (const entry of animeData as SeoEntry[]) {
  animeMap.set(entry.id, entry);
}

const mangaMap = new Map<number, SeoEntry>();
for (const entry of mangaData as SeoEntry[]) {
  mangaMap.set(entry.id, entry);
}

export function getAnimeEntry(id: number): SeoEntry | null {
  return animeMap.get(id) ?? null;
}

export function getMangaEntry(id: number): SeoEntry | null {
  return mangaMap.get(id) ?? null;
}
