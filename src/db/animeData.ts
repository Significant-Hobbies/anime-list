import { getDb } from './client';
import type { AnimeItem } from '../types/anime';
import { AnimeField, FilterAction } from '../config';
import type { Filter, NumericField } from '../types/anime';

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
    anime.title_english || null,
    anime.type || null,
    anime.episodes || null,
    anime.aired?.from || null,
    anime.aired?.to || null,
    anime.score || null,
    anime.scored_by || null,
    anime.rank || null,
    anime.status || null,
    anime.popularity || null,
    anime.members || null,
    anime.favorites || null,
    anime.synopsis || null,
    anime.year || null,
    anime.season || null,
    anime.image || null,
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
  const malIds = animeList.map((a) => a.mal_id);
  const placeholders = malIds.map(() => '?').join(',');
  const result = await db.execute({
    sql: `SELECT mal_id, title, title_english, created_at, updated_at
          FROM anime_data WHERE mal_id IN (${placeholders})`,
    args: malIds,
  });

  const summary: UpsertSummary = { added: [], updated: [] };
  for (const row of result.rows) {
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

export async function getSimpleAnimeSearchPage({
  filters,
  sortBy,
  pagesize,
  offset,
}: {
  filters: Filter[];
  sortBy?: NumericField;
  pagesize: number;
  offset: number;
}): Promise<{ totalFiltered: number; page: Array<AnimeItem & { points: number }> } | null> {
  if (!sortBy) return null;

  const sortColumn = NUMERIC_COLUMN_BY_FIELD[sortBy];
  if (!sortColumn) return null;

  const whereParts: string[] = [];
  const args: Array<string | number> = [];

  for (const filter of filters) {
    const column = NUMERIC_COLUMN_BY_FIELD[filter.field as NumericField];
    const operator = SQL_OPERATOR_BY_ACTION[filter.action];
    if (!column || !operator || typeof filter.value !== 'number' || filter.score_multiplier) {
      return null;
    }

    whereParts.push(`${column} ${operator} ?`);
    args.push(filter.value);
  }

  const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
  const db = getDb();
  const [countResult, pageResult] = await Promise.all([
    db.execute({
      sql: `SELECT COUNT(*) AS count FROM anime_data ${whereClause}`,
      args,
    }),
    db.execute({
      sql: `SELECT * FROM anime_data ${whereClause}
            ORDER BY ${sortColumn} DESC, mal_id ASC
            LIMIT ? OFFSET ?`,
      args: [...args, pagesize, offset],
    }),
  ]);

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
