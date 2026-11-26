import { getDb, type DatabaseClient } from '../db/client';
import { retrievalModel } from './discoveryEmbedding';
import type { Media } from './discoverySchemas';

export const projectionModel = retrievalModel.model + ':pages-v1';
export const bucketSize = 128;
type Row = Record<string, unknown>;
type Bucket = [id: number, generation: number, ready: number];
const caches = new WeakMap<DatabaseClient, Map<string, string>>();
// Only compressed public candidate data is retained. Account state stays request-local.
const memoryLimit = 8 * 1024 * 1024;
const sizes = new WeakMap<Map<string, string>, number>();
function remember(cache: Map<string, string>, key: string, payload: string) {
  let size = (sizes.get(cache) ?? 0) + payload.length - (cache.get(key)?.length ?? 0);
  cache.set(key, payload);
  while (size > memoryLimit || cache.size > 2500) {
    const oldest = cache.keys().next().value!;
    size -= cache.get(oldest)!.length;
    cache.delete(oldest);
  }
  sizes.set(cache, size);
}
export function serializePage(rows: Row[]): string {
  const fields = Object.keys(rows[0] ?? {});
  return JSON.stringify([fields, rows.map((r) => fields.map((f) => r[f]))]);
}
async function unpack(payload: string): Promise<Row[]> {
  const raw = atob(payload);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const [fields, values] = (await new Response(stream).json()) as [string[], unknown[][]];
  return values.map((v) => Object.fromEntries(fields.map((f, i) => [f, v[i]])));
}
async function* storedPages(media: Media, buckets: Bucket[], dirty: number[]) {
  const db = getDb(),
    cache = caches.get(db) ?? new Map<string, string>();
  caches.set(db, cache);
  for (let start = 0; start < buckets.length; start += 256) {
    const group = buckets.slice(start, start + 256);
    const keys = new Map(group.map(([id, gen]) => [id, media + ':' + id + ':' + gen]));
    const local = new Map<number, string>();
    const missing: number[] = [];
    for (const [id, key] of keys) {
      const hit = cache.get(key);
      if (hit) local.set(id, hit);
      else missing.push(id);
    }
    if (missing.length) {
      const result = await db.execute({
        sql: 'SELECT bucket,generation,payload FROM assistant_discovery_pages WHERE media=? AND model=? AND bucket IN (SELECT value FROM json_each(?))',
        args: [media, projectionModel, JSON.stringify(missing)],
      });
      for (const r of result.rows) {
        const id = Number(r.bucket),
          data = String(r.payload);
        local.set(id, data);
        remember(cache, media + ':' + id + ':' + r.generation, data);
      }
    }
    for (let i = 0; i < group.length; i += 16) {
      const pages = await Promise.all(
        group.slice(i, i + 16).map(async ([id]) => {
          const payload = local.get(id);
          if (payload) return unpack(payload);
          // Invalidated between reading the manifest and requesting its payload.
          dirty.push(id);
          return [];
        })
      );
      yield pages.flat();
    }
  }
}
export async function* preparedPages(
  media: Media,
  ids: number[] | null,
  readDirty: (buckets: number[]) => AsyncGenerator<Row[]>
) {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT json_group_array(json_array(bucket,generation,model IS ?)) AS manifest FROM assistant_discovery_pages WHERE media=?',
    args: [projectionModel, media],
  });
  const manifest = JSON.parse(String(result.rows[0].manifest)) as Bucket[];
  const eligible = ids ? new Set(ids) : null;
  const wanted = ids ? new Set(ids.map((id) => Math.floor(id / bucketSize))) : null;
  const ready: Bucket[] = [],
    dirty: number[] = [];
  for (const item of manifest) {
    if (wanted && !wanted.has(item[0])) continue;
    if (item[2]) ready.push(item);
    else dirty.push(item[0]);
  }
  const selected = (rows: Row[]) =>
    eligible ? rows.filter((r) => eligible.has(Number(r.mal_id))) : rows;
  for await (const page of storedPages(media, ready, dirty)) yield selected(page);
  if (dirty.length) for await (const page of readDirty(dirty)) yield selected(page);
}
