import { getDb, type DatabaseValue } from '../db/client';
import { mediaFranchiseMembersSql } from './franchiseGraph';
import { publicCatalogPages } from './discoveryCache';
import { tableFor } from './discoveryState';
import type { Filters, Media } from './discoverySchemas';

export const keyFor = (media: Media, id: number) => `${media}:${id}`;
export const fold = (value: string) => value.trim().toLowerCase();
export const optionalString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value : null;
export const optionalNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;
function parse(value: unknown) {
  if (!value || typeof value !== 'string') return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}
export function labels(value: unknown): string[] {
  const data = parse(value);
  if (!data || typeof data !== 'object') return [];
  return Array.isArray(data)
    ? data.filter((v): v is string => typeof v === 'string')
    : Object.keys(data);
}
export function mediaList(choice: Media | 'both'): Media[] {
  return choice === 'both' ? ['anime', 'manga'] : [choice];
}

export async function accountSignals(userId: string) {
  const [library, prior, dismissals] = await getDb().batch([
    {
      sql: 'SELECT media,mal_id,status,rating,tags FROM assistant_library WHERE user_id=? ORDER BY updated_at DESC,media,mal_id',
      args: [userId],
    },
    {
      sql: 'SELECT media_type,mal_id,signal FROM assistant_recommendation_feedback WHERE user_id=? ORDER BY updated_at DESC,media_type,mal_id',
      args: [userId],
    },
    { sql: 'SELECT mal_id FROM anime_dismissals WHERE user_id=?', args: [userId] },
  ]);
  return {
    library: new Map(
      library.rows.map((row) => [
        keyFor(row.media as Media, Number(row.mal_id)),
        {
          status: String(row.status),
          rating: optionalNumber(row.rating),
          tags: labels(row.tags),
        },
      ])
    ),
    feedback: new Map(
      prior.rows.map((row) => [
        keyFor(row.media_type as Media, Number(row.mal_id)),
        String(row.signal),
      ])
    ),
    dismissed: new Set(dismissals.rows.map((row) => keyFor('anime', Number(row.mal_id)))),
  };
}
export type Account = Awaited<ReturnType<typeof accountSignals>>;
export type Entry = { status: string; rating: number | null; tags: string[] };

const bounds = [
  ['score', 'min_score', 'max_score'],
  ['year', 'min_year', 'max_year'],
  ['popularity', 'min_popularity', 'max_popularity'],
  ['members', 'min_members', 'max_members'],
] as const;

function applyNumericAndFormat(
  media: Media,
  filters: Filters,
  add: (condition: string, ...values: DatabaseValue[]) => void
) {
  for (const [field, min, max] of bounds) {
    if (filters[min] !== undefined) add(`c.${field}>=?`, filters[min]);
    if (filters[max] !== undefined) add(`c.${field}<=?`, filters[max]);
  }
  if (filters.year !== undefined) add('c.year=?', filters.year);
  for (const [key, comparison] of [
    ['min_episodes', '>='],
    ['max_episodes', '<='],
    ['min_chapters', '>='],
    ['max_chapters', '<='],
  ] as const) {
    if (filters[key] === undefined) continue;
    const column = key.endsWith('episodes') ? 'episodes' : 'chapters';
    if ((media === 'anime') !== (column === 'episodes')) add('0');
    else add(`c.${column}${comparison}?`, filters[key]);
  }
  if (filters.format) add('c.type=? COLLATE NOCASE', filters.format);
  if (filters.airing_status) add('c.status=? COLLATE NOCASE', filters.airing_status);
}

function constraints(media: Media, filters: Filters) {
  const sql: string[] = [];
  const args: DatabaseValue[] = [];
  function add(condition: string, ...values: DatabaseValue[]) {
    sql.push(condition);
    args.push(...values);
  }
  applyNumericAndFormat(media, filters, add);
  if (filters.franchise_id) {
    add(
      `c.mal_id IN (SELECT id FROM (${mediaFranchiseMembersSql}) WHERE media=?)`,
      filters.franchise_media_type ?? 'anime',
      filters.franchise_id,
      media
    );
  }
  if (filters.studio) {
    const studio = 'EXISTS (SELECT 1 FROM json_each(cm.studios) WHERE value=? COLLATE NOCASE)';
    if (media === 'anime')
      add(
        `(${studio} OR EXISTS (SELECT 1 FROM json_each(d.studios) WHERE value=? COLLATE NOCASE))`,
        filters.studio,
        filters.studio
      );
    else add(studio, filters.studio);
  }
  if (filters.title) {
    add(
      `(instr(lower(c.title),lower(?))>0 OR instr(lower(c.title_english),lower(?))>0
      OR EXISTS (SELECT 1 FROM json_each(d.aliases) WHERE instr(lower(value),lower(?))>0)
      OR EXISTS (SELECT 1 FROM json_each(cm.aliases) WHERE instr(lower(value),lower(?))>0))`,
      ...Array(4).fill(filters.title)
    );
  }
  return { sql: sql.length ? sql.join(' AND ') : '1', args };
}

function selectFields(media: Media, details: boolean) {
  const isAnime = media === 'anime';
  return `SELECT c.mal_id,c.title,c.title_english,c.score,c.year,c.type,c.status,c.popularity,c.members,c.genres,c.themes,c.demographics,cm.aliases AS catalog_aliases,cm.studios AS catalog_studios,
    ${isAnime ? 'c.episodes,NULL AS chapters,d.aliases,d.studios' : 'NULL AS episodes,c.chapters,d.aliases,NULL AS studios'} ,
    ${isAnime ? 'NULL AS languages,NULL AS english' : 'c.available_languages AS languages,c.available_in_english AS english'}
    ${details ? ',c.url,c.image,c.synopsis' : ''}
    FROM ${tableFor(media)} c LEFT JOIN ${isAnime ? 'assistant_anime_details' : 'assistant_manga_details'} d ON d.mal_id=c.mal_id LEFT JOIN catalog_title_metadata cm ON cm.media='${media}' AND cm.mal_id=c.mal_id`;
}
function titleRow(media: Media, r: Record<string, unknown>) {
  const langs = labels(r.languages);
  if (r.english && !langs.some((x) => fold(x) === 'english')) langs.push('English');
  return {
    media_type: media,
    mal_id: Number(r.mal_id),
    title: String(r.title),
    title_english: optionalString(r.title_english),
    alternative_titles: [...new Set([...labels(r.aliases), ...labels(r.catalog_aliases)])],
    score: optionalNumber(r.score),
    year: optionalNumber(r.year),
    genres: labels(r.genres),
    themes: labels(r.themes),
    demographics: labels(r.demographics),
    episodes: optionalNumber(r.episodes),
    chapters: optionalNumber(r.chapters),
    airing_status: optionalString(r.status),
    format: optionalString(r.type),
    popularity: optionalNumber(r.popularity),
    members: optionalNumber(r.members),
    studios: [...new Set([...labels(r.studios), ...labels(r.catalog_studios)])],
    languages: langs,
    synopsis: optionalString(r.synopsis),
    image: optionalString(r.image),
    url: optionalString(r.url) ?? `https://myanimelist.net/${media}/${r.mal_id}`,
  };
}
export type Title = ReturnType<typeof titleRow>;
export async function* candidatePages(media: Media, filters: Filters, revision: number) {
  const condition = constraints(media, filters);
  async function* read() {
    let last = 0;
    const batchSize = 1800;
    while (true) {
      const result = await getDb().execute({
        sql: `${selectFields(media, false)} WHERE c.mal_id>? AND ${condition.sql} ORDER BY c.mal_id LIMIT ?`,
        args: [last, ...condition.args, batchSize],
      });
      if (result.rows.length) yield result.rows;
      if (result.rows.length < batchSize) break;
      last = Number(result.rows.at(-1)?.mal_id);
    }
  }
  for await (const rows of publicCatalogPages(JSON.stringify([media, condition]), revision, read)) {
    yield rows.map((r) => titleRow(media, r));
  }
}
export async function detailsFor(media: Media, ids: number[]) {
  if (!ids.length) return [];
  const rows = await getDb().execute({
    sql: `${selectFields(media, true)} WHERE c.mal_id IN (SELECT value FROM json_each(?))`,
    args: [JSON.stringify(ids)],
  });
  return rows.rows.map((r) => titleRow(media, r));
}
export async function resolveName(name: string, choice: Media | 'both') {
  const candidates: Title[] = [];
  for (const media of mediaList(choice)) {
    const condition = constraints(media, { title: name });
    const alias =
      ' OR EXISTS (SELECT 1 FROM json_each(d.aliases) WHERE value=? COLLATE NOCASE) OR EXISTS (SELECT 1 FROM json_each(cm.aliases) WHERE value=? COLLATE NOCASE)';
    const args = [name, name, name, name];
    const results = await getDb().execute({
      sql: `${selectFields(media, true)} WHERE ${condition.sql} ORDER BY
      (c.title=? COLLATE NOCASE OR coalesce(c.title_english,'')=? COLLATE NOCASE${alias}) DESC, c.members DESC,c.mal_id LIMIT 1`,
      args: [...condition.args, ...args],
    });
    if (results.rows[0]) candidates.push(titleRow(media, results.rows[0]));
  }
  const isExact = (row: Title) =>
    [row.title, row.title_english, ...row.alternative_titles].some(
      (t) => t && fold(t) === fold(name)
    );
  return candidates.sort(
    (a, b) => Number(isExact(b)) - Number(isExact(a)) || (b.members ?? 0) - (a.members ?? 0)
  )[0];
}

// Resolve only the returned page. Namespaces and IDs match get_franchise;
// an isolated node has no known franchise. More imported edges can extend it.
export async function franchiseLabels(page: { media: Media; id: number }[]) {
  if (!page.length)
    return new Map<
      string,
      { franchise_id: string; media_type: Media; mal_id: number; title: string | null }
    >();
  const rows = await getDb().execute({
    sql: `WITH RECURSIVE connected(origin,media,id) AS (
    SELECT value->>'$.media'||':'||(value->>'$.id'),value->>'$.media',value->>'$.id' FROM json_each(?)
    UNION SELECT n.origin,e.target_type,e.target_id FROM connected n JOIN assistant_media_membership e ON e.source_type=n.media AND e.source_id=n.id
    UNION SELECT n.origin,e.source_type,e.source_id FROM connected n JOIN assistant_media_membership e ON e.target_type=n.media AND e.target_id=n.id
  ), roots AS (SELECT origin, min(media||':'||id) AS root FROM connected GROUP BY origin HAVING count(*)>1)
  SELECT roots.origin,roots.root,n.media,n.id,coalesce(a.title,m.title) AS title FROM roots JOIN connected n ON n.origin=roots.origin AND n.media||':'||n.id=roots.root
  LEFT JOIN anime_data a ON n.media='anime' AND a.mal_id=n.id
  LEFT JOIN manga_data m ON n.media='manga' AND m.mal_id=n.id`,
    args: [JSON.stringify(page.map(({ media, id }) => ({ media, id })))],
  });
  return new Map(
    rows.rows.map((r) => [
      String(r.origin),
      {
        franchise_id: String(r.root),
        media_type: r.media as Media,
        mal_id: Number(r.id),
        title: optionalString(r.title),
      },
    ])
  );
}
