import { z } from 'zod';
import { API_CONFIG } from '../config';
import { getDb } from '../db/client';
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

export async function refreshTitle(id: number) {
  const db = getDb();
  const at = new Date().toISOString();
  await db.execute({
    sql: 'INSERT INTO assistant_provider_attempts VALUES (?,?) ON CONFLICT(mal_id) DO UPDATE SET attempted_at=excluded.attempted_at',
    args: [id, at],
  });
  const { data } = await readProvider('/anime/' + id + '/full', z.object({ data: full }));
  if (data.mal_id !== id)
    throw new AssistantError(
      'upstream_unavailable',
      'The catalog returned a different identifier.'
    );
  const relations = data.relations.map((group) => ({
    relation: group.relation,
    entries: group.entry,
  }));
  const services = data.streaming.filter((s) => /^https?:\/\//i.test(s.url));
  await db.batch(
    [
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
    ],
    'write'
  );
}

export async function readSeason(year: number, season: string, page: number) {
  return readProvider('/seasons/' + year + '/' + season + '?page=' + page, seasonPage);
}

export async function refreshManga(id: number) {
  const db = getDb(),
    at = new Date().toISOString();
  await db.execute({
    sql: 'INSERT INTO assistant_manga_attempts VALUES(?,?) ON CONFLICT(mal_id) DO UPDATE SET attempted_at=excluded.attempted_at',
    args: [id, at],
  });
  const { data } = await readProvider('/manga/' + id + '/full', z.object({ data: manga }));
  if (data.mal_id !== id)
    throw new AssistantError(
      'upstream_unavailable',
      'The catalog returned a different manga identifier.'
    );
  // A single D1 batch replaces the provider snapshot and edges atomically.
  await db.batch(
    [
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
        sql: 'DELETE FROM assistant_manga_edges WHERE source_id=? AND EXISTS(SELECT 1 FROM assistant_manga_details WHERE mal_id=? AND updated_at=?)',
        args: [id, id, at],
      },
      {
        sql: `INSERT OR IGNORE INTO assistant_manga_edges(source_id,relation,target_type,target_id,target_title)
       SELECT ?,LOWER(TRIM(g.value ->> '$.relation')),e.value ->> '$.type',e.value ->> '$.mal_id',e.value ->> '$.name'
       FROM json_each(?) g,json_each(g.value,'$.entry') e
       WHERE (e.value ->> '$.type') IN ('anime','manga') AND EXISTS (SELECT 1 FROM assistant_manga_details WHERE mal_id=? AND updated_at=?)`,
        args: [id, JSON.stringify(data.relations), id, at],
      },
    ],
    'write'
  );
}
