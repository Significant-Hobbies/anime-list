import type { WatchedAnime } from './types/watchlist';

type ExternalWatchStatus = 'Watching' | 'Completed' | 'Deferred' | 'Avoiding' | 'BRR';

export interface ExternalWatchlistEntry {
  malId: string;
  status: ExternalWatchStatus;
  title?: string;
  type?: string;
  episodes?: number;
  note?: string;
}

type WatchlistImportSource = 'mal' | 'anilist' | 'shelf';
export type WatchlistImportMode = 'merge' | 'replace' | 'skip';

interface WatchlistImportConflict {
  malId: string;
  title?: string;
  incomingStatus: ExternalWatchStatus;
  existingStatus: string;
}

export interface WatchlistImportPreview {
  source: WatchlistImportSource;
  entries: ExternalWatchlistEntry[];
  statusCounts: Record<string, number>;
  skipped: number;
  conflicts: WatchlistImportConflict[];
  newCount: number;
}

export type WatchlistImportParseResult =
  | { ok: true; preview: WatchlistImportPreview }
  | { ok: false; error: string };

const MAL_STATUS_MAP: Record<string, ExternalWatchStatus> = {
  watching: 'Watching',
  completed: 'Completed',
  'on-hold': 'Deferred',
  dropped: 'Avoiding',
  'plan to watch': 'BRR',
  'plan-to-watch': 'BRR',
};

const ANILIST_STATUS_MAP: Record<string, ExternalWatchStatus> = {
  CURRENT: 'Watching',
  COMPLETED: 'Completed',
  PAUSED: 'Deferred',
  DROPPED: 'Avoiding',
  PLANNING: 'BRR',
  REPEATING: 'Watching',
};

const ANILIST_EXPORT_STATUS_MAP: Record<string, string> = {
  watching: 'CURRENT',
  completed: 'COMPLETED',
  done: 'COMPLETED',
  deferred: 'PAUSED',
  avoiding: 'DROPPED',
  brr: 'PLANNING',
};

function decodeXmlText(value: string) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function readXmlTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXmlText(match[1].trim()) : '';
}

function normalizeStatus(source: 'mal' | 'anilist', value: unknown): ExternalWatchStatus | null {
  if (typeof value !== 'string') return null;
  const key = source === 'mal' ? value.trim().toLowerCase() : value.trim().toUpperCase();
  return source === 'mal' ? (MAL_STATUS_MAP[key] ?? null) : (ANILIST_STATUS_MAP[key] ?? null);
}

function toPositiveNumber(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function summarize(
  source: WatchlistImportSource,
  entries: ExternalWatchlistEntry[],
  skipped: number,
  existing: Record<string, WatchedAnime> = {}
): WatchlistImportPreview {
  const statusCounts: Record<string, number> = {};
  const conflicts: WatchlistImportConflict[] = [];
  let newCount = 0;

  for (const entry of entries) {
    statusCounts[entry.status] = (statusCounts[entry.status] ?? 0) + 1;
    const current = existing[entry.malId];
    if (!current) {
      newCount += 1;
      continue;
    }
    if (current.status.trim().toLowerCase() !== entry.status.trim().toLowerCase()) {
      conflicts.push({
        malId: entry.malId,
        title: entry.title ?? current.title,
        incomingStatus: entry.status,
        existingStatus: current.status,
      });
    }
  }

  return { source, entries, statusCounts, skipped, conflicts, newCount };
}

export function parseShelfJson(rawJson: string): WatchlistImportPreview {
  const parsed = JSON.parse(rawJson) as {
    version?: number;
    anime?: Array<{
      mal_id?: string | number;
      id?: string | number;
      status?: string;
      title?: string;
      type?: string;
      episodes?: number;
      note?: string;
    }>;
  };

  const entries: ExternalWatchlistEntry[] = [];
  let skipped = 0;

  for (const row of parsed.anime ?? []) {
    const malId = (row.mal_id ?? row.id)?.toString();
    const statusRaw = (row.status ?? '').trim();
    if (!malId || !statusRaw) {
      skipped += 1;
      continue;
    }
    entries.push({
      malId,
      status: statusRaw as ExternalWatchStatus,
      title: row.title,
      type: row.type,
      episodes: toPositiveNumber(row.episodes),
      note: row.note,
    });
  }

  return summarize('shelf', entries, skipped);
}

function safeParseShelfJson(rawJson: string): WatchlistImportParseResult {
  try {
    return { ok: true, preview: parseShelfJson(rawJson) };
  } catch {
    return { ok: false, error: 'Invalid Shelf JSON backup' };
  }
}

export function buildShelfJsonExport(watchlist: Record<string, WatchedAnime>) {
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    anime: Object.values(watchlist).map((entry) => ({
      mal_id: entry.id,
      status: entry.status,
      title: entry.title ?? null,
      type: entry.type ?? null,
      episodes: entry.episodes ?? null,
      note: entry.note ?? null,
    })),
  };
}

export function buildShelfCsvExport(watchlist: Record<string, WatchedAnime>): string {
  const header = 'mal_id,title,status,type,episodes,note';
  const rows = Object.values(watchlist).map((entry) => {
    const cells = [
      entry.id,
      entry.title ?? '',
      entry.status,
      entry.type ?? '',
      entry.episodes?.toString() ?? '',
      entry.note ?? '',
    ].map((cell) => `"${String(cell).replaceAll('"', '""')}"`);
    return cells.join(',');
  });
  return [header, ...rows].join('\n');
}

function parseMalCsv(csv: string): WatchlistImportPreview {
  const lines = csv.trim().split(/\r?\n/);
  const entries: ExternalWatchlistEntry[] = [];
  let skipped = 0;

  for (const [index, line] of lines.entries()) {
    if (index === 0 && line.toLowerCase().includes('mal_id')) continue;
    if (!line.trim()) continue;

    const cells =
      line
        .match(/("([^"]|"")*"|[^,]+)/g)
        ?.map((cell) => cell.replace(/^"|"$/g, '').replaceAll('""', '"').trim()) ?? [];

    const [malId, title, statusRaw, type, episodesRaw, note] = cells;
    const status = normalizeStatus('mal', statusRaw ?? '');
    if (!malId || !status) {
      skipped += 1;
      continue;
    }

    entries.push({
      malId,
      status,
      title: title || undefined,
      type: type || undefined,
      episodes: toPositiveNumber(episodesRaw),
      note: note || undefined,
    });
  }

  return summarize('mal', entries, skipped);
}

export function withImportConflicts(
  preview: WatchlistImportPreview,
  existing: Record<string, WatchedAnime>
): WatchlistImportPreview {
  return summarize(preview.source, preview.entries, preview.skipped, existing);
}

export function applyImportMode(
  preview: WatchlistImportPreview,
  existing: Record<string, WatchedAnime>,
  mode: WatchlistImportMode
): ExternalWatchlistEntry[] {
  const conflictIds = new Set(preview.conflicts.map((row) => row.malId));
  if (mode === 'replace') return preview.entries;
  if (mode === 'skip') {
    return preview.entries.filter((entry) => !existing[entry.malId]);
  }
  return preview.entries.filter((entry) => !existing[entry.malId] || !conflictIds.has(entry.malId));
}

export function parseMalAnimeXml(xml: string): WatchlistImportPreview {
  const entries: ExternalWatchlistEntry[] = [];
  let skipped = 0;
  const blocks = xml.match(/<anime>[\s\S]*?<\/anime>/gi) ?? [];

  for (const block of blocks) {
    const malId = readXmlTag(block, 'series_animedb_id');
    const status = normalizeStatus('mal', readXmlTag(block, 'my_status'));
    if (!malId || !status) {
      skipped += 1;
      continue;
    }

    entries.push({
      malId,
      status,
      title: readXmlTag(block, 'series_title') || undefined,
      type: readXmlTag(block, 'series_type') || undefined,
      episodes: toPositiveNumber(readXmlTag(block, 'series_episodes')),
      note: readXmlTag(block, 'my_comments') || undefined,
    });
  }

  return summarize('mal', entries, skipped);
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
  if (!value || typeof value !== 'object') return [];
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
    const status = normalizeStatus('anilist', item.status);
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

  return summarize('anilist', entries, skipped);
}

export function safeParseAniListJson(rawJson: string): WatchlistImportParseResult {
  try {
    return { ok: true, preview: parseAniListJson(rawJson) };
  } catch {
    return { ok: false, error: 'Invalid AniList JSON payload' };
  }
}

export function buildAniListExport(watchlist: Record<string, WatchedAnime>) {
  return Object.values(watchlist).map((entry) => ({
    mediaIdMal: Number(entry.id),
    status: ANILIST_EXPORT_STATUS_MAP[entry.status.trim().toLowerCase()] ?? 'PLANNING',
    notes: entry.note ?? '',
  }));
}

export function parseImportPayload(
  source: WatchlistImportSource,
  payload: string
): WatchlistImportPreview | null {
  if (source === 'anilist') {
    const parsed = safeParseAniListJson(payload);
    return parsed.ok ? parsed.preview : null;
  }
  if (source === 'shelf') {
    const parsed = safeParseShelfJson(payload);
    return parsed.ok ? parsed.preview : null;
  }
  if (payload.trim().startsWith('<')) {
    return parseMalAnimeXml(payload);
  }
  return parseMalCsv(payload);
}
