import { getDb } from './client';
import type { AnimeItem } from '../types/anime';
import { AnimeField, FilterAction } from '../config';
import type { ArrayField, Filter, NumericField, StringField } from '../types/anime';

const mapAnimeRow = (row: Record<string, unknown>): AnimeItem => ({
  mal_id: row.mal_id as number,
  url: row.url as string,
  title: row.title as string,
  title_english: (row.title_english as string) || undefined,
  type: (row.type as string) || undefined,
  episodes: (row.episodes as number) || undefined,
  aired: row.aired_from
    ? {
        from: row.aired_from as string,
        to: (row.aired_to as string) || '',
      }
    : undefined,
  score: (row.score as number) || undefined,
  scored_by: (row.scored_by as number) || undefined,
  rank: (row.rank as number) || undefined,
  status: (row.status as string) || undefined,
  popularity: (row.popularity as number) || undefined,
  members: (row.members as number) || undefined,
  favorites: (row.favorites as number) || undefined,
  synopsis: (row.synopsis as string) || undefined,
  year: (row.year as number) || undefined,
  season: (row.season as string) || undefined,
  image: (row.image as string) || undefined,
  genres: JSON.parse((row.genres as string) || '{}'),
  themes: JSON.parse((row.themes as string) || '{}'),
  demographics: JSON.parse((row.demographics as string) || '{}'),
});

export interface UpsertSummary {
  added: { mal_id: number; title: string }[];
  updated: { mal_id: number; title: string }[];
}

const UPSERT_BATCH_SIZE = 100;

const nullable = (v: unknown) => v || null;

const buildAnimeUpsertStatement = (anime: AnimeItem) => ({
  sql: `
    INSERT INTO anime_data (
      mal_id, url, title, title_english, type, episodes,
      aired_from, aired_to, score, scored_by, rank, status,
      popularity, members, favorites, synopsis, year, season,
      image, genres, themes, demographics, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(mal_id) DO UPDATE SET
      url = excluded.url,
      title = excluded.title,
      title_english = excluded.title_english,
      type = excluded.type,
      episodes = excluded.episodes,
      aired_from = excluded.aired_from,
      aired_to = excluded.aired_to,
      score = excluded.score,
      scored_by = excluded.scored_by,
      rank = excluded.rank,
      status = excluded.status,
      popularity = excluded.popularity,
      members = excluded.members,
      favorites = excluded.favorites,
      synopsis = excluded.synopsis,
      year = excluded.year,
      season = excluded.season,
      image = excluded.image,
      genres = excluded.genres,
      themes = excluded.themes,
      demographics = excluded.demographics,
      updated_at = datetime('now')
  `,
  args: [
    anime.mal_id,
    anime.url,
    anime.title,
    nullable(anime.title_english),
    nullable(anime.type),
    nullable(anime.episodes),
    nullable(anime.aired?.from),
    nullable(anime.aired?.to),
    nullable(anime.score),
    nullable(anime.scored_by),
    nullable(anime.rank),
    nullable(anime.status),
    nullable(anime.popularity),
    nullable(anime.members),
    nullable(anime.favorites),
    nullable(anime.synopsis),
    nullable(anime.year),
    nullable(anime.season),
    nullable(anime.image),
    JSON.stringify(anime.genres),
    JSON.stringify(anime.themes),
    JSON.stringify(anime.demographics),
  ],
});

async function writeAnimeBatches(animeList: AnimeItem[]): Promise<void> {
  const db = getDb();

  for (let i = 0; i < animeList.length; i += UPSERT_BATCH_SIZE) {
    const batch = animeList.slice(i, i + UPSERT_BATCH_SIZE);
    const statements = batch.map(buildAnimeUpsertStatement);
    await db.batch(statements, 'write');
  }
}

export async function upsertAnimeBatchNoSummary(animeList: AnimeItem[]): Promise<void> {
  await writeAnimeBatches(animeList);
  console.log(`Upserted ${animeList.length} anime`);
}

/**
 * Bulk insert/update anime (more efficient for large batches)
 * Uses created_at column to distinguish new inserts from updates:
 * - INSERT sets both created_at and updated_at to now
 * - ON CONFLICT only updates updated_at, leaving created_at unchanged
 * After batch, rows where created_at == updated_at are newly added.
 */
export async function upsertAnimeBatch(animeList: AnimeItem[]): Promise<UpsertSummary> {
  const db = getDb();
  await writeAnimeBatches(animeList);

  // Query which of the upserted rows were new inserts vs updates
  const rows: Record<string, unknown>[] = [];
  const malIds = animeList.map((a) => a.mal_id);
  for (let offset = 0; offset < malIds.length; offset += 100) {
    const chunk = malIds.slice(offset, offset + 100);
    const placeholders = chunk.map(() => '?').join(',');
    const result = await db.execute({
      sql: `SELECT mal_id, title, title_english, created_at, updated_at
            FROM anime_data WHERE mal_id IN (${placeholders})`,
      args: chunk,
    });
    rows.push(...result.rows);
  }

  const summary: UpsertSummary = { added: [], updated: [] };
  for (const row of rows) {
    const entry = {
      mal_id: row.mal_id as number,
      title: (row.title_english as string) || (row.title as string),
    };
    if (row.created_at === row.updated_at) {
      summary.added.push(entry);
    } else {
      summary.updated.push(entry);
    }
  }

  console.log(
    `Upserted ${animeList.length} anime (${summary.added.length} new, ${summary.updated.length} updated)`
  );
  return summary;
}

/**
 * Get all anime from database
 */
export async function getAllAnime(): Promise<AnimeItem[]> {
  const db = getDb();
  const result = await db.execute('SELECT * FROM anime_data');

  return result.rows.map((row) => mapAnimeRow(row as unknown as Record<string, unknown>));
}

const NUMERIC_COLUMN_BY_FIELD: Record<NumericField, string> = {
  [AnimeField.Score]: 'score',
  [AnimeField.ScoredBy]: 'scored_by',
  [AnimeField.Rank]: 'rank',
  [AnimeField.Popularity]: 'popularity',
  [AnimeField.Members]: 'members',
  [AnimeField.Favorites]: 'favorites',
  [AnimeField.Year]: 'year',
  [AnimeField.Episodes]: 'episodes',
};

const SQL_OPERATOR_BY_ACTION: Partial<Record<FilterAction, string>> = {
  [FilterAction.Equals]: '=',
  [FilterAction.GreaterThan]: '>',
  [FilterAction.GreaterThanOrEquals]: '>=',
  [FilterAction.LessThan]: '<',
  [FilterAction.LessThanOrEquals]: '<=',
};

const STRING_COLUMN_BY_FIELD: Partial<Record<StringField, string>> = {
  [AnimeField.Title]: 'title',
  [AnimeField.TitleEnglish]: 'title_english',
  [AnimeField.Type]: 'type',
  [AnimeField.Season]: 'season',
  [AnimeField.Synopsis]: 'synopsis',
};

const ARRAY_COLUMN_BY_FIELD: Record<ArrayField, string> = {
  [AnimeField.Genres]: 'genres',
  [AnimeField.Themes]: 'themes',
  [AnimeField.Demographics]: 'demographics',
};

type SearchWhere = { whereClause: string; args: Array<string | number> };
type ClauseResult = { clause: string; args: Array<string | number> } | null;
const SKIP: ClauseResult = null;

function stringValues(value: Filter['value']): string[] | null {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value;
  return null;
}

const contains = (column: string) => `instr(lower(${column}), lower(?)) > 0`;
const doesNotContain = (column: string) => `instr(lower(${column}), lower(?)) = 0`;

function buildStringFilterClause(
  filter: Filter,
  stringColumn: string,
  values: string[]
): ClauseResult {
  if (filter.action === FilterAction.Equals && values.length === 1) {
    return { clause: `${stringColumn} IS NOT NULL AND ${stringColumn} = ?`, args: [values[0]] };
  }
  if (
    filter.field === AnimeField.Title &&
    filter.action === FilterAction.Contains &&
    values.length === 1
  ) {
    return {
      clause: `(${contains('title')} OR ${contains("COALESCE(title_english, '')")})`,
      args: [values[0], values[0]],
    };
  }
  if (filter.action === FilterAction.Contains && values.length === 1) {
    return {
      clause: `${stringColumn} IS NOT NULL AND ${contains(stringColumn)}`,
      args: [values[0]],
    };
  }
  if (filter.action === FilterAction.IncludesAll && values.length > 0) {
    return {
      clause: `${stringColumn} IS NOT NULL AND (${values.map(() => contains(stringColumn)).join(' AND ')})`,
      args: values,
    };
  }
  if (filter.action === FilterAction.IncludesAny) {
    if (values.length === 0) return SKIP;
    return {
      clause: `${stringColumn} IS NOT NULL AND (${values.map(() => contains(stringColumn)).join(' OR ')})`,
      args: values,
    };
  }
  if (filter.action === FilterAction.Excludes) {
    if (values.length === 0) return SKIP;
    return {
      clause: `${stringColumn} IS NOT NULL AND (${values.map(() => doesNotContain(stringColumn)).join(' AND ')})`,
      args: values,
    };
  }
  return null;
}

function buildArrayFilterClause(
  filter: Filter,
  arrayColumn: string,
  values: string[]
): ClauseResult {
  if (values.length === 0) return SKIP;
  const jsonSource = `json_each(COALESCE(${arrayColumn}, '{}'))`;
  const placeholders = values.map(() => '?').join(', ');

  if (filter.action === FilterAction.IncludesAll) {
    return {
      clause: values
        .map(
          () => `EXISTS (SELECT 1 FROM ${jsonSource} WHERE json_each.key = ? AND json_each.value)`
        )
        .join(' AND '),
      args: values,
    };
  }
  if (filter.action === FilterAction.IncludesAny) {
    return {
      clause: `EXISTS (SELECT 1 FROM ${jsonSource} WHERE json_each.key IN (${placeholders}) AND json_each.value)`,
      args: values,
    };
  }
  if (filter.action === FilterAction.Excludes) {
    return {
      clause: `NOT EXISTS (SELECT 1 FROM ${jsonSource} WHERE json_each.key IN (${placeholders}) AND json_each.value)`,
      args: values,
    };
  }
  return null;
}

function processFilter(filter: Filter): ClauseResult {
  if (filter.score_multiplier) return null;

  const numericColumn = NUMERIC_COLUMN_BY_FIELD[filter.field as NumericField];
  const numericOperator = SQL_OPERATOR_BY_ACTION[filter.action];
  if (numericColumn && numericOperator && typeof filter.value === 'number') {
    return { clause: `${numericColumn} ${numericOperator} ?`, args: [filter.value] };
  }

  const stringColumn = STRING_COLUMN_BY_FIELD[filter.field as StringField];
  if (stringColumn) {
    const values = stringValues(filter.value);
    if (!values) return null;
    return buildStringFilterClause(filter, stringColumn, values);
  }

  const arrayColumn = ARRAY_COLUMN_BY_FIELD[filter.field as ArrayField];
  if (arrayColumn) {
    const values = stringValues(filter.value);
    if (!values) return null;
    return buildArrayFilterClause(filter, arrayColumn, values);
  }

  return null;
}

function appendAiringFilter(airing: 'yes' | 'no' | 'any', whereParts: string[]): void {
  if (airing === 'yes') {
    whereParts.push("lower(status) = 'currently airing'");
  } else if (airing === 'no') {
    whereParts.push("(status IS NULL OR lower(status) <> 'currently airing')");
  }
}

export function buildAnimeSearchWhere(
  filters: Filter[],
  airing: 'yes' | 'no' | 'any'
): SearchWhere | null {
  const whereParts: string[] = [];
  const args: Array<string | number> = [];

  for (const filter of filters) {
    const result = processFilter(filter);
    if (result === null) return null;
    if (result === SKIP) continue;
    whereParts.push(result.clause);
    args.push(...result.args);
  }

  appendAiringFilter(airing, whereParts);

  return {
    whereClause: whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '',
    args,
  };
}

export async function getSimpleAnimeSearchPage({
  filters,
  sortBy,
  airing,
  pagesize,
  offset,
}: {
  filters: Filter[];
  sortBy?: NumericField;
  airing: 'yes' | 'no' | 'any';
  pagesize: number;
  offset: number;
}): Promise<{ totalFiltered: number; page: Array<AnimeItem & { points: number }> } | null> {
  if (!sortBy) return null;

  const sortColumn = NUMERIC_COLUMN_BY_FIELD[sortBy];
  if (!sortColumn) return null;

  const searchWhere = buildAnimeSearchWhere(filters, airing);
  if (!searchWhere) return null;
  const { whereClause, args } = searchWhere;
  const db = getDb();
  // D1 batch sends both optimized statements in one binding call. A window
  // count looks simpler, but forces SQLite to materialize and sort the full
  // filtered set before LIMIT; on this catalog it is measurably slower.
  const [countResult, pageResult] = await db.batch(
    [
      {
        sql: `SELECT COUNT(*) AS count FROM anime_data ${whereClause}`,
        args,
      },
      {
        sql: `SELECT * FROM anime_data ${whereClause}
              ORDER BY ${sortColumn} DESC, mal_id ASC
              LIMIT ? OFFSET ?`,
        args: [...args, pagesize, offset],
      },
    ],
    'read'
  );

  return {
    totalFiltered: Number(countResult.rows[0]?.count ?? 0),
    page: pageResult.rows.map((row) => {
      const anime = mapAnimeRow(row as unknown as Record<string, unknown>);
      return {
        ...anime,
        points: (anime[sortBy] as number | undefined) ?? 0,
      };
    }),
  };
}

export async function getAnimeByMalId(malId: number): Promise<AnimeItem | null> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM anime_data WHERE mal_id = ? LIMIT 1',
    args: [malId],
  });

  if (result.rows.length === 0) {
    return null;
  }

  return mapAnimeRow(result.rows[0] as unknown as Record<string, unknown>);
}

/**
 * Get the most recent updated_at timestamp
 */
export async function getLastDataUpdate(): Promise<string | null> {
  const db = getDb();
  const result = await db.execute('SELECT MAX(updated_at) as last_updated FROM anime_data');
  return (result.rows[0]?.last_updated as string) || null;
}

/**
 * Get recently added/updated anime grouped by date
 */
export async function getRecentChanges(limit = 100): Promise<
  {
    date: string;
    title: string;
    title_english: string | null;
    type: string | null;
    mal_id: number;
  }[]
> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT mal_id, title, title_english, type, DATE(created_at) as update_date
          FROM anime_data
          ORDER BY created_at DESC
          LIMIT ?`,
    args: [limit],
  });
  return result.rows.map((row) => ({
    date: row.update_date as string,
    title: row.title as string,
    title_english: (row.title_english as string) || null,
    type: (row.type as string) || null,
    mal_id: row.mal_id as number,
  }));
}
