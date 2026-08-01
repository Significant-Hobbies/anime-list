import { filterAnimeList } from '../filterEngine';
import type { Filter } from '../types/anime';
import { getDb } from './client';

export interface SavedSearchRow {
  id: string;
  user_id: string;
  name: string;
  filters_json: string;
  channel: string;
  frequency: string;
  paused: number;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedSearchAlertRow {
  id: string;
  saved_search_id: string;
  mal_id: string;
  title_type: string;
  title: string | null;
  match_reason: string | null;
  created_at: string;
  seen_at: string | null;
}

export async function listSavedSearches(userId: string): Promise<SavedSearchRow[]> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM saved_searches WHERE user_id = ? ORDER BY updated_at DESC`,
    args: [userId],
  });
  return result.rows as unknown as SavedSearchRow[];
}

export async function createSavedSearch(
  userId: string,
  name: string,
  filters: Filter[]
): Promise<SavedSearchRow> {
  const db = getDb();
  const id = crypto.randomUUID();
  await db.execute({
    sql: `INSERT INTO saved_searches (id, user_id, name, filters_json) VALUES (?, ?, ?, ?)`,
    args: [id, userId, name.trim(), JSON.stringify(filters)],
  });
  const rows = await listSavedSearches(userId);
  return rows.find((row) => row.id === id)!;
}

export async function updateSavedSearch(
  userId: string,
  id: string,
  updates: { name?: string; paused?: boolean; filters?: Filter[] }
): Promise<void> {
  const db = getDb();
  const sets: string[] = ["updated_at = datetime('now')"];
  const args: Array<string | number> = [];

  if (updates.name !== undefined) {
    sets.push('name = ?');
    args.push(updates.name.trim());
  }
  if (updates.paused !== undefined) {
    sets.push('paused = ?');
    args.push(updates.paused ? 1 : 0);
  }
  if (updates.filters !== undefined) {
    sets.push('filters_json = ?');
    args.push(JSON.stringify(updates.filters));
  }

  args.push(id, userId);
  await db.execute({
    sql: `UPDATE saved_searches SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
    args,
  });
}

export async function deleteSavedSearch(userId: string, id: string): Promise<void> {
  const db = getDb();
  await db.batch([
    {
      sql: 'DELETE FROM saved_search_alerts WHERE saved_search_id = ?',
      args: [id],
    },
    {
      sql: 'DELETE FROM saved_searches WHERE id = ? AND user_id = ?',
      args: [id, userId],
    },
  ]);
}

export async function listSavedSearchAlerts(
  userId: string,
  options: { unseenOnly?: boolean } = {}
): Promise<Array<SavedSearchAlertRow & { search_name: string }>> {
  const db = getDb();
  const result = await db.execute({
    sql: `
      SELECT a.*, s.name AS search_name
      FROM saved_search_alerts a
      JOIN saved_searches s ON s.id = a.saved_search_id
      WHERE s.user_id = ?
      ${options.unseenOnly ? 'AND a.seen_at IS NULL' : ''}
      ORDER BY a.created_at DESC
      LIMIT 200
    `,
    args: [userId],
  });
  return result.rows as unknown as Array<SavedSearchAlertRow & { search_name: string }>;
}

export async function markSavedSearchAlertsSeen(userId: string, alertIds: string[]): Promise<void> {
  if (alertIds.length === 0) return;
  const db = getDb();
  for (let offset = 0; offset < alertIds.length; offset += 99) {
    const chunk = alertIds.slice(offset, offset + 99);
    const placeholders = chunk.map(() => '?').join(', ');
    await db.execute({
      sql: `
        UPDATE saved_search_alerts
        SET seen_at = datetime('now')
        WHERE id IN (${placeholders})
          AND saved_search_id IN (SELECT id FROM saved_searches WHERE user_id = ?)
      `,
      args: [...chunk, userId],
    });
  }
}

function summarizeFilters(filters: Filter[]): string {
  return filters
    .slice(0, 3)
    .map(
      (filter) =>
        `${String(filter.field)} ${String(filter.action).replace(/_/g, ' ').toLowerCase()} ${Array.isArray(filter.value) ? filter.value.join(', ') : filter.value}`
    )
    .join(' · ');
}

export async function evaluateSavedSearchesAfterCatalogRefresh(): Promise<number> {
  const db = getDb();
  const searches = await db.execute({
    sql: 'SELECT * FROM saved_searches WHERE paused = 0',
    args: [],
  });

  let created = 0;
  for (const row of searches.rows as unknown as SavedSearchRow[]) {
    let filters: Filter[] = [];
    try {
      filters = JSON.parse(row.filters_json) as Filter[];
    } catch {
      continue;
    }
    if (!Array.isArray(filters) || filters.length === 0) continue;

    const matches = await filterAnimeList(filters);
    const existing = await db.execute({
      sql: 'SELECT mal_id FROM saved_search_alerts WHERE saved_search_id = ?',
      args: [row.id],
    });
    const knownIds = new Set(existing.rows.map((item) => String(item.mal_id)));

    const statements = matches
      .filter((anime) => !knownIds.has(String(anime.mal_id)))
      .map((anime) => ({
        sql: `INSERT OR IGNORE INTO saved_search_alerts
              (id, saved_search_id, mal_id, title_type, title, match_reason)
              VALUES (?, ?, ?, 'anime', ?, ?)`,
        args: [
          crypto.randomUUID(),
          row.id,
          String(anime.mal_id),
          anime.title ?? anime.title_english ?? null,
          summarizeFilters(filters),
        ],
      }));

    if (statements.length > 0) {
      await db.batch(statements);
      created += statements.length;
    }

    await db.execute({
      sql: "UPDATE saved_searches SET last_checked_at = datetime('now') WHERE id = ?",
      args: [row.id],
    });
  }

  return created;
}

export async function countUnseenAlerts(userId: string): Promise<number> {
  const db = getDb();
  const result = await db.execute({
    sql: `
      SELECT COUNT(*) AS count
      FROM saved_search_alerts a
      JOIN saved_searches s ON s.id = a.saved_search_id
      WHERE s.user_id = ? AND a.seen_at IS NULL
    `,
    args: [userId],
  });
  return Number(result.rows[0]?.count ?? 0);
}
