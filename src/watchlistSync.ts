import type { WatchedAnime } from "./types/watchlist";

export type ExternalWatchStatus =
  | "Watching"
  | "Completed"
  | "Deferred"
  | "Avoiding"
  | "BRR";

export interface ExternalWatchlistEntry {
  malId: string;
  status: ExternalWatchStatus;
  title?: string;
  type?: string;
  episodes?: number;
  note?: string;
}

export interface WatchlistImportPreview {
  source: "mal" | "anilist";
  entries: ExternalWatchlistEntry[];
  statusCounts: Record<string, number>;
  skipped: number;
}

const MAL_STATUS_MAP: Record<string, ExternalWatchStatus> = {
  watching: "Watching",
  completed: "Completed",
  "on-hold": "Deferred",
  dropped: "Avoiding",
  "plan to watch": "BRR",
  "plan-to-watch": "BRR",
};

const ANILIST_STATUS_MAP: Record<string, ExternalWatchStatus> = {
  CURRENT: "Watching",
  COMPLETED: "Completed",
  PAUSED: "Deferred",
  DROPPED: "Avoiding",
  PLANNING: "BRR",
  REPEATING: "Watching",
};

const ANILIST_EXPORT_STATUS_MAP: Record<string, string> = {
  watching: "CURRENT",
  completed: "COMPLETED",
  done: "COMPLETED",
  deferred: "PAUSED",
  avoiding: "DROPPED",
  brr: "PLANNING",
};

function decodeXmlText(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'");
}

function readXmlTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXmlText(match[1].trim()) : "";
}

function normalizeStatus(
  source: "mal" | "anilist",
  value: unknown,
): ExternalWatchStatus | null {
  if (typeof value !== "string") return null;
  const key = source === "mal" ? value.trim().toLowerCase() : value.trim().toUpperCase();
  return source === "mal" ? MAL_STATUS_MAP[key] ?? null : ANILIST_STATUS_MAP[key] ?? null;
}

function toPositiveNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function summarize(
  source: "mal" | "anilist",
  entries: ExternalWatchlistEntry[],
  skipped: number,
): WatchlistImportPreview {
  const statusCounts: Record<string, number> = {};
  for (const entry of entries) {
    statusCounts[entry.status] = (statusCounts[entry.status] ?? 0) + 1;
  }
  return { source, entries, statusCounts, skipped };
}

export function parseMalAnimeXml(xml: string): WatchlistImportPreview {
  const entries: ExternalWatchlistEntry[] = [];
  let skipped = 0;
  const blocks = xml.match(/<anime>[\s\S]*?<\/anime>/gi) ?? [];

  for (const block of blocks) {
    const malId = readXmlTag(block, "series_animedb_id");
    const status = normalizeStatus("mal", readXmlTag(block, "my_status"));
    if (!malId || !status) {
      skipped += 1;
      continue;
    }

    entries.push({
      malId,
      status,
      title: readXmlTag(block, "series_title") || undefined,
      type: readXmlTag(block, "series_type") || undefined,
      episodes: toPositiveNumber(readXmlTag(block, "series_episodes")),
      note: readXmlTag(block, "my_comments") || undefined,
    });
  }

  return summarize("mal", entries, skipped);
}

type AniListEntry = {
  media?: {
    idMal?: number | string | null;
    title?: { romaji?: string; english?: string; native?: string };
    format?: string | null;
    episodes?: number | null;
  } | null;
  status?: string | null;
  notes?: string | null;
};

function collectAniListEntries(value: unknown): AniListEntry[] {
  if (Array.isArray(value)) return value as AniListEntry[];
  if (!value || typeof value !== "object") return [];
  const root = value as {
    lists?: { entries?: AniListEntry[] }[];
    data?: { MediaListCollection?: { lists?: { entries?: AniListEntry[] }[] } };
  };
  const lists = root.lists ?? root.data?.MediaListCollection?.lists ?? [];
  return lists.flatMap((list) => list.entries ?? []);
}

export function parseAniListJson(rawJson: string): WatchlistImportPreview {
  const entries: ExternalWatchlistEntry[] = [];
  let skipped = 0;
  const parsed = JSON.parse(rawJson) as unknown;

  for (const item of collectAniListEntries(parsed)) {
    const malId = item.media?.idMal?.toString();
    const status = normalizeStatus("anilist", item.status);
    if (!malId || !status) {
      skipped += 1;
      continue;
    }

    entries.push({
      malId,
      status,
      title: item.media?.title?.english ?? item.media?.title?.romaji ?? item.media?.title?.native,
      type: item.media?.format ?? undefined,
      episodes: toPositiveNumber(item.media?.episodes),
      note: item.notes ?? undefined,
    });
  }

  return summarize("anilist", entries, skipped);
}

export function buildAniListExport(watchlist: Record<string, WatchedAnime>) {
  return Object.values(watchlist).map((entry) => ({
    mediaIdMal: Number(entry.id),
    status:
      ANILIST_EXPORT_STATUS_MAP[entry.status.trim().toLowerCase()] ?? "PLANNING",
    notes: entry.note ?? "",
  }));
}
