import { gzipSync } from 'node:zlib';
import { getDb } from '../db/client';
import { bucketSize, projectionModel, serializePage } from '../assistant/discoveryPages';
import { readProjection } from '../assistant/discoveryCatalog';
import type { Media } from '../assistant/discoverySchemas';

// Reuse the exact live projection and guard each write against intervening changes.
export async function prepareDiscoveryPages(media: Media) {
  const db = getDb();
  const pending = await db.execute({
    sql: 'SELECT bucket,generation FROM assistant_discovery_pages WHERE media=? AND model IS NOT ? ORDER BY bucket',
    args: [media, projectionModel],
  });
  for (let i = 0; i < pending.rows.length; ) {
    const start = i,
      first = Number(pending.rows[i++].bucket);
    while (i < pending.rows.length && Number(pending.rows[i].bucket) < first + 32) i++;
    const last = Number(pending.rows[i - 1].bucket);
    const rows = await readProjection(media, first * bucketSize, (last + 1) * bucketSize - 1);
    const grouped = new Map<number, Record<string, unknown>[]>();
    for (const row of rows) {
      const id = Math.floor(Number(row.mal_id) / bucketSize);
      const bucket = grouped.get(id) ?? [];
      bucket.push(row);
      grouped.set(id, bucket);
    }
    await db.batch(
      pending.rows.slice(start, i).map((r) => ({
        sql: 'UPDATE assistant_discovery_pages SET payload=?,model=? WHERE media=? AND bucket=? AND generation=?',
        args: [
          gzipSync(serializePage(grouped.get(Number(r.bucket)) ?? [])).toString('base64'),
          projectionModel,
          media,
          Number(r.bucket),
          Number(r.generation),
        ],
      }))
    );
  }
  return pending.rows.length;
}
