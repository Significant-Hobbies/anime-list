import { getDb } from './client';

export interface ScheduleRow {
  mal_id: string;
  episodes_per_day: number;
  sort_order: number;
  episodes_watched: number;
}

export async function getSchedule(userId: string): Promise<ScheduleRow[]> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT mal_id, episodes_per_day, sort_order, COALESCE(episodes_watched, 0) AS episodes_watched
          FROM anime_schedule
          WHERE user_id = ?
          ORDER BY sort_order ASC`,
    args: [userId],
  });

  return result.rows.map((row) => ({
    mal_id: row.mal_id as string,
    episodes_per_day: Number(row.episodes_per_day),
    sort_order: Number(row.sort_order),
    episodes_watched: Number(row.episodes_watched),
  }));
}

export async function upsertScheduleItems(
  userId: string,
  items: Array<{ malId: string; episodesPerDay?: number }>
): Promise<void> {
  const db = getDb();

  // Get current max sort_order
  const maxResult = await db.execute({
    sql: 'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM anime_schedule WHERE user_id = ?',
    args: [userId],
  });
  let nextOrder = Number(maxResult.rows[0].max_order) + 1;

  const statements = items.map((item) => {
    const order = nextOrder++;
    return {
      sql: `INSERT INTO anime_schedule (user_id, mal_id, episodes_per_day, sort_order)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, mal_id) DO UPDATE SET episodes_per_day = excluded.episodes_per_day`,
      args: [userId, item.malId, item.episodesPerDay ?? 3, order],
    };
  });

  await db.batch(statements);
}

export async function updateScheduleItem(
  userId: string,
  malId: string,
  updates: { episodesPerDay?: number; sortOrder?: number; episodesWatched?: number }
): Promise<void> {
  const db = getDb();
  const sets: string[] = [];
  const args: (string | number)[] = [];

  if (updates.episodesPerDay !== undefined) {
    sets.push('episodes_per_day = ?');
    args.push(updates.episodesPerDay);
  }
  if (updates.sortOrder !== undefined) {
    sets.push('sort_order = ?');
    args.push(updates.sortOrder);
  }
  if (updates.episodesWatched !== undefined) {
    sets.push('episodes_watched = ?');
    args.push(updates.episodesWatched);
  }

  if (sets.length === 0) return;

  args.push(userId, malId);
  await db.execute({
    sql: `UPDATE anime_schedule SET ${sets.join(', ')} WHERE user_id = ? AND mal_id = ?`,
    args,
  });
}

export async function removeScheduleItems(userId: string, malIds: string[]): Promise<void> {
  const db = getDb();
  const statements = malIds.map((id) => ({
    sql: 'DELETE FROM anime_schedule WHERE user_id = ? AND mal_id = ?',
    args: [userId, id],
  }));
  await db.batch(statements);
}

export async function reorderSchedule(userId: string, orderedMalIds: string[]): Promise<void> {
  const db = getDb();
  const statements = orderedMalIds.map((id, index) => ({
    sql: 'UPDATE anime_schedule SET sort_order = ? WHERE user_id = ? AND mal_id = ?',
    args: [index, userId, id],
  }));
  await db.batch(statements);
}
