// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { backfillCatalogMetadata } from './catalogMetadataBackfill';
import { createMetadataReader, type Media } from './catalogMetadataProvider';
import type { DatabaseClient, DatabaseStatement } from '../db/client';

let sqlite: DatabaseSync;
let client: DatabaseClient;
const names = (mal_id: number, media: Media = 'anime') => ({
  mal_id,
  titles: [{ title: media + ' ' + mal_id }],
  title_synonyms: ['other ' + mal_id],
  title_japanese: null,
  studios: media === 'anime' ? [{ name: 'Studio' }] : undefined,
});
const listed = (n: number, last: number, ids: number[]) => ({
  data: ids.map((i) => names(i)),
  pagination: { current_page: n, last_visible_page: last, has_next_page: n < last },
});
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('migrations/d1/0001_initial.sql', 'utf8'));
  sqlite.exec(readFileSync('migrations/d1/0008_catalog_title_metadata.sql', 'utf8'));
  const execute = async (s: DatabaseStatement) => {
    const { sql, args = [] } = typeof s === 'string' ? { sql: s } : s;
    return {
      rows: sqlite.prepare(sql).all(...(args as (number | string | null)[])),
      rowsAffected: 0,
    };
  };
  client = { execute, batch: async (statements) => Promise.all(statements.map(execute)) };
});
afterEach(() => sqlite.close());
function add(media: Media, start: number, end: number) {
  const insert = sqlite.prepare(`INSERT INTO ${media}_data(mal_id,title,url) VALUES(?,?,?)`);
  for (let id = start; id <= end; id++) insert.run(id, 'Original ' + id, 'original');
}
it('backfills captured IDs only, keeps daily updates and resumes across a failed provider page', async () => {
  add('anime', 401, 1101);
  const fetchPage = vi.fn(async (_media: Media, p: number) => {
    if (p === 8) throw new Error('transient failure');
    return listed(
      p,
      12,
      Array.from({ length: 100 }, (_, i) => (p - 1) * 100 + i + 1)
    );
  });
  const reader = { page: fetchPage, detail: vi.fn(async (_media: Media, id: number) => names(id)) };
  await expect(backfillCatalogMetadata(client, reader, 'anime', () => {})).rejects.toThrow(
    'transient failure'
  );
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM catalog_title_metadata').get()?.n).toBe(300);
  fetchPage.mockClear();
  fetchPage.mockImplementation(async (_media, p) => {
    if (p === 11) {
      sqlite.exec(
        "INSERT OR IGNORE INTO catalog_title_metadata VALUES('anime',1050,'[\"Daily\"]','[]'); DELETE FROM anime_data WHERE mal_id=1080"
      );
    }
    return listed(
      p,
      11,
      Array.from({ length: 100 }, (_, i) => (p - 1) * 100 + i + 1)
    );
  });
  // The provider may shift IDs between page snapshots. ID 1101 must be filled by exact lookup.
  fetchPage.mockImplementationOnce(async () =>
    listed(
      1,
      11,
      Array.from({ length: 100 }, (_, i) => i + 1)
    )
  );
  const result = await backfillCatalogMetadata(client, reader, 'anime', () => {});
  expect(result).toMatchObject({
    catalog: 700,
    with_metadata: 700,
    with_aliases: 700,
    with_studios: 699,
  });
  expect(fetchPage.mock.calls.map((c) => c[1])).not.toContain(2);
  expect(reader.detail).toHaveBeenCalledWith('anime', 1101);
  expect(
    sqlite.prepare('SELECT aliases FROM catalog_title_metadata WHERE mal_id=1050').get()?.aliases
  ).toBe('["Daily"]');
  expect(
    sqlite
      .prepare('SELECT COUNT(*) AS n FROM catalog_title_metadata WHERE mal_id<401 OR mal_id=1080')
      .get()?.n
  ).toBe(0);
  expect(sqlite.prepare('SELECT title FROM anime_data WHERE mal_id=602').get()?.title).toBe(
    'Original 602'
  );
  fetchPage.mockClear();
  reader.detail.mockClear();
  await backfillCatalogMetadata(client, reader, 'anime', () => {});
  expect(fetchPage).not.toHaveBeenCalled();
  expect(reader.detail).not.toHaveBeenCalled();
});
it('scopes sparse direct reads by medium; retains source 404s as uncovered', async () => {
  add('anime', 1, 1);
  add('manga', 1, 2);
  const reader = {
    page: vi.fn(),
    detail: vi.fn(async (m: Media, id: number) => (id === 2 ? null : names(id, m))),
  };
  const result = await backfillCatalogMetadata(client, reader, 'manga', () => {});
  expect(result).toMatchObject({
    catalog: 2,
    with_metadata: 1,
    with_studios: 0,
    source_not_found_ids: [2],
  });
  expect(reader.detail.mock.calls).toEqual([
    ['manga', 1],
    ['manga', 2],
  ]);
  expect(sqlite.prepare('SELECT media,aliases FROM catalog_title_metadata').all()).toEqual([
    { media: 'manga', aliases: '["manga 1","other 1"]' },
  ]);
});
it('honors Retry-After, validates page order, and rejects mismatched provider IDs', async () => {
  const wait = vi.fn(async () => {});
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '9' } }))
    .mockResolvedValueOnce(Response.json(listed(1, 1, [1, 2])))
    .mockResolvedValueOnce(Response.json(listed(2, 2, [5, 3])))
    .mockResolvedValueOnce(Response.json({ data: names(77) }));
  const reader = createMetadataReader(request, wait);
  expect((await reader.page('anime', 1)).data.map((r) => r.mal_id)).toEqual([1, 2]);
  expect(wait).toHaveBeenCalledWith(9000);
  await expect(reader.page('anime', 2)).rejects.toThrow('Invalid Tenrai sorted page');
  await expect(reader.detail('manga', 76)).rejects.toThrow('mismatched manga ID');
});
