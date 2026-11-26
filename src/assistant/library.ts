import { getDb, type DatabaseValue } from '../db/client';
import { AssistantError } from './tool';
import type { Entry, EntryKey, Filters, Page } from './librarySchemas';

type Row = Record<string, unknown>;
function terms(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (Array.isArray(value)) return value.filter((item) => typeof item === 'string');
    return value && typeof value === 'object' ? Object.keys(value) : [];
  } catch {
    return [];
  }
}

export function asEntry(row: Row): Entry {
  return {
    media_type: row.media as Entry['media_type'],
    catalog_id: Number(row.mal_id),
    title: String(row.title),
    watch_status: String(row.status),
    legacy_status: String(row.legacy_status),
    personal_rating: row.rating as number | null,
    notes: row.notes as string | null,
    tags: terms(row.tags),
    created_at: row.created_at as string | null,
    updated_at: row.updated_at as string | null,
    completed_at: row.completed_at as string | null,
    catalog_score: row.catalog_score as number | null,
    year: row.year as number | null,
    genres: terms(row.genres),
    themes: terms(row.themes),
  };
}

export async function readLibraryEntry(userId: string, key: EntryKey) {
  const result = await getDb().execute({
    sql: 'SELECT * FROM assistant_library WHERE user_id=? AND media=? AND mal_id=?',
    args: [userId, key.media_type, String(key.catalog_id)],
  });
  return result.rows.length ? asEntry(result.rows[0]) : null;
}

function selection(userId: string, input: Filters) {
  const conditions = ['user_id=?'];
  const args: DatabaseValue[] = [userId];
  if (input.media_type) {
    conditions.push('media=?');
    args.push(input.media_type);
  }
  if (input.watch_statuses) {
    conditions.push('status COLLATE NOCASE IN (SELECT value FROM json_each(?))');
    args.push(JSON.stringify(input.watch_statuses));
  }
  if (input.min_personal_rating !== undefined) {
    conditions.push('rating>=?');
    args.push(input.min_personal_rating);
  }
  if (input.max_personal_rating !== undefined) {
    conditions.push('rating<=?');
    args.push(input.max_personal_rating);
  }
  if (
    input.min_personal_rating !== undefined &&
    input.max_personal_rating !== undefined &&
    input.min_personal_rating > input.max_personal_rating
  ) {
    throw new AssistantError(
      'invalid_argument',
      'Minimum rating must be at most the maximum rating.'
    );
  }
  if (input.tags) {
    conditions.push(
      'NOT EXISTS (SELECT 1 FROM json_each(?) wanted WHERE NOT EXISTS (SELECT 1 FROM json_each(tags) actual WHERE actual.value = wanted.value COLLATE NOCASE))'
    );
    args.push(JSON.stringify(input.tags));
  }
  return { from: 'FROM assistant_library WHERE ' + conditions.join(' AND '), args };
}

export async function readLibraryPage(userId: string, input: Page) {
  const { from, args } = selection(userId, input);
  const [count, data] = await getDb().batch(
    [
      { sql: 'SELECT COUNT(*) AS total ' + from, args },
      {
        sql:
          'SELECT * ' + from + ' ORDER BY media, CAST(mal_id AS INTEGER), mal_id LIMIT ? OFFSET ?',
        args: [...args, input.limit, input.offset],
      },
    ],
    'read'
  );
  const total = Number(count.rows[0].total);
  const items = data.rows.map(asEntry);
  const nextOffset = input.offset + items.length < total ? input.offset + items.length : null;
  return {
    items,
    total,
    returned: items.length,
    offset: input.offset,
    limit: input.limit,
    nextOffset,
    hasMore: nextOffset !== null,
  };
}

export async function libraryStats(userId: string, input: Filters) {
  const { from, args } = selection(userId, input);
  const select = (sql: string) => ({ sql, args });
  const group = (key: string) =>
    select(
      `SELECT ${key} AS label, COUNT(*) AS count ${from} AND ${key} IS NOT NULL GROUP BY ${key} ORDER BY count DESC, label`
    );
  const facets = (key: 'genres' | 'themes') =>
    select(
      `SELECT CASE WHEN j.type='text' AND typeof(j.key)='integer' THEN j.value ELSE j.key END AS label, COUNT(*) AS count FROM (SELECT ${key} ${from}) r JOIN json_each(CASE WHEN json_valid(r.${key}) THEN r.${key} END) j GROUP BY label ORDER BY count DESC,label`
    );
  const [summary, media, status, year, rating, genres, themes, highest, recent, completed] =
    await getDb().batch(
      [
        select('SELECT COUNT(*) AS total, COUNT(rating) AS rated, AVG(rating) AS average ' + from),
        group('media'),
        group('status'),
        group('year'),
        group('rating'),
        facets('genres'),
        facets('themes'),
        select(
          'SELECT * ' +
            from +
            ' AND rating IS NOT NULL ORDER BY rating DESC, media, CAST(mal_id AS INTEGER) LIMIT 10'
        ),
        select(
          'SELECT * ' +
            from +
            ' AND updated_at IS NOT NULL ORDER BY updated_at DESC, media, CAST(mal_id AS INTEGER) LIMIT 10'
        ),
        select(
          'SELECT * ' +
            from +
            " AND status='Done' AND completed_at IS NOT NULL ORDER BY completed_at DESC, media, CAST(mal_id AS INTEGER) LIMIT 10"
        ),
      ],
      'read'
    );
  const buckets = (rows: Row[]) =>
    rows.map((r) => ({ label: String(r.label), count: Number(r.count) }));
  return {
    total: Number(summary.rows[0].total),
    rated_count: Number(summary.rows[0].rated),
    average_personal_rating: summary.rows[0].average as number | null,
    by_media: buckets(media.rows),
    by_status: buckets(status.rows),
    by_year: buckets(year.rows),
    by_rating: buckets(rating.rows),
    by_genre: buckets(genres.rows),
    by_theme: buckets(themes.rows),
    highest_rated: highest.rows.map(asEntry),
    recently_updated: recent.rows.map(asEntry),
    recently_completed: completed.rows.map(asEntry),
  };
}
