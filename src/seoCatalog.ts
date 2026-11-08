import animeData from './data/seo-anime.json';
import mangaData from './data/seo-manga.json';
import type { SeoEntry } from './seoRewrite';

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
