import { providerNames } from '../db/catalogTitleMetadata';
import type { DatabaseClient, DatabaseStatement } from '../db/client';
import type { createMetadataReader, Media, ProviderTitle } from './catalogMetadataProvider';

type Reader = ReturnType<typeof createMetadataReader>;
const DIRECT_LOOKUP_THRESHOLD = 300;
const D1_BATCH = 500;
const PAGE_SELECT = 5000;

async function readMissing(db: DatabaseClient, media: Media) {
  const missing = new Set<number>();
  let cursor = 0;
  for (;;) {
    const { rows } = await db.execute({
      sql: `SELECT c.mal_id FROM ${media}_data c WHERE c.mal_id>? AND NOT EXISTS(
        SELECT 1 FROM catalog_title_metadata m WHERE m.media=? AND m.mal_id=c.mal_id)
        ORDER BY c.mal_id LIMIT ?`,
      args: [cursor, media, PAGE_SELECT],
    });
    for (const row of rows) missing.add(Number(row.mal_id));
    if (rows.length < PAGE_SELECT) return missing;
    cursor = Number(rows[rows.length - 1].mal_id);
  }
}

// Seek into an ID-sorted provider catalog on restart. Individual detail lookups at the end
// reconcile gaps caused by source insertions or deletions while pages were in flight.
async function seek(reader: Reader, media: Media, minId: number) {
  const first = await reader.page(media, 1);
  if (!first.data.length || first.data[first.data.length - 1].mal_id >= minId) return first;
  let low = 2,
    high = first.pagination.last_visible_page;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const probe = await reader.page(media, mid);
    if (probe.data.length && probe.data[probe.data.length - 1].mal_id < minId) low = mid + 1;
    else high = mid;
  }
  return reader.page(media, low);
}

async function scanPages(
  reader: Reader,
  media: Media,
  missing: Set<number>,
  accept: (row: ProviderTitle) => Promise<void>
) {
  const minId = missing.values().next().value;
  if (minId === undefined) return;
  let current = await seek(reader, media, minId);
  for (;;) {
    for (const row of current.data) if (missing.has(row.mal_id)) await accept(row);
    if (!current.pagination.has_next_page || !missing.size) return;
    current = await reader.page(media, current.pagination.current_page + 1);
  }
}

const coverage = async (db: DatabaseClient, media: Media) => {
  const { rows } = await db.execute({
    sql: `SELECT
    COUNT(*) AS catalog, COUNT(m.mal_id) AS with_metadata,
    COALESCE(SUM(json_array_length(m.aliases)>0),0) AS with_aliases,
    COALESCE(SUM(json_array_length(m.studios)>0),0) AS with_studios
    FROM ${media}_data c LEFT JOIN catalog_title_metadata m ON m.media=? AND m.mal_id=c.mal_id`,
    args: [media],
  });
  return rows[0];
};

function insertMetadata(media: Media, row: ProviderTitle): DatabaseStatement {
  const { aliases, studios } = providerNames({
    ...row,
    title_synonyms: row.title_synonyms ?? [],
    title_japanese: row.title_japanese ?? undefined,
  });
  return {
    sql: `INSERT INTO catalog_title_metadata(media,mal_id,aliases,studios)
    SELECT ?,c.mal_id,?,? FROM ${media}_data c WHERE c.mal_id=?
    ON CONFLICT(media,mal_id) DO NOTHING`,
    args: [media, JSON.stringify(aliases ?? []), JSON.stringify(studios ?? []), row.mal_id],
  };
}

export async function backfillCatalogMetadata(
  db: DatabaseClient,
  reader: Reader,
  media: Media,
  log: (message: string) => void = console.log
) {
  const missing = await readMissing(db, media);
  const initial = missing.size;
  let pending: DatabaseStatement[] = [];
  const flush = async () => {
    if (!pending.length) return;
    await db.batch(pending, 'write');
    pending = [];
    log(`${media}: processed ${initial - missing.size} of ${initial} missing metadata rows`);
  };
  const accept = async (row: ProviderTitle) => {
    pending.push(insertMetadata(media, row));
    missing.delete(row.mal_id);
    if (pending.length === D1_BATCH) await flush();
  };
  const notFound: number[] = [];
  try {
    if (missing.size > DIRECT_LOOKUP_THRESHOLD) await scanPages(reader, media, missing, accept);
    for (const id of missing) {
      const row = await reader.detail(media, id);
      if (row) await accept(row);
      else notFound.push(id);
    }
  } finally {
    await flush();
  }
  const result = {
    media,
    ...(await coverage(db, media)),
    initial_missing: initial,
    source_matches: initial - missing.size,
    source_not_found: notFound.length,
    source_not_found_ids: notFound,
  };
  log(JSON.stringify(result));
  return result;
}
