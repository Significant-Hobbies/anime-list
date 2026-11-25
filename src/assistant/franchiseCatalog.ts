import { getDb } from '../db/client';
import { refreshTitle, refreshManga } from './franchiseProvider';

function walk(seed: string) {
  return `WITH RECURSIVE members(id) AS (
    ${seed}
    UNION SELECT e.target_id FROM members m JOIN assistant_franchise_member_edges e ON e.source_id=m.id
    UNION SELECT e.source_id FROM members m JOIN assistant_franchise_member_edges e ON e.target_id=m.id
  )`;
}
const franchise = walk('SELECT ?');
export const franchiseMembersSql = franchise + ' SELECT id FROM members';

/** The traversal follows directed provider sequel edges through completed intermediates. */
export async function sequelRows(
  userId: string,
  media: 'anime' | 'manga',
  seed?: number,
  refresh = true
) {
  const librarySeeds = `SELECT DISTINCT CAST(mal_id AS INTEGER) FROM assistant_library
    WHERE user_id=? AND media='${media}' AND status IN ('Done','Watching')`;
  const source = seed === undefined ? librarySeeds : 'SELECT ?';
  const anime = media === 'anime';
  const edgeView = anime ? 'assistant_sequel_edges' : 'assistant_manga_sequel_edges';
  const relationRecords = anime ? 'anime_relations_cache' : 'assistant_manga_details';
  const observed = anime ? 'fetched_at' : 'updated_at';
  const args = [seed ?? userId];
  const db = getDb();
  const chain = `WITH RECURSIVE seeds(id) AS (${source}), paths(origin,id) AS (
    SELECT seeds.id,e.later FROM seeds JOIN ${edgeView} e ON e.earlier=seeds.id
    UNION SELECT paths.origin,e.later FROM paths JOIN ${edgeView} e ON e.earlier=paths.id
  ), members(id) AS (SELECT DISTINCT id FROM paths WHERE id<>origin)`;
  if (refresh) {
    const pending = await db.execute({
      sql:
        chain +
        ` SELECT n.id FROM (SELECT id FROM seeds UNION SELECT id FROM members) n
        LEFT JOIN ${relationRecords} c ON c.mal_id=n.id
        LEFT JOIN ${anime ? 'assistant_provider_attempts' : 'assistant_manga_attempts'} p ON p.mal_id=n.id
        LEFT JOIN ${media}_data a ON a.mal_id=n.id
        LEFT JOIN assistant_${media}_details d ON d.mal_id=n.id
        WHERE (COALESCE(c.${observed},'')<? OR (a.mal_id IS NULL AND d.mal_id IS NULL))
          AND COALESCE(p.attempted_at,'')<?
        ORDER BY c.${observed} IS NOT NULL,n.id LIMIT 3`,
      args: [
        ...args,
        new Date(Date.now() - 7 * 86400000).toISOString(),
        new Date(Date.now() - 5 * 60000).toISOString(),
      ],
    });
    await Promise.allSettled(
      pending.rows.map((row) => (anime ? refreshTitle : refreshManga)(Number(row.id)))
    );
  }
  const [items, coverage] = await db.batch(
    [
      {
        sql:
          chain +
          ` SELECT m.id,'${media}' AS media,
        (SELECT json_group_array(origin) FROM (SELECT DISTINCT origin FROM paths WHERE paths.id=m.id AND origin<>m.id ORDER BY origin)) AS origin_ids,
        COALESCE(d.title,a.title,(SELECT target_title FROM assistant_all_relations r WHERE r.target_type='${media}' AND r.target_id=m.id LIMIT 1)) AS title,
        COALESCE(d.format,a.type) AS format,COALESCE(d.status,a.status) AS status,
        COALESCE(d.${anime ? 'aired_from' : 'published_from'},a.${anime ? 'aired_from' : 'published_from'}) AS start,
        ${anime ? 'COALESCE(d.episodes,a.episodes) AS episodes' : 'COALESCE(d.chapters,a.chapters) AS chapters,COALESCE(d.volumes,a.volumes) AS volumes'},
        COALESCE(d.updated_at,a.updated_at) AS metadata_at
        FROM members m LEFT JOIN assistant_${media}_details d ON d.mal_id=m.id
        LEFT JOIN ${media}_data a ON a.mal_id=m.id WHERE NOT EXISTS (SELECT 1 FROM assistant_library l
      WHERE l.user_id=? AND l.media='${media}' AND l.status='Done' AND l.mal_id=CAST(m.id AS TEXT))
      ORDER BY start IS NULL,start,m.id`,
        args: [...args, userId],
      },
      {
        sql:
          chain +
          ` SELECT COUNT(*) AS total, COUNT(c.${observed}) AS known, MIN(c.${observed}) AS oldest
      FROM (SELECT id FROM seeds UNION SELECT id FROM members) all_ids
      LEFT JOIN ${relationRecords} c ON c.mal_id=all_ids.id`,
        args,
      },
    ],
    'read'
  );
  return { items: items.rows, coverage: coverage.rows[0] };
}

/** Refresh popular origins plus unscored related titles independently of the scored catalog filter. */
export async function refreshFranchiseIndex(limit = 12, includeCatalog = false) {
  const db = getDb();
  const queue = await db.execute({
    sql:
      walk('SELECT mal_id FROM assistant_franchise_monitors') +
      `
    , candidates(media,id,priority) AS (
      SELECT 'anime',id,0 FROM members
      UNION ALL SELECT 'anime',CAST(mal_id AS INTEGER),1 FROM anime_watchlist
      UNION ALL SELECT 'manga',CAST(mal_id AS INTEGER),1 FROM manga_watchlist
      UNION ALL SELECT target_type,target_id,2 FROM assistant_media_membership
      ${includeCatalog ? "UNION ALL SELECT 'anime',mal_id,3 FROM anime_data UNION ALL SELECT 'manga',mal_id,3 FROM manga_data" : ''})
    SELECT k.media,k.id FROM candidates k
      LEFT JOIN assistant_anime_details d ON k.media='anime' AND d.mal_id=k.id
      LEFT JOIN assistant_manga_details m ON k.media='manga' AND m.mal_id=k.id
      LEFT JOIN assistant_manga_attempts pm ON k.media='manga' AND pm.mal_id=k.id
      LEFT JOIN assistant_provider_attempts p ON k.media='anime' AND p.mal_id=k.id
      WHERE COALESCE(d.updated_at,m.updated_at,'') < ? AND COALESCE(p.attempted_at,pm.attempted_at,'') < ?
      GROUP BY k.media,k.id ORDER BY CASE WHEN MIN(priority)=0 THEN 0 WHEN COALESCE(d.updated_at,m.updated_at) IS NULL THEN 1 ELSE 2 END,
      MIN(priority),COALESCE(p.attempted_at,pm.attempted_at,''),k.media,k.id LIMIT ?`,
    args: [
      new Date(Date.now() - 86400000).toISOString(),
      new Date(Date.now() - 3600000).toISOString(),
      Math.min(24, Math.max(1, limit)),
    ],
  });
  let refreshed = 0;
  for (const { id, media } of queue.rows) {
    try {
      await (media === 'anime' ? refreshTitle : refreshManga)(Number(id));
      refreshed++;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'rate_limited') break;
    }
  }
  return { selected: queue.rows.length, refreshed };
}

export async function releaseChanges(userId: string, afterId: number, limit: number) {
  // Walk separately from every subscription so overlapping franchises use the earliest subscription date.
  return (
    await getDb().execute({
      sql: `WITH RECURSIVE tracked(id,since) AS (
    SELECT mal_id,created_at FROM assistant_franchise_monitors WHERE user_id=?
    UNION SELECT e.target_id,t.since FROM tracked t JOIN assistant_franchise_member_edges e ON e.source_id=t.id
    UNION SELECT e.source_id,t.since FROM tracked t JOIN assistant_franchise_member_edges e ON e.target_id=t.id)
    SELECT e.*,d.title FROM assistant_release_events e JOIN assistant_anime_details d ON d.mal_id=e.mal_id
      WHERE e.id>? AND EXISTS(SELECT 1 FROM tracked t WHERE t.id=e.mal_id AND e.observed_at>=t.since)
      ORDER BY e.id LIMIT ?`,
      args: [userId, afterId, limit],
    })
  ).rows;
}
