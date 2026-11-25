import type { DatabaseClient, DatabaseStatement } from '../db/client';
import {
  attemptStatement,
  franchiseSnapshotStatements,
  type FranchiseMedia,
} from '../assistant/franchiseProvider';

const tracked = `WITH RECURSIVE origins(media,id) AS (
  SELECT 'anime',CAST(mal_id AS INTEGER) FROM anime_watchlist
  UNION SELECT 'manga',CAST(mal_id AS INTEGER) FROM manga_watchlist
  UNION SELECT 'anime',mal_id FROM assistant_franchise_monitors
), members(media,id) AS (
  SELECT media,id FROM origins
  UNION SELECT e.target_type,e.target_id FROM members m JOIN assistant_media_membership e ON m.media=e.source_type AND m.id=e.source_id
  UNION SELECT e.source_type,e.source_id FROM members m JOIN assistant_media_membership e ON m.media=e.target_type AND m.id=e.target_id
), coverage AS (
  SELECT m.media,m.id,o.id IS NOT NULL AS origin,
    COALESCE(d.updated_at,b.updated_at) AS indexed_at, COALESCE(pa.attempted_at,pm.attempted_at) AS attempted_at
  FROM members m LEFT JOIN origins o ON o.media=m.media AND o.id=m.id
  LEFT JOIN assistant_anime_details d ON m.media='anime' AND d.mal_id=m.id
  LEFT JOIN assistant_manga_details b ON m.media='manga' AND b.mal_id=m.id
  LEFT JOIN assistant_provider_attempts pa ON m.media='anime' AND pa.mal_id=m.id
  LEFT JOIN assistant_manga_attempts pm ON m.media='manga' AND pm.mal_id=m.id
)`;
const retryWindow = () => new Date(Date.now() - 3600000).toISOString();

async function coverage(db: DatabaseClient) {
  return (
    await db.execute({
      sql:
        tracked +
        ` SELECT media,CASE WHEN origin THEN 'tracked_origin' ELSE 'related' END AS scope,
    COUNT(*) AS known,COUNT(indexed_at) AS indexed,
    SUM(indexed_at IS NULL AND COALESCE(attempted_at,'')>=?) AS deferred,
    SUM(indexed_at IS NULL AND COALESCE(attempted_at,'')<?) AS pending
    FROM coverage GROUP BY media,origin ORDER BY media,origin DESC`,
      args: [retryWindow(), retryWindow()],
    })
  ).rows;
}

type Provider = { full(media: FranchiseMedia, id: number): Promise<unknown> };
export async function bootstrapTrackedFranchises(
  db: DatabaseClient,
  reader: Provider,
  maxTitles: number,
  log: (line: string) => void = console.log
) {
  if (!Number.isSafeInteger(maxTitles) || maxTitles < 1 || maxTitles > 20000)
    throw new Error('Expected max titles between 1 and 20000.');
  let fetched = 0,
    providerMissing = 0;
  log(JSON.stringify({ before: await coverage(db) }));
  while (fetched + providerMissing < maxTitles) {
    const limit = Math.min(24, maxTitles - fetched - providerMissing);
    const targets = (
      await db.execute({
        sql:
          tracked +
          ` SELECT media,id FROM coverage
      WHERE indexed_at IS NULL AND COALESCE(attempted_at,'')<? ORDER BY origin DESC,media,id LIMIT ?`,
        args: [retryWindow(), limit],
      })
    ).rows;
    if (!targets.length) break;
    const statements: DatabaseStatement[] = [];
    try {
      for (const row of targets) {
        const media = row.media as FranchiseMedia,
          id = Number(row.id),
          at = new Date().toISOString();
        const payload = await reader.full(media, id);
        if (payload === null) {
          providerMissing++;
          statements.push(attemptStatement(media, id, at));
          continue;
        }
        const snapshot = franchiseSnapshotStatements(media, id, at, payload);
        statements.push(attemptStatement(media, id, at), ...snapshot);
        fetched++;
      }
    } finally {
      // A title's snapshot and all of its normalized relationships stay in one transaction.
      // A batch has at most 24 titles x 4 statements, including an observed release change.
      if (statements.length) await db.batch(statements, 'write');
    }
    log(JSON.stringify({ fetched, provider_missing: providerMissing }));
  }
  const result = { fetched, provider_missing: providerMissing, coverage: await coverage(db) };
  log(JSON.stringify(result));
  return result;
}
