import { getDb, type DatabaseStatement, type DatabaseValue } from '../db/client';
import { AssistantError } from './tool';
import { asEntry } from './library';
import type { EntryInput, EntryKey } from './librarySchemas';

const now = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
export async function upsertLibraryEntry(userId: string, input: EntryInput) {
  const { media_type: media, watch_status: status } = input;
  const id = String(input.catalog_id);
  const key = [userId, media, id];
  const parent = media + '_watchlist';
  const db = getDb();
  const statements: DatabaseStatement[] = [];
  // Reading existence inside the write batch keeps simultaneous creates/removes ordered.
  if (status) {
    statements.push(
      {
        sql: `INSERT INTO user_tags (id,user_id,name) SELECT ?,?,?
            WHERE (EXISTS(SELECT 1 FROM ${media}_data WHERE mal_id=?) OR EXISTS(SELECT 1 FROM ${parent} WHERE user_id=? AND mal_id=?))
            AND NOT EXISTS(SELECT 1 FROM assistant_library WHERE user_id=? AND media=? AND mal_id=? AND status=? COLLATE NOCASE)
            ON CONFLICT(user_id,name) DO NOTHING`,
        args: [crypto.randomUUID(), userId, status, id, userId, id, ...key, status],
      },
      {
        sql: `INSERT INTO ${parent} (user_id,mal_id,tag_id)
            SELECT ?,?,t.id FROM user_tags t WHERE t.user_id=? AND t.name=? AND
              (EXISTS(SELECT 1 FROM ${media}_data WHERE mal_id=?) OR EXISTS(SELECT 1 FROM ${parent} WHERE user_id=? AND mal_id=?))
            ON CONFLICT(user_id,mal_id) DO UPDATE SET tag_id=excluded.tag_id
            WHERE ${parent}.tag_id IS NOT excluded.tag_id AND NOT EXISTS
              (SELECT 1 FROM assistant_library WHERE user_id=? AND media=? AND mal_id=? AND status=? COLLATE NOCASE)`,
        args: [userId, id, userId, status, id, userId, id, ...key, status],
      }
    );
  }
  // Historic entries may predate library_details and must keep their unknown creation date.
  statements.push({
    sql: `INSERT INTO library_details (user_id,media,mal_id) SELECT ?,?,? FROM ${parent} WHERE user_id=? AND mal_id=?
          ON CONFLICT(user_id,media,mal_id) DO NOTHING`,
    args: [...key, userId, id],
  });
  if (media === 'anime' && input.notes !== undefined)
    statements.push({
      sql: 'UPDATE anime_watchlist SET note=? WHERE user_id=? AND mal_id=? AND note IS NOT ?',
      args: [input.notes, userId, id, input.notes],
    });
  const values: DatabaseValue[] = [];
  const columns: string[] = [];
  for (const [col, value] of [
    ['rating', input.personal_rating],
    ['notes', media === 'manga' ? input.notes : undefined],
    [
      'completed_at',
      input.completed_at ? new Date(input.completed_at).toISOString() : input.completed_at,
    ],
  ] as const) {
    if (value !== undefined) {
      columns.push(col);
      values.push(value);
    }
  }
  const whereKey = 'user_id=? AND media=? AND mal_id=?';
  if (columns.length)
    statements.push({
      sql: `UPDATE library_details SET ${columns.map((c) => c + '=?').join(',')}, updated_at=${now}
         WHERE ${whereKey} AND (${columns.map((c) => c + ' IS NOT ?').join(' OR ')})`,
      args: [...values, ...key, ...values],
    });
  if (input.tags !== undefined) {
    const tags = JSON.stringify(input.tags ?? []);
    statements.push(
      {
        sql: `INSERT INTO library_tags(user_id,name) SELECT ?,value FROM json_each(?)
           WHERE EXISTS(SELECT 1 FROM library_details WHERE ${whereKey}) ON CONFLICT DO NOTHING`,
        args: [userId, tags, ...key],
      },
      {
        sql: `DELETE FROM library_entry_tags WHERE ${whereKey} AND name NOT IN (SELECT value FROM json_each(?))`,
        args: [...key, tags],
      },
      {
        sql: `INSERT INTO library_entry_tags(user_id,media,mal_id,name) SELECT ?,?,?,t.name FROM library_tags t
           WHERE t.user_id=? AND t.name IN (SELECT value FROM json_each(?))
             AND EXISTS(SELECT 1 FROM library_details WHERE ${whereKey}) ON CONFLICT DO NOTHING`,
        args: [...key, userId, tags, ...key],
      }
    );
  }
  statements.push({ sql: 'SELECT * FROM assistant_library WHERE ' + whereKey, args: key });
  const result = await db.batch(statements);
  const row = result[result.length - 1].rows[0];
  if (!row)
    throw new AssistantError(
      status ? 'not_found' : 'invalid_argument',
      status ? 'Catalog title was not found.' : 'A new entry requires watch_status.'
    );
  return asEntry(row);
}

export async function removeLibraryEntry(userId: string, key: EntryKey) {
  const result = await getDb().execute({
    sql: `DELETE FROM ${key.media_type}_watchlist WHERE user_id=? AND mal_id=? RETURNING mal_id`,
    args: [userId, String(key.catalog_id)],
  });
  return result.rows.length > 0;
}
export async function listLibraryTags(userId: string, limit: number, offset: number) {
  const [count, data] = await getDb().batch(
    [
      { sql: 'SELECT count(*) AS n FROM library_tags WHERE user_id=?', args: [userId] },
      {
        sql: `SELECT t.name,COUNT(e.mal_id) AS count FROM library_tags t LEFT JOIN library_entry_tags e ON e.user_id=t.user_id AND e.name=t.name
          WHERE t.user_id=? GROUP BY t.name ORDER BY t.name LIMIT ? OFFSET ?`,
        args: [userId, limit, offset],
      },
    ],
    'read'
  );
  const total = Number(count.rows[0].n);
  const items = data.rows.map((r) => ({ name: String(r.name), count: Number(r.count) }));
  const nextOffset = offset + items.length < total ? offset + items.length : null;
  return {
    items,
    total,
    returned: items.length,
    offset,
    limit,
    nextOffset,
    hasMore: nextOffset !== null,
  };
}
export async function manageLibraryTag(
  userId: string,
  action: 'create' | 'rename' | 'delete',
  name: string,
  newName?: string
) {
  const db = getDb();
  if (action === 'create') {
    await db.execute({
      sql: 'INSERT INTO library_tags(user_id,name) VALUES (?,?) ON CONFLICT DO NOTHING',
      args: [userId, name],
    });
  } else if (action === 'delete') {
    await db.execute({
      sql: 'DELETE FROM library_tags WHERE user_id=? AND name=?',
      args: [userId, name],
    });
  } else {
    if (!newName) throw new AssistantError('invalid_argument', 'Renaming requires new_name.');
    const result = await db.execute({
      sql: `UPDATE library_tags SET name=? WHERE user_id=? AND name=? AND NOT EXISTS(
           SELECT 1 FROM library_tags WHERE user_id=? AND name=? AND name<>?) RETURNING name`,
      args: [newName, userId, name, userId, newName, name],
    });
    if (!result.rows.length) {
      const original = await db.execute({
        sql: 'SELECT 1 FROM library_tags WHERE user_id=? AND name=?',
        args: [userId, name],
      });
      if (original.rows.length)
        throw new AssistantError('conflict', 'The new tag name is already in use.');
      throw new AssistantError('not_found', 'Tag not found.');
    }
  }
  return { action, name: action === 'rename' ? newName! : name };
}
