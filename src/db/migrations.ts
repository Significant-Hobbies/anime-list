import { getDb } from './client';

const DEFAULT_TAG_COLORS: Record<string, string> = {
  Watching: '#10b981',
  Done: '#3b82f6',
};

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

const getDefaultTagColor = (tag: string): string => {
  const defaultColor = DEFAULT_TAG_COLORS[tag];
  if (defaultColor) return defaultColor;

  let hash = 0;
  for (let i = 0; i < tag.length; i += 1) {
    hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  }
  return TAG_COLOR_PALETTE[hash % TAG_COLOR_PALETTE.length];
};

const hasColumn = async (table: string, column: string): Promise<boolean> => {
  const db = getDb();
  const info = await db.execute(`PRAGMA table_info(${table})`);
  return info.rows.some((row) => row.name === column);
};

const tableExists = async (table: string): Promise<boolean> => {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    args: [table],
  });
  return result.rows.length > 0;
};

const createUserTagsTableSql = `
  CREATE TABLE IF NOT EXISTS user_tags (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL COLLATE NOCASE,
    color TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, name)
  )
`;

async function migrateWatchlistTables(): Promise<void> {
  const db = getDb();

  const animeExists = await tableExists('anime_watchlist');
  const mangaExists = await tableExists('manga_watchlist');
  if (!animeExists || !mangaExists) {
    await db.batch([
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
    ]);
    return;
  }

  const animeInfo = await db.execute('PRAGMA table_info(anime_watchlist)');
  const hasUserId = animeInfo.rows.some((row) => row.name === 'user_id');

  if (hasUserId) {
    return;
  }

  console.log('Migrating watchlist tables to support per-user data...');

  await db.batch([
    'ALTER TABLE anime_watchlist RENAME TO anime_watchlist_old',
    'ALTER TABLE manga_watchlist RENAME TO manga_watchlist_old',

    `CREATE TABLE anime_watchlist (
      user_id TEXT NOT NULL,
      mal_id TEXT NOT NULL,
      status TEXT NOT NULL,
      title TEXT,
      type TEXT,
      episodes INTEGER,
      note TEXT,
      PRIMARY KEY (user_id, mal_id)
    )`,
    `CREATE TABLE manga_watchlist (
      user_id TEXT NOT NULL,
      mal_id TEXT NOT NULL,
      status TEXT NOT NULL,
      PRIMARY KEY (user_id, mal_id)
    )`,

    `INSERT INTO anime_watchlist (user_id, mal_id, status, title, type, episodes)
     SELECT 'default', mal_id, status, title, type, episodes FROM anime_watchlist_old`,
    `INSERT INTO manga_watchlist (user_id, mal_id, status)
     SELECT 'default', mal_id, status FROM manga_watchlist_old`,

    'DROP TABLE anime_watchlist_old',
    'DROP TABLE manga_watchlist_old',
  ]);

  console.log('Watchlist user migration complete');
}

async function migrateUserTagsTable(): Promise<void> {
  const db = getDb();

  await db.execute(createUserTagsTableSql);

  const hasId = await hasColumn('user_tags', 'id');
  const hasName = await hasColumn('user_tags', 'name');
  const hasTag = await hasColumn('user_tags', 'tag');

  if (!hasId || !hasName) {
    console.log('Migrating user_tags table to id-based schema...');

    await db.batch(['ALTER TABLE user_tags RENAME TO user_tags_old', createUserTagsTableSql]);

    const oldHasColor = await hasColumn('user_tags_old', 'color');
    const oldHasCreatedAt = await hasColumn('user_tags_old', 'created_at');
    const tagColumn = hasTag ? 'tag' : 'name';
    const colorExpr = oldHasColor ? 'color' : 'NULL';
    const createdExpr = oldHasCreatedAt ? 'created_at' : "datetime('now')";

    await db.execute(`
      INSERT INTO user_tags (id, user_id, name, color, created_at)
      SELECT
        lower(hex(randomblob(16))),
        user_id,
        ${tagColumn},
        ${colorExpr},
        COALESCE(${createdExpr}, datetime('now'))
      FROM user_tags_old
      WHERE ${tagColumn} IS NOT NULL AND trim(${tagColumn}) != ''
    `);

    await db.execute('DROP TABLE user_tags_old');
  }

  const hasColor = await hasColumn('user_tags', 'color');
  if (!hasColor) {
    await db.execute('ALTER TABLE user_tags ADD COLUMN color TEXT');
  }

  const hasCreatedAt = await hasColumn('user_tags', 'created_at');
  if (!hasCreatedAt) {
    await db.execute('ALTER TABLE user_tags ADD COLUMN created_at TEXT');
  }

  await db.execute(`
    UPDATE user_tags
    SET created_at = datetime('now')
    WHERE created_at IS NULL OR trim(created_at) = ''
  `);

  const missingColorRows = await db.execute(
    "SELECT id, name FROM user_tags WHERE color IS NULL OR trim(color) = ''"
  );
  const colorUpdates = missingColorRows.rows.map((row) => ({
    sql: 'UPDATE user_tags SET color = ? WHERE id = ?',
    args: [getDefaultTagColor(row.name as string), row.id as string],
  }));
  if (colorUpdates.length > 0) {
    await db.batch(colorUpdates);
  }

  await db.batch([
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_user_tags_user_name ON user_tags(user_id, name)',
    'CREATE INDEX IF NOT EXISTS idx_user_tags_user ON user_tags(user_id)',
  ]);
}

async function migrateWatchlistToTagIds(): Promise<void> {
  const db = getDb();
  const hasTagId = await hasColumn('anime_watchlist', 'tag_id');
  if (hasTagId) {
    return;
  }

  console.log('Migrating watchlists from status text to tag_id...');

  await db.batch([
    'ALTER TABLE anime_watchlist RENAME TO anime_watchlist_old',
    'ALTER TABLE manga_watchlist RENAME TO manga_watchlist_old',
    `CREATE TABLE anime_watchlist (
      user_id TEXT NOT NULL,
      mal_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      title TEXT,
      type TEXT,
      episodes INTEGER,
      note TEXT,
      PRIMARY KEY (user_id, mal_id)
    )`,
    `CREATE TABLE manga_watchlist (
      user_id TEXT NOT NULL,
      mal_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (user_id, mal_id)
    )`,
  ]);

  await db.execute(`
    INSERT INTO user_tags (id, user_id, name, color)
    SELECT
      lower(hex(randomblob(16))),
      s.user_id,
      s.status,
      CASE
        WHEN lower(s.status) = 'watching' THEN '${DEFAULT_TAG_COLORS.Watching}'
        WHEN lower(s.status) = 'done' THEN '${DEFAULT_TAG_COLORS.Done}'
        ELSE '${DEFAULT_TAG_COLORS.Done}'
      END
    FROM (
      SELECT DISTINCT user_id, status FROM anime_watchlist_old
      WHERE status IS NOT NULL AND trim(status) != ''
      UNION
      SELECT DISTINCT user_id, status FROM manga_watchlist_old
      WHERE status IS NOT NULL AND trim(status) != ''
    ) s
    WHERE NOT EXISTS (
      SELECT 1 FROM user_tags ut
      WHERE ut.user_id = s.user_id
        AND lower(ut.name) = lower(s.status)
    )
  `);

  await db.execute(`
    INSERT INTO anime_watchlist (user_id, mal_id, tag_id, title, type, episodes)
    SELECT
      aw.user_id,
      aw.mal_id,
      ut.id,
      aw.title,
      aw.type,
      aw.episodes
    FROM anime_watchlist_old aw
    JOIN user_tags ut
      ON ut.user_id = aw.user_id
     AND lower(ut.name) = lower(aw.status)
  `);

  await db.execute(`
    INSERT INTO manga_watchlist (user_id, mal_id, tag_id)
    SELECT
      mw.user_id,
      mw.mal_id,
      ut.id
    FROM manga_watchlist_old mw
    JOIN user_tags ut
      ON ut.user_id = mw.user_id
     AND lower(ut.name) = lower(mw.status)
  `);

  await db.batch(['DROP TABLE anime_watchlist_old', 'DROP TABLE manga_watchlist_old']);

  console.log('Watchlist tag_id migration complete');
}

async function migrateAnimeDataTable(): Promise<void> {
  const db = getDb();

  const tables = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='anime_data'"
  );

  if (tables.rows.length > 0) {
    return;
  }

  console.log('Creating anime_data table...');

  await db.execute(`
    CREATE TABLE anime_data (
      mal_id INTEGER PRIMARY KEY,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      title_english TEXT,
      type TEXT,
      episodes INTEGER,
      aired_from TEXT,
      aired_to TEXT,
      score REAL,
      scored_by INTEGER,
      rank INTEGER,
      status TEXT,
      popularity INTEGER,
      members INTEGER,
      favorites INTEGER,
      synopsis TEXT,
      year INTEGER,
      season TEXT,
      image TEXT,
      genres TEXT,
      themes TEXT,
      demographics TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.batch([
    'CREATE INDEX idx_anime_score ON anime_data(score)',
    'CREATE INDEX idx_anime_year ON anime_data(year)',
    'CREATE INDEX idx_anime_members ON anime_data(members)',
    'CREATE INDEX idx_anime_favorites ON anime_data(favorites)',
  ]);
}

async function migrateWatchlistIndexes(): Promise<void> {
  const db = getDb();

  await db.batch([
    'CREATE INDEX IF NOT EXISTS idx_watchlist_user ON anime_watchlist(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_watchlist_tag_id ON anime_watchlist(tag_id)',
    'CREATE INDEX IF NOT EXISTS idx_manga_watchlist_user ON manga_watchlist(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_manga_watchlist_tag_id ON manga_watchlist(tag_id)',
    'CREATE INDEX IF NOT EXISTS idx_user_tags_user ON user_tags(user_id)',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_user_tags_user_name ON user_tags(user_id, name)',
  ]);
}

async function migrateAnimeCreatedAt(): Promise<void> {
  const db = getDb();
  const info = await db.execute('PRAGMA table_info(anime_data)');
  const hasCreatedAt = info.rows.some((row) => row.name === 'created_at');
  if (hasCreatedAt) return;

  await db.execute('ALTER TABLE anime_data ADD COLUMN created_at TEXT');
  await db.execute('UPDATE anime_data SET created_at = updated_at WHERE created_at IS NULL');
}

async function migrateScheduleTable(): Promise<void> {
  const exists = await tableExists('anime_schedule');
  if (exists) return;

  const db = getDb();
  console.log('Creating anime_schedule table...');
  await db.batch([
    `CREATE TABLE IF NOT EXISTS anime_schedule (
      user_id TEXT NOT NULL,
      mal_id TEXT NOT NULL,
      episodes_per_day INTEGER NOT NULL DEFAULT 3,
      sort_order INTEGER NOT NULL DEFAULT 0,
      episodes_watched INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, mal_id)
    )`,
    'CREATE INDEX IF NOT EXISTS idx_schedule_user ON anime_schedule(user_id)',
  ]);
}

export async function migrateScheduleEpisodesWatched(): Promise<void> {
  const db = getDb();
  const exists = await tableExists('anime_schedule');
  if (!exists) return;
  const col = await hasColumn('anime_schedule', 'episodes_watched');
  if (col) return;
  console.log('Adding episodes_watched column to anime_schedule...');
  await db.execute(
    'ALTER TABLE anime_schedule ADD COLUMN episodes_watched INTEGER NOT NULL DEFAULT 0'
  );
}

export async function migrateAnimeWatchlistNotes(): Promise<void> {
  const exists = await tableExists('anime_watchlist');
  if (!exists) return;

  const col = await hasColumn('anime_watchlist', 'note');
  if (col) return;

  console.log('Adding note column to anime_watchlist...');
  const db = getDb();
  await db.execute('ALTER TABLE anime_watchlist ADD COLUMN note TEXT');
}

export async function migrateAnimeDetailCache(): Promise<void> {
  const db = getDb();
  await db.batch([
    `CREATE TABLE IF NOT EXISTS anime_relations_cache (
      mal_id INTEGER PRIMARY KEY,
      payload TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )`,
    `CREATE TABLE IF NOT EXISTS anime_recommendations_cache (
      mal_id INTEGER PRIMARY KEY,
      payload TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )`,
    'CREATE INDEX IF NOT EXISTS idx_anime_relations_cache_fetched_at ON anime_relations_cache(fetched_at)',
    'CREATE INDEX IF NOT EXISTS idx_anime_recommendations_cache_fetched_at ON anime_recommendations_cache(fetched_at)',
  ]);

  const legacyExists = await tableExists('anime_detail_cache');
  if (!legacyExists) return;

  console.log('Migrating legacy anime_detail_cache data...');
  await db.batch([
    `INSERT INTO anime_relations_cache (mal_id, payload, fetched_at)
     SELECT
       mal_id,
       COALESCE(relations_json, '[]'),
       COALESCE(relations_fetched_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     FROM anime_detail_cache
     WHERE relations_json IS NOT NULL
     ON CONFLICT(mal_id) DO UPDATE SET
       payload = excluded.payload,
       fetched_at = excluded.fetched_at`,
    `INSERT INTO anime_recommendations_cache (mal_id, payload, fetched_at)
     SELECT
       mal_id,
       COALESCE(recommendations_json, '[]'),
       COALESCE(recommendations_fetched_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     FROM anime_detail_cache
     WHERE recommendations_json IS NOT NULL
     ON CONFLICT(mal_id) DO UPDATE SET
       payload = excluded.payload,
       fetched_at = excluded.fetched_at`,
    'DROP TABLE anime_detail_cache',
  ]);
}

export async function runAllMigrations(): Promise<void> {
  await migrateWatchlistTables();
  await migrateUserTagsTable();
  await migrateWatchlistToTagIds();
  // Keep user-created and restored tags intact; do not auto-collapse legacy names into Done.
  await migrateAnimeDataTable();
  await migrateWatchlistIndexes();
  await migrateAnimeCreatedAt();
  await migrateScheduleTable();
  await migrateScheduleEpisodesWatched();
  await migrateAnimeWatchlistNotes();
  await migrateAnimeDetailCache();
  console.log('All migrations completed');
}
