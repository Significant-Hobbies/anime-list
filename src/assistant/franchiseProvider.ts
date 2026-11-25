import { z } from 'zod';
import { API_CONFIG } from '../config';
import { getDb, type DatabaseStatement } from '../db/client';
import { AssistantError } from './tool';

const nullText = z
  .string()
  .nullish()
  .transform((v) => v ?? null);
const nullInteger = z
  .number()
  .int()
  .nullish()
  .transform((v) => v ?? null);
const streamingSchema = z.object({ name: z.string(), url: z.url() });
const named = z.object({ name: z.string() });
const anime = z.object({
  mal_id: z.number().int().positive(),
  title: z.string(),
  title_english: nullText,
  titles: z.array(z.object({ title: z.string() })).default([]),
  studios: z.array(named).default([]),
  status: nullText,
  season: nullText,
  aired: z
    .object({
      from: nullText,
      to: z
        .string()
        .nullish()
        .transform((v) => v ?? null),
    })
    .nullish()
    .transform((v) => v ?? null),
  year: nullInteger,
  type: nullText,
  episodes: nullInteger,
  synopsis: nullText,
  streaming: z.array(streamingSchema).default([]),
});
const relationGroups = z.array(
  z.object({
    relation: z.string(),
    entry: z.array(
      z.object({
        mal_id: z.number().int().positive(),
        type: z.string(),
        name: z.string(),
        url: z.string(),
      })
    ),
  })
);
const full = anime.extend({ relations: relationGroups });
const manga = z.object({
  mal_id: z.number().int().positive(),
  title: z.string(),
  title_english: nullText,
  titles: z.array(z.object({ title: z.string() })).default([]),
  status: nullText,
  published: z.object({ from: nullText }).nullish(),
  synopsis: nullText,
  type: nullText,
  chapters: nullInteger,
  volumes: nullInteger,
  relations: relationGroups,
});
const seasonPage = z.object({
  data: z.array(anime),
  pagination: z.object({
    current_page: z.number().int(),
    last_visible_page: z.number().int(),
    has_next_page: z.boolean(),
  }),
});

async function readProvider<T>(path: string, schema: z.ZodType<T>) {
  try {
    const response = await fetch(API_CONFIG.baseUrl + path, { signal: AbortSignal.timeout(4500) });
    if (response.status === 404)
      throw new AssistantError('not_found', 'The provider has no record for this identifier.');
    if (response.status === 429)
      throw new AssistantError(
        'rate_limited',
        'The catalog provider is rate limited. Retry later.'
      );
    if (!response.ok) throw new Error('Provider request failed');
    return schema.parse(await response.json());
  } catch (error) {
    if (error instanceof AssistantError) throw error;
    throw new AssistantError(
      'upstream_unavailable',
      'The catalog provider could not supply a valid response.'
    );
  }
}

type FullAnime = z.infer<typeof full>;
type FullManga = z.infer<typeof manga>;

function animeStatements(id: number, at: string, data: FullAnime): DatabaseStatement[] {
  if (data.mal_id !== id)
    throw new AssistantError(
      'upstream_unavailable',
      'The catalog returned a different identifier.'
    );
  const relations = data.relations.map((group) => ({
    relation: group.relation,
    entries: group.entry,
  }));
  const services = data.streaming.filter((s) =>
    ['http:', 'https:'].includes(new URL(s.url).protocol)
  );
  return [
    {
      sql: `INSERT INTO assistant_release_events(mal_id,observed_at,previous_status,status,previous_start,scheduled_start)
          SELECT ?,?,d.status,?,d.aired_from,? FROM assistant_anime_details d
          WHERE d.mal_id=? AND d.updated_at<=? AND (d.status IS NOT ? OR d.aired_from IS NOT ?)`,
      args: [
        id,
        at,
        data.status,
        data.aired?.from ?? null,
        id,
        at,
        data.status,
        data.aired?.from ?? null,
      ],
    },
    {
      sql: `INSERT INTO assistant_anime_details
      (mal_id,title,title_english,aliases,studios,status,aired_from,aired_to,season,year,format,episodes,synopsis,streaming,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(mal_id) DO UPDATE SET
      title=excluded.title,title_english=excluded.title_english,aliases=excluded.aliases,studios=excluded.studios,
      status=excluded.status,aired_from=excluded.aired_from,aired_to=excluded.aired_to,season=excluded.season,
      year=excluded.year,format=excluded.format,episodes=excluded.episodes,synopsis=excluded.synopsis,
      streaming=excluded.streaming,updated_at=excluded.updated_at
      WHERE excluded.updated_at >= assistant_anime_details.updated_at`,
      args: [
        id,
        data.title,
        data.title_english,
        JSON.stringify(data.titles.map((t) => t.title)),
        JSON.stringify(data.studios.map((v) => v.name)),
        data.status,
        data.aired?.from ?? null,
        data.aired?.to ?? null,
        data.season,
        data.year,
        data.type,
        data.episodes,
        data.synopsis,
        JSON.stringify(services),
        at,
      ],
    },
    {
      sql: `INSERT INTO anime_relations_cache(mal_id,payload,fetched_at) VALUES(?,?,?)
      ON CONFLICT(mal_id) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at
      WHERE excluded.fetched_at >= anime_relations_cache.fetched_at`,
      args: [id, JSON.stringify(relations), at],
    },
  ];
}

export async function readSeason(year: number, season: string, page: number) {
  return readProvider('/seasons/' + year + '/' + season + '?page=' + page, seasonPage);
}

function mangaStatements(id: number, at: string, data: FullManga): DatabaseStatement[] {
  if (data.mal_id !== id)
    throw new AssistantError(
      'upstream_unavailable',
      'The catalog returned a different manga identifier.'
    );
  const relations = JSON.stringify(data.relations);
  const incoming = `WITH incoming(relation,target_type,target_id,target_title) AS (
    SELECT LOWER(TRIM(g.value ->> '$.relation')),e.value ->> '$.type',e.value ->> '$.mal_id',e.value ->> '$.name'
    FROM json_each(?) g,json_each(g.value,'$.entry') e WHERE (e.value ->> '$.type') IN ('anime','manga'))`;
  const current = 'EXISTS(SELECT 1 FROM assistant_manga_details WHERE mal_id=? AND updated_at=?)';
  return [
    {
      sql: `INSERT INTO assistant_manga_details(mal_id,title,title_english,aliases,status,published_from,synopsis,format,chapters,volumes,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(mal_id) DO UPDATE SET title=excluded.title,title_english=excluded.title_english,
        aliases=excluded.aliases,status=excluded.status,published_from=excluded.published_from,synopsis=excluded.synopsis,format=excluded.format,
        chapters=excluded.chapters,volumes=excluded.volumes,updated_at=excluded.updated_at WHERE excluded.updated_at>=assistant_manga_details.updated_at`,
      args: [
        id,
        data.title,
        data.title_english,
        JSON.stringify(data.titles.map((t) => t.title)),
        data.status,
        data.published?.from ?? null,
        data.synopsis,
        data.type,
        data.chapters,
        data.volumes,
        at,
      ],
    },
    {
      sql:
        incoming +
        ` DELETE FROM assistant_manga_edges WHERE source_id=? AND ${current}
        AND (relation,target_type,target_id) NOT IN (SELECT relation,target_type,target_id FROM incoming)`,
      args: [relations, id, id, at],
    },
    {
      sql:
        incoming +
        ` INSERT INTO assistant_manga_edges(source_id,relation,target_type,target_id,target_title)
       SELECT ?,relation,target_type,target_id,target_title FROM incoming WHERE ${current}
       ON CONFLICT(source_id,relation,target_type,target_id) DO UPDATE SET target_title=excluded.target_title
       WHERE assistant_manga_edges.target_title IS NOT excluded.target_title`,
      args: [relations, id, id, at],
    },
  ];
}

export type FranchiseMedia = 'anime' | 'manga';
export function attemptStatement(media: FranchiseMedia, id: number, at: string): DatabaseStatement {
  const table = media === 'anime' ? 'assistant_provider_attempts' : 'assistant_manga_attempts';
  return {
    sql: `INSERT INTO ${table}(mal_id,attempted_at) VALUES(?,?) ON CONFLICT(mal_id) DO UPDATE SET attempted_at=MAX(excluded.attempted_at,attempted_at)`,
    args: [id, at],
  };
}
export function franchiseSnapshotStatements(
  media: FranchiseMedia,
  id: number,
  at: string,
  payload: unknown
): DatabaseStatement[] {
  if (media === 'anime')
    return animeStatements(id, at, z.object({ data: full }).parse(payload).data);
  return mangaStatements(id, at, z.object({ data: manga }).parse(payload).data);
}
// The claim and both limits are evaluated by the same SQLite write. Competing
// Worker isolates cannot race a prior SELECT and dispatch duplicate upstream reads.
async function claimPublicAttempt(media: FranchiseMedia, id: number, now: Date) {
  const table = media === 'anime' ? 'assistant_provider_attempts' : 'assistant_manga_attempts';
  const at = now.getTime();
  const lastMinute = new Date(at - 60000).toISOString();
  const claimed = await getDb().execute({
    sql: `WITH recent(t) AS (
        SELECT attempted_at FROM assistant_provider_attempts WHERE attempted_at>?
        UNION ALL SELECT attempted_at FROM assistant_manga_attempts WHERE attempted_at>?
      ) INSERT INTO ${table}(mal_id,attempted_at)
      SELECT ?,? FROM (SELECT COUNT(*) per_minute,COUNT(CASE WHEN t>? THEN 1 END) per_second FROM recent)
      WHERE per_minute<90 AND per_second<3
      ON CONFLICT(mal_id) DO UPDATE SET attempted_at=excluded.attempted_at
      WHERE attempted_at<? RETURNING mal_id`,
    args: [
      lastMinute,
      lastMinute,
      id,
      now.toISOString(),
      new Date(at - 1000).toISOString(),
      new Date(at - 300000).toISOString(),
    ],
  });
  if (!claimed.rows.length)
    throw new AssistantError(
      'rate_limited',
      'Catalog source refresh is cooling down. Retry later.'
    );
}
async function refresh(media: FranchiseMedia, id: number, publicRead = false) {
  const db = getDb();
  const now = new Date();
  const at = now.toISOString();
  if (publicRead) await claimPublicAttempt(media, id, now);
  else await db.execute(attemptStatement(media, id, at));
  const payload = await readProvider('/' + media + '/' + id + '/full', z.unknown());
  const statements = franchiseSnapshotStatements(media, id, at, payload);
  await db.batch(statements, 'write');
}
export const refreshTitle = (id: number) => refresh('anime', id);
export const refreshManga = (id: number) => refresh('manga', id);

export const refreshPublicTitle = (media: FranchiseMedia, id: number) => refresh(media, id, true);
