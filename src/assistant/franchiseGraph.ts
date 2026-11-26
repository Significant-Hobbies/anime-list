import { getDb } from '../db/client';
import { refreshPublicTitle } from './franchiseProvider';
import { AssistantError } from './tool';

const graph = `WITH RECURSIVE members(media,id) AS (
 SELECT ?,?
 UNION SELECT e.target_type,e.target_id FROM members m JOIN assistant_media_membership e ON e.source_id=m.id AND e.source_type=m.media
 UNION SELECT e.source_type,e.source_id FROM members m JOIN assistant_media_membership e ON e.target_id=m.id AND e.target_type=m.media
)`;
export const mediaFranchiseMembersSql = graph + ' SELECT media,id FROM members';
type Media = 'anime' | 'manga';
async function read(media: Media, id: number) {
  const args = [media, id];
  const [members, edges] = await getDb().batch(
    [
      {
        sql:
          graph +
          ` SELECT m.id,m.media, COALESCE(d.title,b.title,a.title,g.title,
       (SELECT target_title FROM assistant_all_relations e WHERE e.target_type=m.media AND e.target_id=m.id ORDER BY source_type,source_id LIMIT 1)) AS title,
       COALESCE(d.format,b.format,a.type,g.type) AS format, COALESCE(d.status,b.status,a.status,g.status) AS status,
       COALESCE(d.aired_from,b.published_from,a.aired_from,g.published_from) AS start,
       COALESCE(d.episodes,a.episodes) AS episodes,COALESCE(b.chapters,g.chapters) AS chapters,COALESCE(b.volumes,g.volumes) AS volumes,
       COALESCE(d.synopsis,b.synopsis,a.synopsis,g.synopsis) AS synopsis,
       COALESCE(c.fetched_at,b.updated_at) AS relations_at,COALESCE(d.updated_at,b.updated_at,a.updated_at,g.updated_at) AS metadata_at,
       COALESCE(pa.attempted_at,pm.attempted_at) AS attempted_at
       FROM members m
       LEFT JOIN anime_data a ON m.media='anime' AND a.mal_id=m.id
       LEFT JOIN manga_data g ON m.media='manga' AND g.mal_id=m.id
       LEFT JOIN assistant_anime_details d ON m.media='anime' AND d.mal_id=m.id
       LEFT JOIN assistant_manga_details b ON m.media='manga' AND b.mal_id=m.id
       LEFT JOIN anime_relations_cache c ON m.media='anime' AND c.mal_id=m.id
       LEFT JOIN assistant_provider_attempts pa ON m.media='anime' AND pa.mal_id=m.id
       LEFT JOIN assistant_manga_attempts pm ON m.media='manga' AND pm.mal_id=m.id
       ORDER BY start IS NULL,start,m.media,m.id`,
        args,
      },
      {
        sql:
          graph +
          ` SELECT e.* FROM members m JOIN assistant_all_relations e ON e.source_id=m.id AND e.source_type=m.media
      ORDER BY e.source_type,e.source_id,e.relation,e.target_type,e.target_id`,
        args,
      },
    ],
    'read'
  );
  return { members: members.rows, edges: edges.rows };
}
export async function completeGraph(media: Media, id: number) {
  let result = await read(media, id);
  const now = Date.now();
  const staleBefore = new Date(now - 7 * 86400000).toISOString();
  const retryBefore = new Date(now - 5 * 60000).toISOString();
  const pending = result.members.filter(
    (r) =>
      (!r.relations_at || String(r.relations_at) < staleBefore) &&
      (!r.attempted_at || String(r.attempted_at) < retryBefore)
  );
  // Missing sources ahead of stale records; stable ID order within each priority.
  pending.sort(
    (a, b) =>
      Number(Boolean(a.relations_at)) - Number(Boolean(b.relations_at)) ||
      Number(a.id) - Number(b.id)
  );
  if (pending.length) {
    const updates = await Promise.allSettled(
      pending.slice(0, 3).map((row) => refreshPublicTitle(row.media as Media, Number(row.id)))
    );
    if (
      !result.members[0]?.title &&
      result.members.length === 1 &&
      updates[0]?.status === 'rejected'
    )
      throw updates[0].reason;
    result = await read(media, id);
  }
  if (!result.members.some((row) => row.title || row.relations_at))
    throw new AssistantError('upstream_unavailable', 'Franchise membership could not be verified.');
  return result;
}
