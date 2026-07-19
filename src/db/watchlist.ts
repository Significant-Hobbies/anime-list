import { getDb } from './client';
import type {
  ExternalWatchlistEntry,
  MangaWatchlistData,
  WatchedAnime,
  WatchedManga,
  WatchTag,
  WatchlistData,
  WatchlistTag,
} from '../types/watchlist';

const DEFAULT_USER_TAGS = [
  { tag: 'Watching', color: '#10b981' },
  { tag: 'Done', color: '#3b82f6' },
] as const;

const DEFAULT_TAG_COLOR_MAP: Map<string, string> = new Map(
  DEFAULT_USER_TAGS.map(({ tag, color }) => [tag, color])
);

const TAG_COLOR_PALETTE = [
  '#10b981',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
  '#84cc16',
  '#ec4899',
  '#14b8a6',
] as const;

const tagColorPattern = /^#[0-9A-Fa-f]{6}$/;

const normalizeTag = (tag: string): WatchTag => tag.trim();

const normalizeTagColor = (color?: string): string | null => {
  if (!color) return null;
  const trimmed = color.trim();
  if (!tagColorPattern.test(trimmed)) return null;
  return trimmed.toLowerCase();
};

const defaultTagColor = (tag: string): string => {
  const mapped = DEFAULT_TAG_COLOR_MAP.get(tag);
  if (mapped) return mapped;

  let hash = 0;
  for (let i = 0; i < tag.length; i += 1) {
    hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  }
  return TAG_COLOR_PALETTE[hash % TAG_COLOR_PALETTE.length];
};

type DbTag = {
  id: string;
  name: string;
  color: string | null;
};

async function getTagById(userId: string, tagId: string): Promise<DbTag | null> {
  const db = getDb();
  const result = await db.execute({
    sql: `
      SELECT id, name, color
      FROM user_tags
      WHERE user_id = ? AND id = ?
      LIMIT 1
    `,
    args: [userId, tagId],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id as string,
    name: row.name as string,
    color: (row.color as string | null) ?? null,
  };
}

async function getTagByName(userId: string, tag: string): Promise<DbTag | null> {
  const db = getDb();
  const result = await db.execute({
    sql: `
      SELECT id, name, color
      FROM user_tags
      WHERE user_id = ? AND lower(name) = lower(?)
      LIMIT 1
    `,
    args: [userId, tag],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id as string,
    name: row.name as string,
    color: (row.color as string | null) ?? null,
  };
}

async function ensureTag(userId: string, tag: string, color?: string): Promise<DbTag> {
  const db = getDb();
  const normalizedTag = normalizeTag(tag);
  const normalizedColor = normalizeTagColor(color);

  const existing = await getTagByName(userId, normalizedTag);
  if (existing) {
    if (normalizedColor && normalizedColor !== normalizeTagColor(existing.color ?? undefined)) {
      await db.execute({
        sql: 'UPDATE user_tags SET color = ? WHERE id = ?',
        args: [normalizedColor, existing.id],
      });
      return { ...existing, color: normalizedColor };
    }
    return {
      ...existing,
      color: existing.color || defaultTagColor(existing.name),
    };
  }

  const id = crypto.randomUUID();
  const resolvedColor = normalizedColor || defaultTagColor(normalizedTag);
  await db.execute({
    sql: 'INSERT INTO user_tags (id, user_id, name, color) VALUES (?, ?, ?, ?)',
    args: [id, userId, normalizedTag, resolvedColor],
  });

  return { id, name: normalizedTag, color: resolvedColor };
}

export async function initWatchlistTables(): Promise<void> {
  const db = getDb();
  await db.batch([
    `CREATE TABLE IF NOT EXISTS user_tags (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL COLLATE NOCASE,
      color TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, name)
    )`,
    `CREATE TABLE IF NOT EXISTS anime_watchlist (
      user_id TEXT NOT NULL DEFAULT 'default',
      mal_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      title TEXT,
      type TEXT,
      episodes INTEGER,
      note TEXT,
      PRIMARY KEY (user_id, mal_id)
    )`,
    `CREATE TABLE IF NOT EXISTS manga_watchlist (
      user_id TEXT NOT NULL DEFAULT 'default',
      mal_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (user_id, mal_id)
    )`,
    `CREATE TABLE IF NOT EXISTS anime_dismissals (
      user_id TEXT NOT NULL,
      mal_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, mal_id)
    )`,
    'CREATE INDEX IF NOT EXISTS idx_user_tags_user ON user_tags(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_user_tags_user_lower_name ON user_tags(user_id, lower(name))',
    'CREATE INDEX IF NOT EXISTS idx_watchlist_tag_id ON anime_watchlist(tag_id)',
    'CREATE INDEX IF NOT EXISTS idx_watchlist_user_tag ON anime_watchlist(user_id, tag_id)',
    'CREATE INDEX IF NOT EXISTS idx_manga_watchlist_tag_id ON manga_watchlist(tag_id)',
    'CREATE INDEX IF NOT EXISTS idx_manga_watchlist_user_tag ON manga_watchlist(user_id, tag_id)',
    'CREATE INDEX IF NOT EXISTS idx_anime_dismissals_user ON anime_dismissals(user_id)',
  ]);
}

export async function addDismissedAnime(userId: string, malIds: string[]): Promise<void> {
  const db = getDb();
  const statements = malIds.map((id) => ({
    sql: `INSERT OR IGNORE INTO anime_dismissals (user_id, mal_id) VALUES (?, ?)`,
    args: [userId, id],
  }));
  if (statements.length > 0) {
    await db.batch(statements);
  }
}

export async function getDismissedAnime(userId: string): Promise<string[]> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT mal_id FROM anime_dismissals WHERE user_id = ?',
    args: [userId],
  });
  return result.rows.map((row) => row.mal_id as string);
}

export async function seedDefaultUserTags(userId: string): Promise<void> {
  for (const { tag, color } of DEFAULT_USER_TAGS) {
    await ensureTag(userId, tag, color);
  }
}

export async function getUserTags(userId: string = 'default'): Promise<WatchlistTag[]> {
  const db = getDb();

  const result = await db.execute({
    sql: `
      SELECT
        ut.id,
        ut.name,
        ut.color,
        COALESCE(COUNT(aw.mal_id), 0) AS count
      FROM user_tags ut
      LEFT JOIN anime_watchlist aw
        ON aw.user_id = ut.user_id
        AND aw.tag_id = ut.id
      WHERE ut.user_id = ?
      GROUP BY ut.id, ut.name, ut.color
      ORDER BY count DESC, ut.name COLLATE NOCASE ASC
    `,
    args: [userId],
  });

  return result.rows.map((row) => {
    const tag = row.name as string;
    return {
      id: row.id as string,
      tag,
      count: Number(row.count || 0),
      color: normalizeTagColor((row.color as string | null) || undefined) || defaultTagColor(tag),
    };
  });
}

export async function upsertUserTag(
  tag: string,
  userId: string = 'default',
  color?: string
): Promise<void> {
  await ensureTag(userId, tag, color);
}

export async function updateUserTag(
  tagId: string,
  userId: string,
  updates: {
    tag?: string;
    color?: string;
  }
): Promise<void> {
  const db = getDb();
  const current = await getTagById(userId, tagId);
  if (!current) {
    throw new Error('Tag not found');
  }

  const nextName = updates.tag ? normalizeTag(updates.tag) : current.name;
  const nextColor = updates.color
    ? normalizeTagColor(updates.color) || defaultTagColor(nextName)
    : current.color || defaultTagColor(nextName);

  const duplicate = await db.execute({
    sql: `
      SELECT id
      FROM user_tags
      WHERE user_id = ?
        AND lower(name) = lower(?)
        AND id != ?
      LIMIT 1
    `,
    args: [userId, nextName, tagId],
  });

  if (duplicate.rows.length > 0) {
    throw new Error('Tag already exists');
  }

  await db.execute({
    sql: 'UPDATE user_tags SET name = ?, color = ? WHERE user_id = ? AND id = ?',
    args: [nextName, nextColor, userId, tagId],
  });
}

export async function deleteUserTag(
  tagId: string,
  userId: string,
  moveToTagId?: string
): Promise<void> {
  const db = getDb();
  const source = await getTagById(userId, tagId);
  if (!source) {
    throw new Error('Tag not found');
  }

  let targetTagId = moveToTagId?.trim() || '';
  if (!targetTagId) {
    if (source.name.toLowerCase() === 'done') {
      targetTagId = (await ensureTag(userId, 'Watching', defaultTagColor('Watching'))).id;
    } else {
      targetTagId = (await ensureTag(userId, 'Done', defaultTagColor('Done'))).id;
    }
  }

  if (targetTagId === tagId) {
    throw new Error('Cannot move items into the same tag being deleted');
  }

  const target = await getTagById(userId, targetTagId);
  if (!target) {
    throw new Error('Target tag not found');
  }

  await db.batch([
    {
      sql: 'UPDATE anime_watchlist SET tag_id = ? WHERE user_id = ? AND tag_id = ?',
      args: [targetTagId, userId, tagId],
    },
    {
      sql: 'UPDATE manga_watchlist SET tag_id = ? WHERE user_id = ? AND tag_id = ?',
      args: [targetTagId, userId, tagId],
    },
    {
      sql: 'DELETE FROM user_tags WHERE user_id = ? AND id = ?',
      args: [userId, tagId],
    },
  ]);
}

// Anime watchlist

export async function getAnimeWatchlist(userId: string = 'default'): Promise<WatchlistData | null> {
  const db = getDb();
  const result = await db.execute({
    sql: `
      SELECT aw.mal_id, ut.name AS tag_name, aw.title, aw.type, aw.episodes, aw.note
      FROM anime_watchlist aw
      JOIN user_tags ut ON ut.id = aw.tag_id
      WHERE aw.user_id = ?
    `,
    args: [userId],
  });

  const anime: Record<string, WatchedAnime> = {};
  for (const row of result.rows) {
    const id = row.mal_id as string;
    anime[id] = {
      id,
      status: ((row.tag_name as string) || '').trim(),
      ...(row.title ? { title: row.title as string } : {}),
      ...(row.type ? { type: row.type as string } : {}),
      ...(row.episodes ? { episodes: row.episodes as number } : {}),
      ...(row.note ? { note: row.note as string } : {}),
    };
  }

  return {
    user: { id: userId, name: userId },
    anime,
  };
}

export async function getAnimeWatchlistEntry(
  malId: string,
  userId: string = 'default'
): Promise<WatchedAnime | null> {
  const db = getDb();
  const result = await db.execute({
    sql: `
      SELECT aw.mal_id, ut.name AS tag_name, aw.title, aw.type, aw.episodes, aw.note
      FROM anime_watchlist aw
      JOIN user_tags ut ON ut.id = aw.tag_id
      WHERE aw.user_id = ? AND aw.mal_id = ?
      LIMIT 1
    `,
    args: [userId, malId],
  });

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.mal_id as string,
    status: ((row.tag_name as string) || '').trim(),
    ...(row.title ? { title: row.title as string } : {}),
    ...(row.type ? { type: row.type as string } : {}),
    ...(row.episodes ? { episodes: row.episodes as number } : {}),
    ...(row.note ? { note: row.note as string } : {}),
  };
}

export async function upsertAnimeWatchlist(
  malIds: string[],
  status: WatchTag,
  userId: string = 'default',
  tagColor?: string
): Promise<void> {
  const db = getDb();
  const tag = await ensureTag(userId, status, tagColor);

  const statements = malIds.map((id) => ({
    sql: `INSERT INTO anime_watchlist (user_id, mal_id, tag_id) VALUES (?, ?, ?)
          ON CONFLICT(user_id, mal_id) DO UPDATE SET tag_id = excluded.tag_id`,
    args: [userId, id, tag.id],
  }));
  await db.batch(statements);
}

export async function importAnimeWatchlistEntries(
  entries: ExternalWatchlistEntry[],
  userId: string = 'default'
): Promise<{ imported: number }> {
  if (entries.length === 0) return { imported: 0 };

  // Resolve each distinct status to a tag ID once, instead of per-entry.
  // For a 500-row import that's ~3 lookups instead of 500.
  const uniqueStatuses = Array.from(new Set(entries.map((entry) => normalizeTag(entry.status))));
  const tagIdByStatus = new Map<string, string>();
  for (const status of uniqueStatuses) {
    const tag = await ensureTag(userId, status);
    tagIdByStatus.set(status.toLowerCase(), tag.id);
  }

  const db = getDb();
  const statements = entries.map((entry) => {
    const tagId = tagIdByStatus.get(normalizeTag(entry.status).toLowerCase())!;
    return {
      sql: `INSERT INTO anime_watchlist (user_id, mal_id, tag_id, title, type, episodes, note)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, mal_id) DO UPDATE SET
              tag_id = excluded.tag_id,
              title = COALESCE(excluded.title, anime_watchlist.title),
              type = COALESCE(excluded.type, anime_watchlist.type),
              episodes = COALESCE(excluded.episodes, anime_watchlist.episodes),
              note = COALESCE(excluded.note, anime_watchlist.note)`,
      args: [
        userId,
        entry.malId,
        tagId,
        entry.title ?? null,
        entry.type ?? null,
        entry.episodes ?? null,
        entry.note ?? null,
      ],
    };
  });

  await db.batch(statements);
  return { imported: statements.length };
}

export async function deleteFromAnimeWatchlist(
  malIds: string[],
  userId: string = 'default'
): Promise<void> {
  const db = getDb();
  const statements = malIds.map((id) => ({
    sql: 'DELETE FROM anime_watchlist WHERE user_id = ? AND mal_id = ?',
    args: [userId, id],
  }));
  await db.batch(statements);
}

export async function deleteFromMangaWatchlist(
  malIds: string[],
  userId: string = 'default'
): Promise<void> {
  const db = getDb();
  const statements = malIds.map((id) => ({
    sql: 'DELETE FROM manga_watchlist WHERE user_id = ? AND mal_id = ?',
    args: [userId, id],
  }));
  await db.batch(statements);
}

export async function updateAnimeWatchlistNote(
  malId: string,
  note: string | null,
  userId: string = 'default'
): Promise<boolean> {
  const db = getDb();
  const result = await db.execute({
    sql: 'UPDATE anime_watchlist SET note = ? WHERE user_id = ? AND mal_id = ?',
    args: [note, userId, malId],
  });

  return Number(result.rowsAffected || 0) > 0;
}

// Manga watchlist

export async function getMangaWatchlist(
  userId: string = 'default'
): Promise<MangaWatchlistData | null> {
  const db = getDb();
  const result = await db.execute({
    sql: `
      SELECT mw.mal_id, ut.name AS tag_name
      FROM manga_watchlist mw
      JOIN user_tags ut ON ut.id = mw.tag_id
      WHERE mw.user_id = ?
    `,
    args: [userId],
  });

  const manga: Record<string, WatchedManga> = {};
  for (const row of result.rows) {
    const id = row.mal_id as string;
    manga[id] = { id, status: ((row.tag_name as string) || '').trim() };
  }

  return {
    user: { id: userId, name: userId },
    manga,
  };
}

export async function upsertMangaWatchlist(
  malIds: string[],
  status: WatchTag,
  userId: string = 'default',
  tagColor?: string
): Promise<void> {
  const db = getDb();
  const tag = await ensureTag(userId, status, tagColor);

  const statements = malIds.map((id) => ({
    sql: `INSERT INTO manga_watchlist (user_id, mal_id, tag_id) VALUES (?, ?, ?)
          ON CONFLICT(user_id, mal_id) DO UPDATE SET tag_id = excluded.tag_id`,
    args: [userId, id, tag.id],
  }));
  await db.batch(statements);
}
