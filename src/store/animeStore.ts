import type { AnimeItem } from '../types/anime';
import { getAllAnime } from '../db/animeData';

class AnimeStore {
  private animeList: AnimeItem[] = [];
  private static instance: AnimeStore;
  private lastLoadedAt: number = 0;
  private isRefreshing: boolean = false;
  // Shared by all concurrent requests during a cold-start load, so we only
  // hit D1 once per isolate even with parallel inbound traffic.
  private coldLoadPromise: Promise<AnimeItem[]> | null = null;
  // Production: keep one full-catalog D1 scan per isolate to a one-hour window.
  // Cron job updates DB daily, manual refresh if needed
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour cache

  private constructor() {}

  static getInstance(): AnimeStore {
    if (!AnimeStore.instance) {
      AnimeStore.instance = new AnimeStore();
    }
    return AnimeStore.instance;
  }

  async setAnimeList(animeData?: AnimeItem[] | null): Promise<void> {
    if (!animeData) {
      // Load from the D1 catalog.
      animeData = await getAllAnime();
    }
    if (!animeData || animeData.length === 0) {
      return console.error('No anime data found in database');
    }
    console.log(`Loaded ${animeData.length} anime from database`);
    this.animeList = animeData;
    this.lastLoadedAt = Date.now();
  }

  async getAnimeList(): Promise<AnimeItem[]> {
    const now = Date.now();
    const isExpired = now - this.lastLoadedAt > this.CACHE_TTL;
    const isEmpty = this.animeList.length === 0;

    // Cold isolate: dedupe concurrent loads so 50 parallel inbound requests
    // share a single D1 scan instead of stampeding it.
    if (isEmpty) {
      if (!this.coldLoadPromise) {
        console.log('Cache empty, loading from database...');
        this.coldLoadPromise = (async () => {
          try {
            await this.setAnimeList();
            return this.animeList;
          } finally {
            this.coldLoadPromise = null;
          }
        })();
      }
      return this.coldLoadPromise;
    }

    // If cache is stale, refresh in background (non-blocking)
    if (isExpired && !this.isRefreshing) {
      console.log('Cache stale, refreshing in background...');
      this.isRefreshing = true;
      this.refreshWithRetry();
    }

    // Always return current cache immediately (stale-while-revalidate)
    return this.animeList;
  }

  private async refreshWithRetry(attempt = 1, maxAttempts = 3): Promise<void> {
    try {
      await this.setAnimeList();
      console.log('✓ Background cache refresh complete');
    } catch (err) {
      if (attempt < maxAttempts) {
        console.warn(`Cache refresh attempt ${attempt}/${maxAttempts} failed, retrying in 30s...`);
        setTimeout(() => this.refreshWithRetry(attempt + 1, maxAttempts), 30000);
        return;
      }
      console.error('✗ Background cache refresh failed after all retries:', err);
    } finally {
      this.isRefreshing = false;
    }
  }

  clearStore(): void {
    this.animeList = [];
    this.lastLoadedAt = 0;
    this.isRefreshing = false;
  }
}

// Export a singleton instance
export const animeStore = AnimeStore.getInstance();
