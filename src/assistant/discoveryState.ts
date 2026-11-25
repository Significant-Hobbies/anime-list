import { getDb } from '../db/client';
import { AssistantError } from './tool';
import { savedSchema, type Filters, type Preferences, type Media } from './discoverySchemas';

export function owner(userId: string) {
  if (!userId) throw new AssistantError('invalid_argument', 'Connect your account first.');
  return userId;
}
export async function savedPreferences(userId: string) {
  const row = (
    await getDb().execute({
      sql: 'SELECT hard_filters,preferences,updated_at FROM assistant_discovery_preferences WHERE user_id=?',
      args: [owner(userId)],
    })
  ).rows[0];
  return savedSchema.parse({
    hard_filters: JSON.parse(String(row?.hard_filters ?? '{}')),
    preferences: JSON.parse(String(row?.preferences ?? '{}')),
    updated_at: row?.updated_at ?? null,
  });
}
export async function savePreferences(
  userId: string,
  filters: Filters,
  preferences: Preferences,
  replace: boolean
) {
  try {
    await getDb().execute({
      sql: `INSERT INTO assistant_discovery_preferences (user_id,hard_filters,preferences)
    VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET
    hard_filters=${replace ? 'excluded.hard_filters' : 'json_patch(hard_filters,excluded.hard_filters)'},
    preferences=${replace ? 'excluded.preferences' : 'json_patch(preferences,excluded.preferences)'},
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
      args: [owner(userId), JSON.stringify(filters), JSON.stringify(preferences)],
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('assistant_preference_bounds'))
      throw new AssistantError('invalid_argument', 'The saved minimum may not exceed its maximum.');
    throw error;
  }
  return savedPreferences(userId);
}
export const tableFor = (media: Media) => (media === 'anime' ? 'anime_data' : 'manga_data');
export async function writeFeedback(
  userId: string,
  media: Media,
  id: number,
  signal: string,
  reason?: string
) {
  const rows = await getDb().execute({
    sql: `INSERT INTO assistant_recommendation_feedback (user_id,media_type,mal_id,signal,reason)
    SELECT ?,?,mal_id,?,? FROM ${tableFor(media)} WHERE mal_id=?
    ON CONFLICT(user_id,media_type,mal_id) DO UPDATE SET signal=excluded.signal,reason=excluded.reason,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
    RETURNING media_type,mal_id,signal,reason,updated_at`,
    args: [owner(userId), media, signal, reason ?? null, id],
  });
  if (!rows.rows[0]) throw new AssistantError('not_found', 'Title not found in the catalog.');
  return rows.rows[0];
}
export async function history(userId: string, limit: number, offset: number, media?: Media) {
  const where = media ? 'user_id=? AND media_type=?' : 'user_id=?';
  const args = media ? [owner(userId), media] : [owner(userId)];
  const [count, page] = await getDb().batch([
    {
      sql: `SELECT count(*) AS total FROM assistant_recommendation_feedback WHERE ${where}`,
      args,
    },
    {
      sql: `SELECT media_type,mal_id,signal,reason,updated_at FROM assistant_recommendation_feedback WHERE ${where} ORDER BY updated_at DESC,media_type,mal_id LIMIT ? OFFSET ?`,
      args: [...args, limit, offset],
    },
  ]);
  const total = Number(count.rows[0].total);
  return {
    results: page.rows,
    total,
    next_offset: offset + page.rows.length < total ? offset + page.rows.length : null,
  };
}
