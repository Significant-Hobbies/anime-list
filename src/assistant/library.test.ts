// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, afterEach, it, expect } from 'vitest';
import { setDbClient, type DatabaseStatement } from '../db/client';
import { libraryTools } from './libraryTools';
import { upsertLibraryEntry, manageLibraryTag, removeLibraryEntry } from './libraryWrite';
import { readLibraryPage, readLibraryEntry, libraryStats } from './library';
import { upsertAnimeWatchlist, getAnimeWatchlistEntry } from '../db/watchlist';

let db: DatabaseSync;
function migrate(name: string) {
  db.exec(readFileSync(new URL('../../migrations/d1/' + name + '.sql', import.meta.url), 'utf8'));
}
const anime = { media_type: 'anime' as const, catalog_id: 1 };
const manga = { media_type: 'manga' as const, catalog_id: 1 };
beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  migrate('0001_initial');
  migrate('0003_watching_schedule');
  db.exec(`INSERT INTO user_tags(id,user_id,name) VALUES ('ca','a','Completed'),('wb','b','Watching');
    INSERT INTO anime_data(mal_id,url,title,year,genres,themes) VALUES(1,'url','Cowboy Bebop',1998,'{"Action":1}','{"Space":1}');
    INSERT INTO manga_data(mal_id,url,title,year,genres) VALUES(1,'url','Monster',1994,'{"Mystery":1}');
    INSERT INTO anime_watchlist(user_id,mal_id,tag_id,note) VALUES ('a','1','ca','old'),('b','1','wb','secret');
  `);
  migrate('0004_assistant_library');
  function execute(statement: DatabaseStatement) {
    const { sql, args = [] } = typeof statement === 'string' ? { sql: statement } : statement;
    const rows = db.prepare(sql).all(...(args as (string | number | null)[]));
    return { rows, rowsAffected: 0 };
  }
  setDbClient({
    execute: async (s) => execute(s),
    batch: async (list) => {
      db.exec('BEGIN');
      try {
        const out = list.map(execute);
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  });
});
afterEach(() => db.close());
it('preserves historical dates, aliases, notes and owner isolation across web and assistant edits', async () => {
  expect(await readLibraryEntry('a', anime)).toMatchObject({
    watch_status: 'Done',
    legacy_status: 'Completed',
    created_at: null,
    updated_at: null,
    completed_at: null,
  });
  await upsertLibraryEntry('a', {
    ...anime,
    watch_status: 'Done',
    personal_rating: 9,
    tags: ['Favorites'],
    notes: 'new',
  });
  expect(await getAnimeWatchlistEntry('1', 'a')).toMatchObject({
    status: 'Completed',
    note: 'new',
  });
  const first = await readLibraryEntry('a', anime);
  await upsertLibraryEntry('a', {
    ...anime,
    watch_status: 'Done',
    personal_rating: 9,
    tags: ['favorites'],
    notes: 'new',
  });
  expect(await readLibraryEntry('a', anime)).toEqual(first);
  await upsertAnimeWatchlist(['1'], 'Watching', 'a');
  expect(await readLibraryEntry('a', anime)).toMatchObject({
    watch_status: 'Watching',
    personal_rating: 9,
    created_at: null,
  });
  expect(await readLibraryEntry('b', anime)).toMatchObject({
    notes: 'secret',
    personal_rating: null,
  });
  await upsertLibraryEntry('a', { ...anime, personal_rating: null, notes: null, tags: null });
  expect(await readLibraryEntry('a', anime)).toMatchObject({
    personal_rating: null,
    notes: null,
    tags: [],
  });
});
it('returns mixed batch outcomes, dates for both media, and idempotent removals', async () => {
  const write = libraryTools.find((t) => t.name === 'upsert_watchlist_entries')!;
  const result = await write.execute(
    {
      entries: [
        {
          ...manga,
          watch_status: 'Done',
          personal_rating: 8,
          notes: 'Read',
          completed_at: '2021-05-01T00:00:00Z',
        },
        { ...anime, catalog_id: 55, watch_status: 'Done' },
        { ...anime, catalog_id: 66, notes: 'New' },
      ],
    },
    { userId: 'a', env: {} }
  );
  expect(result).toMatchObject({
    succeeded: 1,
    failed: 2,
    results: [
      {
        entry: {
          notes: 'Read',
          personal_rating: 8,
          completed_at: '2021-05-01T00:00:00.000Z',
        },
      },
      { error: { code: 'not_found' } },
      { error: { code: 'invalid_argument' } },
    ],
  });
  await expect(removeLibraryEntry('b', manga)).resolves.toBe(false);
  await expect(readLibraryEntry('a', manga)).resolves.toMatchObject({
    created_at: expect.any(String),
  });
  await expect(removeLibraryEntry('a', manga)).resolves.toBe(true);
  await expect(removeLibraryEntry('a', manga)).resolves.toBe(false);
  expect(await readLibraryEntry('a', anime)).not.toBeNull();
  expect(db.prepare("SELECT count(*) n FROM library_details WHERE media='manga'").get()?.n).toBe(0);
});
it('paginates past fifty, filters private ratings and tags and reports filtered stats', async () => {
  await upsertLibraryEntry('a', { ...anime, personal_rating: 9, tags: ['favorite', 'series'] });
  await upsertLibraryEntry('a', {
    ...manga,
    watch_status: 'Done',
    personal_rating: 7,
    tags: ['series'],
  });
  db.exec(`WITH RECURSIVE n(id) AS (SELECT 2 UNION ALL SELECT id+1 FROM n WHERE id<60)
    INSERT INTO anime_watchlist(user_id,mal_id,tag_id) SELECT 'a',CAST(id AS TEXT),'ca' FROM n`);
  const page = await readLibraryPage('a', { limit: 50, offset: 0 });
  expect(page.total).toBe(61);
  const next = await readLibraryPage('a', { limit: 50, offset: page.nextOffset! });
  expect(next.items).toHaveLength(11);
  expect(next.nextOffset).toBeNull();
  const filters = { tags: ['series'], watch_statuses: ['Done'], min_personal_rating: 8 };
  const picked = await readLibraryPage('a', { ...filters, limit: 50, offset: 0 });
  expect(picked.items.map((e) => e.title)).toEqual(['Cowboy Bebop']);
  const stats = await libraryStats('a', filters);
  expect(stats).toMatchObject({
    total: 1,
    average_personal_rating: 9,
    by_year: [{ label: '1998', count: 1 }],
    by_genre: [{ label: 'Action', count: 1 }],
    by_theme: [{ label: 'Space', count: 1 }],
    highest_rated: [{ catalog_id: 1 }],
  });
});
it('renames and deletes classification tags independently of tracking status and the other owner', async () => {
  for (const user of ['a', 'b']) await upsertLibraryEntry(user, { ...anime, tags: ['fav'] });
  await manageLibraryTag('a', 'rename', 'fav', 'favorites');
  expect(await readLibraryEntry('a', anime)).toMatchObject({
    watch_status: 'Done',
    tags: ['favorites'],
  });
  expect(await readLibraryEntry('b', anime)).toMatchObject({ tags: ['fav'] });
  await manageLibraryTag('a', 'create', 'later');
  await expect(manageLibraryTag('a', 'rename', 'favorites', 'later')).rejects.toThrow(
    'already in use'
  );
  await manageLibraryTag('a', 'delete', 'favorites');
  expect(await readLibraryEntry('a', anime)).toMatchObject({ watch_status: 'Done', tags: [] });
});

it('reports later storage failure without losing earlier successes and re-reads the affected entry', async () => {
  db.exec(
    "CREATE TRIGGER fail_rating BEFORE UPDATE OF rating ON library_details WHEN NEW.media='anime' BEGIN SELECT RAISE(ABORT,'private storage message'); END;"
  );
  const tool = libraryTools.find((t) => t.name === 'upsert_watchlist_entries')!;
  const response = await tool.execute(
    {
      entries: [
        { ...manga, watch_status: 'Watching', personal_rating: 7 },
        { ...anime, notes: 'rolled back', personal_rating: 9 },
      ],
    },
    { userId: 'a', env: {} }
  );
  expect(response).toMatchObject({
    succeeded: 1,
    failed: 1,
    results: [
      { ok: true, entry: { personal_rating: 7 } },
      {
        ok: false,
        error: { code: 'upstream_unavailable' },
        observed_entry: { notes: 'old', personal_rating: null },
      },
    ],
  });
  expect(JSON.stringify(response)).not.toContain('private storage message');
});
