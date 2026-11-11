// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getAllAnime, getSimpleAnimeSearchPage } from './animeData';
import { getAllManga } from './mangaData';
import { setDbClient, type DatabaseStatement } from './client';
import { getScoreSortedList } from '../utils/statistics';
import { filterRequestSchema } from '../validators/animeFilters';
import { mangaFilterRequestSchema } from '../validators/mangaFilters';
import { mangaStore } from '../store/mangaStore';
import { registerMangaRoutes } from '../worker/mangaRoutes';

let db: DatabaseSync;
const rows = [
  [10, '2026-01-01T09:00:00Z', '2026-11-11 09:00:00', 2026],
  [20, '2026-10-01T09:00:00Z', '2026-11-11 08:00:00', 2026],
  [30, '2026-10-01T14:30:00+05:30', '2026-11-11T13:30:00+05:30', 2026],
  [40, null, 'invalid', 2025],
  [50, 'invalid', null, null],
  [60, '2026-10-01T09:00:00.001Z', '2026-11-11 08:00:00.001', 2026],
  [70, '1960-01-01', '1960-01-01', 1960],
] as const;

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../../migrations/d1/0001_initial.sql', import.meta.url), 'utf8'));
  for (const table of ['anime_data', 'manga_data']) {
    const released = table === 'anime_data' ? 'aired_from' : 'published_from';
    const insert = db.prepare(
      `INSERT INTO ${table} (mal_id, url, title, ${released}, created_at, year) VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const [id, release, added, year] of rows) {
      insert.run(
        id,
        `https://example.invalid/${id}`,
        `Title ${id}`,
        release,
        table === 'manga_data' && added === null ? 'invalid' : added,
        year
      );
    }
  }
  const execute = async (statement: DatabaseStatement) => {
    const { sql, args = [] } = typeof statement === 'string' ? { sql: statement } : statement;
    return {
      rows: db.prepare(sql).all(...(args as (string | number | null)[])),
      rowsAffected: 0,
    };
  };
  setDbClient({ execute, batch: (statements) => Promise.all(statements.map(execute)) });
});

afterEach(() => {
  mangaStore.clearStore();
  db.close();
});

describe('catalog time sorting', () => {
  it.each([filterRequestSchema, mangaFilterRequestSchema])(
    'accepts separate time sorts and maps the legacy time alias to catalog addition',
    (schema) => {
      for (const sortBy of ['released_at', 'created_at', 'year']) {
        expect(schema.parse({ filters: [], sortBy }).sortBy).toBe(sortBy);
      }
      expect(schema.parse({ filters: [], sortBy: 'time' }).sortBy).toBe('created_at');
    }
  );

  it('retains original catalog timestamps when loading anime and manga', async () => {
    expect((await getAllAnime())[0]).toHaveProperty('created_at', '2026-11-11 09:00:00');
    expect((await getAllManga())[0]).toHaveProperty('created_at', '2026-11-11 09:00:00');
  });

  it.each([
    ['released_at', [60, 20, 30, 10, 40, 70, 50]],
    ['created_at', [10, 60, 20, 30, 70, 40, 50]],
  ] as const)(
    'keeps SQL and cached %s ordering identical through pagination',
    async (sortBy, expected) => {
      const parsed = filterRequestSchema.parse({ filters: [], sortBy });
      const list = await getAllAnime();
      const cached = getScoreSortedList([...list].reverse(), [], parsed.sortBy);
      expect(cached.map((item) => item.mal_id)).toEqual(expected);
      const sql = await getSimpleAnimeSearchPage({ ...parsed, pagesize: 20 });
      expect(sql?.page.map((item) => item.mal_id)).toEqual(expected);
      expect(sql?.page.map((item) => item.points)).toEqual(cached.map((item) => item.points));

      const paged = await getSimpleAnimeSearchPage({ ...parsed, pagesize: 2, offset: 1 });
      const cachedPage = getScoreSortedList([...list].reverse(), [], parsed.sortBy, 3).slice(1, 3);
      expect(paged?.page.map((item) => item.mal_id)).toEqual(expected.slice(1, 3));
      expect(cachedPage.map((item) => item.mal_id)).toEqual(expected.slice(1, 3));
    }
  );

  it.each([
    ['released_at', [20, 30]],
    ['created_at', [60, 20]],
  ] as const)(
    'serves a stable newest-first manga %s page through HTTP',
    async (sortBy, expected) => {
      const app = new Hono();
      const auth = async (_c: unknown, next: () => Promise<void>) => next();
      registerMangaRoutes(app, { requireAuth: auth, optionalAuth: auth });
      await mangaStore.setMangaList((await getAllManga()).reverse());
      const response = await app.request('/api/manga/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters: [], sortBy, pagesize: 2, offset: 1 }),
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.totalFiltered).toBe(rows.length);
      expect(body.filteredList.map((item: { id: number }) => item.id)).toEqual(expected);
    }
  );
});
