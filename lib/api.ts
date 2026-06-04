import type {
  FieldOptions,
  FilterActions,
  SearchResponse,
  SearchFilter,
  AnimeStats,
  WatchlistData,
  AnimeDetailResponse,
  EnrichedWatchlistResponse,
  TasteRecommendationsResponse,
  WatchlistTag,
  WatchlistImportPreview,
  AniListExportResponse,
  ScheduleTimelineResponse,
  MangaWatchlistData,
  EnrichedMangaWatchlistResponse,
  MangaDetailResponse,
  DiscoveryQueueResponse,
} from "./types";
import { getApiUrl } from "./apiConfig";

const API_URL = getApiUrl();
const BASE = `${API_URL}/api`;
const DEFAULT_PAGE_SIZE = 40;
const SEARCH_REQUEST_TIMEOUT_MS = 12_000;

// Auth now flows via httpOnly cookie set by the server. We send
// `credentials: "include"` on every request so the cookie ships along.
// No more reading tokens from localStorage (XSS hardening).
function withCreds(init: RequestInit = {}): RequestInit {
  return { ...init, credentials: "include" };
}

async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  timeoutMs?: number,
): Promise<T> {
  const controller = timeoutMs ? new AbortController() : null;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  if (controller && init?.signal) {
    if (init.signal.aborted) {
      controller.abort();
    } else {
      init.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  if (controller && timeoutMs) {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }

  try {
    const res = await fetch(
      url,
      withCreds(controller ? { ...init, signal: controller.signal } : init),
    );

    if (res.status === 401) {
      if (typeof window !== "undefined") {
        // Profile cache only — the cookie is the source of truth and the
        // server has already rejected it. Tell the app to drop user state.
        localStorage.removeItem("mal_profile");
        // Best-effort: also clear any leftover legacy entry.
        localStorage.removeItem("mal_auth");
        window.dispatchEvent(new Event("mal_auth_expired"));
      }
      throw new Error("Session expired. Please sign in again.");
    }
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Search service timed out. Please try again.");
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

const jsonHeaders = { "Content-Type": "application/json" } as const;

export function getFields(): Promise<FieldOptions> {
  return fetchJson(`${BASE}/fields`);
}

export function getFilterActions(): Promise<FilterActions> {
  return fetchJson(`${BASE}/filters`);
}

export function searchAnime(
  filters: SearchFilter[],
  opts: {
    pagesize?: number;
    offset?: number;
    sortBy?: string;
    airing?: "yes" | "no" | "any";
    hideWatched?: string[];
    includeWatched?: string[];
  } = {}
): Promise<SearchResponse> {
  return fetchJson(
    `${BASE}/search`,
    {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        filters,
        pagesize: opts.pagesize ?? DEFAULT_PAGE_SIZE,
        offset: opts.offset ?? 0,
        sortBy: opts.sortBy,
        airing: opts.airing ?? "any",
        hideWatched: opts.hideWatched ?? [],
        includeWatched: opts.includeWatched ?? [],
      }),
    },
    SEARCH_REQUEST_TIMEOUT_MS,
  );
}

export function getStats(opts: {
  hideWatched?: string[];
  includeWatched?: string[];
} = {}): Promise<AnimeStats> {
  const params = new URLSearchParams();
  if (opts.hideWatched && opts.hideWatched.length > 0) {
    params.set("hideWatched", opts.hideWatched.join(","));
  }
  if (opts.includeWatched && opts.includeWatched.length > 0) {
    params.set("includeWatched", opts.includeWatched.join(","));
  }
  const query = params.toString();
  const suffix = query ? `?${query}` : "";
  return fetchJson(`${BASE}/stats${suffix}`);
}

export function getWatchlist(status?: string): Promise<WatchlistData> {
  const url = status ? `${BASE}/watchlist?status=${status}` : `${BASE}/watchlist`;
  return fetchJson(url);
}

export function getAnimeDetail(malId: number | string): Promise<AnimeDetailResponse> {
  return fetchJson(`${BASE}/anime/${malId}`);
}

export function addToWatchlist(
  malIds: number[],
  status: string,
  tagColor?: string,
): Promise<{ success: boolean; message: string }> {
  return fetchJson(`${BASE}/watched/add`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ mal_ids: malIds, status, tagColor }),
  });
}

export function removeFromWatchlist(
  malIds: number[]
): Promise<{ success: boolean; message: string }> {
  return fetchJson(`${BASE}/watched/remove`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ mal_ids: malIds }),
  });
}

export function getEnrichedWatchlist(): Promise<EnrichedWatchlistResponse> {
  return fetchJson(`${BASE}/watchlist/enriched`);
}

export function getTasteRecommendations(): Promise<TasteRecommendationsResponse> {
  return fetchJson(`${BASE}/watchlist/recommendations`);
}

export function previewWatchlistImport(
  source: "mal" | "anilist",
  payload: string,
): Promise<WatchlistImportPreview> {
  return fetchJson(`${BASE}/watchlist/import/preview`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ source, payload }),
  });
}

export function applyWatchlistImport(
  source: "mal" | "anilist",
  payload: string,
): Promise<WatchlistImportPreview> {
  return fetchJson(`${BASE}/watchlist/import/apply`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ source, payload }),
  });
}

export function exportAniListWatchlist(): Promise<AniListExportResponse> {
  return fetchJson(`${BASE}/watchlist/export/anilist`);
}

export function updateAnimeNote(
  malId: number | string,
  note: string,
): Promise<{ success: boolean; note: string }> {
  return fetchJson(`${BASE}/anime/${malId}/note`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ note }),
  });
}

export function getWatchlistTags(): Promise<{ tags: WatchlistTag[] }> {
  return fetchJson(`${BASE}/watchlist/tags`);
}

export function saveWatchlistTag(
  tag: string,
  color?: string,
): Promise<{ success: boolean; message: string }> {
  return fetchJson(`${BASE}/watchlist/tags`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ tag, color }),
  });
}

export function updateWatchlistTag(
  tagId: string,
  payload: { tag?: string; color?: string },
): Promise<{ success: boolean; message: string }> {
  return fetchJson(`${BASE}/watchlist/tags/${tagId}/update`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
}

export function deleteWatchlistTag(
  tagId: string,
  moveToTagId?: string,
): Promise<{ success: boolean; message: string }> {
  return fetchJson(`${BASE}/watchlist/tags/${tagId}/delete`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ moveToTagId }),
  });
}

// Schedule

export function getScheduleTimeline(): Promise<ScheduleTimelineResponse> {
  return fetchJson(`${BASE}/schedule/timeline`);
}

export function addToSchedule(
  malIds: number[],
  episodesPerDay: number = 3,
): Promise<{ success: boolean; message: string }> {
  return fetchJson(`${BASE}/schedule/add`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ mal_ids: malIds, episodes_per_day: episodesPerDay }),
  });
}

export function updateScheduleItem(
  malId: string,
  payload: { episodes_watched?: number; episodes_per_day?: number },
): Promise<{ success: boolean; message: string }> {
  return fetchJson(`${BASE}/schedule/${malId}/update`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
}

export function removeFromSchedule(
  malIds: number[],
): Promise<{ success: boolean; message: string }> {
  return fetchJson(`${BASE}/schedule/remove`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ mal_ids: malIds }),
  });
}

export function reorderSchedule(
  malIds: string[],
): Promise<{ success: boolean; message: string }> {
  return fetchJson(`${BASE}/schedule/reorder`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ mal_ids: malIds }),
  });
}

export function getLastUpdated(): Promise<{
  lastUpdated: string | null;
  anime: string | null;
  manga: string | null;
}> {
  return fetchJson(`${BASE}/last-updated`);
}

export interface ChangelogEntry {
  date: string;
  title: string;
  title_english: string | null;
  type: string | null;
  mal_id: number;
}

export function getChangelog(limit = 200): Promise<{ changes: ChangelogEntry[] }> {
  return fetchJson(`${BASE}/changelog?limit=${limit}`);
}

export interface RandomAnimePick {
  mal_id: number;
  id: number;
  title: string;
  title_english?: string;
}

export function getRandomAnimePick(options?: {
  genre?: string;
  limit?: number;
}): Promise<{ results: RandomAnimePick[] }> {
  const params = new URLSearchParams();
  if (options?.genre) params.set("genre", options.genre);
  if (options?.limit != null) params.set("limit", String(options.limit));
  const query = params.toString();
  return fetchJson(`${BASE}/anime/random${query ? `?${query}` : ""}`);
}

const MANGA_BASE = `${BASE}/manga`;

export function getMangaFields(): Promise<FieldOptions & { boolean?: string[] }> {
  return fetchJson(`${MANGA_BASE}/fields`);
}

export function getMangaFilterActions(): Promise<FilterActions & { text?: string[] }> {
  return fetchJson(`${MANGA_BASE}/filters`);
}

export function searchManga(
  filters: SearchFilter[],
  opts: {
    pagesize?: number;
    offset?: number;
    sortBy?: string;
    hideWatched?: string[];
  } = {},
): Promise<SearchResponse> {
  return fetchJson(`${MANGA_BASE}/search`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      filters,
      pagesize: opts.pagesize ?? DEFAULT_PAGE_SIZE,
      offset: opts.offset ?? 0,
      sortBy: opts.sortBy,
      hideWatched: opts.hideWatched ?? [],
    }),
  });
}

export function getMangaStats(opts: { hideWatched?: string[] } = {}): Promise<AnimeStats> {
  const params = new URLSearchParams();
  if (opts.hideWatched && opts.hideWatched.length > 0) {
    params.set("hideWatched", opts.hideWatched.join(","));
  }
  const query = params.toString();
  return fetchJson(`${MANGA_BASE}/stats${query ? `?${query}` : ""}`);
}

export function getMangaWatchlist(): Promise<MangaWatchlistData> {
  return fetchJson(`${MANGA_BASE}/watchlist`);
}

export function getEnrichedMangaWatchlist(): Promise<EnrichedMangaWatchlistResponse> {
  return fetchJson(`${MANGA_BASE}/watchlist/enriched`);
}

export function addToMangaWatchlist(
  malIds: number[],
  status: string,
  tagColor?: string,
): Promise<{ success: boolean; message: string }> {
  return fetchJson(`${MANGA_BASE}/watched/add`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ mal_ids: malIds, status, tagColor }),
  });
}

export function removeFromMangaWatchlist(
  malIds: number[],
): Promise<{ success: boolean; message: string }> {
  return fetchJson(`${MANGA_BASE}/watched/remove`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ mal_ids: malIds }),
  });
}

export function getMangaDetail(malId: number | string): Promise<MangaDetailResponse> {
  return fetchJson(`${MANGA_BASE}/${malId}`);
}

export function getRandomMangaPick(options?: {
  genre?: string;
  limit?: number;
}): Promise<{ results: RandomAnimePick[] }> {
  const params = new URLSearchParams();
  if (options?.genre) params.set("genre", options.genre);
  if (options?.limit != null) params.set("limit", String(options.limit));
  const query = params.toString();
  return fetchJson(`${MANGA_BASE}/random${query ? `?${query}` : ""}`);
}
export function getDiscoveryQueue(limit = 50): Promise<DiscoveryQueueResponse> {
  return fetchJson(`${BASE}/discover/queue?limit=${limit}`);
}

export function dismissDiscoveryItems(
  malIds: (string | number)[],
): Promise<{ success: boolean; message: string }> {
  return fetchJson(`${BASE}/discover/dismiss`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ mal_ids: malIds }),
  });
}
