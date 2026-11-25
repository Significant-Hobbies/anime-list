import { getDb, type DatabaseStatement } from './client';
import type { EnrichedScheduleItem } from '../services/scheduleTimeline';

export async function getSchedule(userId: string): Promise<EnrichedScheduleItem[]> {
  const result = await getDb().execute({
    sql: `SELECT q.mal_id, q.episodes_per_day, q.episodes_watched, q.sort_order,
          COALESCE(NULLIF(a.title_english, ''), NULLIF(a.title, ''), NULLIF(w.title, ''), 'ID: ' || q.mal_id) AS title,
          COALESCE(a.type, w.type) AS type, COALESCE(a.episodes, w.episodes) AS episodes,
          a.image, a.score, a.url, COALESCE(t.name, '') AS watchStatus
          FROM schedule_queue q
          LEFT JOIN anime_data a ON a.mal_id = q.mal_id
          LEFT JOIN anime_watchlist w ON w.user_id = q.user_id AND w.mal_id = q.mal_id
          LEFT JOIN user_tags t ON t.user_id = w.user_id AND t.id = w.tag_id
          WHERE q.user_id = ?
          ORDER BY q.sort_order IS NULL, q.sort_order, CAST(q.mal_id AS INTEGER), q.mal_id`,
    args: [userId],
  });
  return result.rows.map((row, index) => ({
    mal_id: String(row.mal_id),
    episodes_per_day: Number(row.episodes_per_day),
    episodes_watched: Number(row.episodes_watched),
    sort_order: Number(row.sort_order ?? index),
    title: String(row.title),
    type: (row.type ?? undefined) as string | undefined,
    episodes: (row.episodes ?? undefined) as number | undefined,
    image: (row.image ?? undefined) as string | undefined,
    score: (row.score ?? undefined) as number | undefined,
    url: (row.url ?? undefined) as string | undefined,
    watchStatus: String(row.watchStatus),
  }));
}

export async function upsertScheduleItems(
  userId: string,
  items: Array<{ malId: string; episodesPerDay?: number }>
): Promise<void> {
  const db = getDb();

  if (!items.length) return;
  // Give currently visible automatic titles their displayed positions before appending.
  const statements: DatabaseStatement[] = [
    {
      sql: `INSERT INTO watching_schedule_preferences (user_id, mal_id, sort_order)
          SELECT user_id, mal_id,
                 COALESCE((SELECT MAX(sort_order) FROM schedule_queue WHERE user_id = ?), -1)
                 + ROW_NUMBER() OVER (ORDER BY CAST(mal_id AS INTEGER), mal_id)
          FROM schedule_queue WHERE user_id = ? AND sort_order IS NULL
          ON CONFLICT(user_id, mal_id) DO UPDATE SET sort_order = excluded.sort_order`,
      args: [userId, userId],
    },
  ];
  for (const item of items) {
    statements.push(
      {
        sql: `INSERT INTO anime_schedule (user_id, mal_id, episodes_per_day, sort_order)
              SELECT ?, ?, ?, COALESCE((SELECT MAX(sort_order) FROM schedule_queue WHERE user_id = ?), -1) + 1
              WHERE EXISTS (SELECT 1 FROM anime_schedule WHERE user_id = ? AND mal_id = ?)
                 OR NOT EXISTS (
                   SELECT 1 FROM anime_watchlist w JOIN user_tags t ON t.user_id = w.user_id AND t.id = w.tag_id
                   WHERE w.user_id = ? AND w.mal_id = ? AND t.name = 'Watching'
                 )
              ON CONFLICT(user_id, mal_id) DO UPDATE SET episodes_per_day = excluded.episodes_per_day`,
        args: [
          userId,
          item.malId,
          item.episodesPerDay ?? 3,
          userId,
          userId,
          item.malId,
          userId,
          item.malId,
        ],
      },
      {
        sql: `UPDATE watching_schedule_preferences SET hidden = 0,
              sort_order = COALESCE((SELECT MAX(sort_order) FROM schedule_queue WHERE user_id = ?), -1) + 1
              WHERE user_id = ? AND mal_id = ? AND hidden = 1`,
        args: [userId, userId, item.malId],
      }
    );
  }
  await db.batch(statements);
}

type ScheduleField = 'episodes_per_day' | 'sort_order' | 'episodes_watched';

// Materialize preferences only for Watching titles. An update or reorder arriving
// after a removal must never unhide an entry or add a title to the watchlist.
function watchingUpdate(
  userId: string,
  malId: string,
  field: ScheduleField,
  value: number
): DatabaseStatement {
  return {
    sql: `INSERT INTO watching_schedule_preferences (user_id, mal_id, ${field})
          SELECT w.user_id, w.mal_id, ? FROM anime_watchlist w
          JOIN user_tags t ON t.user_id = w.user_id AND t.id = w.tag_id
          WHERE w.user_id = ? AND w.mal_id = ? AND t.name = 'Watching'
          ON CONFLICT(user_id, mal_id) DO UPDATE SET ${field} = excluded.${field}
          WHERE hidden = 0`,
    args: [value, userId, malId],
  };
}

function changeField(
  userId: string,
  malId: string,
  field: ScheduleField,
  value: number
): DatabaseStatement[] {
  return [
    {
      sql: `UPDATE anime_schedule SET ${field} = ? WHERE user_id = ? AND mal_id = ?`,
      args: [value, userId, malId],
    },
    watchingUpdate(userId, malId, field, value),
  ];
}

export async function updateScheduleItem(
  userId: string,
  malId: string,
  updates: { episodesPerDay?: number; sortOrder?: number; episodesWatched?: number }
): Promise<void> {
  const statements: DatabaseStatement[] = [];
  if (updates.episodesPerDay !== undefined) {
    statements.push(...changeField(userId, malId, 'episodes_per_day', updates.episodesPerDay));
  }
  if (updates.sortOrder !== undefined) {
    statements.push(...changeField(userId, malId, 'sort_order', updates.sortOrder));
  }
  if (updates.episodesWatched !== undefined) {
    statements.push(...changeField(userId, malId, 'episodes_watched', updates.episodesWatched));
  }
  if (statements.length) await getDb().batch(statements);
}

export async function removeScheduleItems(userId: string, malIds: string[]): Promise<void> {
  const statements = malIds.flatMap((id) => [
    {
      sql: `INSERT INTO watching_schedule_preferences (user_id, mal_id, episodes_per_day, episodes_watched, sort_order, hidden)
            SELECT q.user_id, q.mal_id, q.episodes_per_day, q.episodes_watched, q.sort_order, 1
            FROM schedule_queue q
            JOIN anime_watchlist w ON w.user_id = q.user_id AND w.mal_id = q.mal_id
            JOIN user_tags t ON t.user_id = w.user_id AND t.id = w.tag_id
            WHERE q.user_id = ? AND q.mal_id = ? AND t.name = 'Watching'
            ON CONFLICT(user_id, mal_id) DO UPDATE SET hidden = 1, episodes_per_day = excluded.episodes_per_day,
              episodes_watched = excluded.episodes_watched, sort_order = excluded.sort_order`,
      args: [userId, id],
    },
    { sql: 'DELETE FROM anime_schedule WHERE user_id = ? AND mal_id = ?', args: [userId, id] },
  ]);
  await getDb().batch(statements);
}

export async function reorderSchedule(userId: string, orderedMalIds: string[]): Promise<void> {
  const statements = orderedMalIds.flatMap((id, index) =>
    changeField(userId, id, 'sort_order', index)
  );
  await getDb().batch(statements);
}
