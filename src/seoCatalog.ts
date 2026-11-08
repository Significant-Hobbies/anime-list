import index from './data/seo-index.json';
import type { SeoEntry, SeoKind } from './seoRewrite';

const ORIGIN = 'https://anime.significanthobbies.com';
const MAX_CACHED_SHARDS = 8;
const MAX_ASSET_BYTES = 512 * 1024;
type AssetReader = Pick<Fetcher, 'fetch'>;
type Title = { id: number; title: string };
type Shard = { path: string; sha256: string; count: number; bytes: number };
type ShardData = Map<number, SeoEntry>;

type SeoAssetIndex = {
  version: number;
  shardSize: number;
  collections: Record<SeoKind, { titles: Title[]; shards: Shard[] }>;
};

function locateTitles(manifest: SeoAssetIndex) {
  const locations = new Map<string, { shard: Shard; titles: Title[] }>();
  for (const kind of ['anime', 'manga'] as const) {
    const collection = manifest.collections[kind];
    for (let start = 0; start < collection.titles.length; start += manifest.shardSize) {
      const titles = collection.titles.slice(start, start + manifest.shardSize);
      const shard = collection.shards[start / manifest.shardSize];
      for (const title of titles) locations.set(`${kind}/${title.id}`, { shard, titles });
    }
  }
  return locations;
}

function validMetrics(entry: SeoEntry) {
  return (
    [entry.score, entry.scoredBy, entry.episodes, entry.chapters, entry.volumes].every(
      (value) =>
        value == null || (typeof value === 'number' && Number.isFinite(value) && value >= 0)
    ) &&
    [entry.image, entry.status, entry.titleEnglish].every(
      (value) => value == null || typeof value === 'string'
    )
  );
}

async function boundedBytes(response: Response, expected: number): Promise<Uint8Array> {
  // The binding may expose a decoded body alongside encoded Content-Length.
  // Bound and hash the actual stream rather than trusting transport lengths.
  if (!response.body) throw new Error('Missing public catalog asset body');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > expected || size > MAX_ASSET_BYTES) {
      await reader.cancel();
      throw new Error('Public catalog asset exceeds its bound');
    }
    chunks.push(value);
  }
  if (size !== expected) throw new Error('Invalid public catalog asset size');
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function validEntry(value: unknown): value is SeoEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as SeoEntry;
  return (
    Number.isSafeInteger(entry.id) &&
    entry.id > 0 &&
    typeof entry.title === 'string' &&
    typeof entry.synopsis === 'string' &&
    entry.synopsis.length >= 160 &&
    entry.synopsis.length <= 1200 &&
    typeof entry.type === 'string' &&
    Number.isInteger(entry.year) &&
    Array.isArray(entry.genres) &&
    entry.genres.every((genre) => typeof genre === 'string') &&
    validMetrics(entry)
  );
}

async function readShard(
  kind: SeoKind,
  shard: Shard,
  titles: Title[],
  assets: AssetReader
): Promise<ShardData> {
  // ASSETS fetches static deployment content directly; it does not recurse into
  // Pages Functions. Never forward incoming cookies, authorization or query.
  const response = await assets.fetch(
    new Request(new URL(shard.path, ORIGIN), { redirect: 'manual' })
  );
  if (
    response.status !== 200 ||
    response.redirected ||
    !response.headers.get('content-type')?.includes('application/json')
  )
    throw new Error('Public catalog asset unavailable');
  const bytes = await boundedBytes(response, shard.bytes);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  if (hex !== shard.sha256) throw new Error('Invalid public catalog asset hash');
  const document = JSON.parse(new TextDecoder().decode(bytes));
  if (
    document.version !== 1 ||
    document.kind !== kind ||
    !Array.isArray(document.entries) ||
    document.entries.length !== shard.count ||
    document.entries.length !== titles.length
  )
    throw new Error('Invalid public catalog asset envelope');
  const rows: ShardData = new Map();
  for (let i = 0; i < titles.length; i++) {
    const entry = document.entries[i];
    if (!validEntry(entry) || entry.id !== titles[i].id || entry.title !== titles[i].title)
      throw new Error('Invalid public catalog asset identity');
    rows.set(entry.id, entry);
  }
  return rows;
}

export function createSeoCatalog(manifest: SeoAssetIndex = index) {
  const locations = locateTitles(manifest);
  const cache = new Map<string, Promise<ShardData>>();
  return async (kind: SeoKind, id: number, assets: AssetReader): Promise<SeoEntry | null> => {
    const location = locations.get(`${kind}/${id}`);
    if (!location) return null; // Unknown IDs never make an asset or network request.
    const { shard, titles } = location;
    let pending = cache.get(shard.path);
    if (pending) cache.delete(shard.path);
    else {
      pending = readShard(kind, shard, titles, assets).catch((error) => {
        if (cache.get(shard.path) === pending) cache.delete(shard.path);
        throw error;
      });
    }
    cache.set(shard.path, pending);
    if (cache.size > MAX_CACHED_SHARDS) cache.delete(cache.keys().next().value!);
    const rows = await pending;
    return rows.get(id)!;
  };
}

const getEntry = createSeoCatalog();
export const getAnimeEntry = (id: number, assets: AssetReader) => getEntry('anime', id, assets);
export const getMangaEntry = (id: number, assets: AssetReader) => getEntry('manga', id, assets);
