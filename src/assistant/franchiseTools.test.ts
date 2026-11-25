// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setDbClient, type DatabaseStatement } from '../db/client';
import { franchiseTools, releaseState } from './franchiseTools';
import { refreshFranchiseIndex } from './franchiseCatalog';
import { refreshTitle } from './franchiseProvider';

let db: DatabaseSync;
const now = () => new Date().toISOString();
function cached(id: number, edges: { id: number; media?: string; rel: string }[] = []) {
  const payload = edges.map((e) => ({
    relation: e.rel,
    entries: [
      {
        mal_id: e.id,
        type: e.media ?? 'anime',
        name: 'Title ' + e.id,
        url: 'https://myanimelist.net',
      },
    ],
  }));
  db.prepare(
    'INSERT INTO anime_relations_cache VALUES(?,?,?) ON CONFLICT(mal_id) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at'
  ).run(id, JSON.stringify(payload), now());
}
const exec = async (statement: DatabaseStatement) => {
  const { sql, args = [] } = typeof statement === 'string' ? { sql: statement } : statement;
  return { rows: db.prepare(sql).all(...(args as (number | string | null)[])), rowsAffected: 0 };
};
const call = (name: string, args: Record<string, unknown>, userId = 'u1') =>
  franchiseTools.find((t) => t.name === name)!.execute(args, { userId, env: {} }) as Promise<any>;
beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec(readFileSync('migrations/d1/0001_initial.sql', 'utf8'));
  cached(1, [
    { id: 2, rel: 'Sequel' },
    { id: 1, media: 'manga', rel: 'Adaptation' },
    { id: 4, rel: 'Character' },
  ]);
  db.exec(readFileSync('migrations/d1/0006_assistant_franchises.sql', 'utf8'));
  db.exec('CREATE TABLE assistant_library(user_id TEXT,media TEXT,mal_id TEXT,status TEXT)');
  setDbClient({ execute: exec, batch: async (stmts) => Promise.all(stmts.map(exec)) });
  for (const [id, from, status] of [
    [1, '2020-01-01', 'Finished Airing'],
    [2, '2019-01-01', 'Finished Airing'],
    [3, '2098-01-01', 'Not yet aired'],
  ]) {
    db.prepare(
      'INSERT INTO anime_data(mal_id,title,url,aired_from,status,synopsis) VALUES(?,?,?,?,?,?)'
    ).run(id, 'Anime ' + id, 'https://example.com', from, status, 'Plot ' + id);
  }
  cached(2, [
    { id: 3, rel: 'Sequel' },
    { id: 1, rel: 'Prequel' },
  ]);
  cached(3);
  db.prepare(
    "INSERT INTO assistant_manga_details(mal_id,title,aliases,updated_at) VALUES(1,'Distinct manga','[]',?)"
  ).run(now());
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('unexpected outbound request');
    })
  );
});
afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('ID-backed franchise reads', () => {
  it('walks mixed-media graph transitively from either namespace; paged ordering respects prequels and omits plots by default', async () => {
    const first = await call('get_franchise', {
      mal_id: 1,
      media: 'manga',
      order: 'prequel_first',
      limit: 2,
    });
    const second = await call('get_franchise', {
      mal_id: 2,
      order: 'prequel_first',
      limit: 2,
      offset: first.next_offset,
    });
    const items = [...first.items, ...second.items];
    expect(first.coverage.complete).toBe(true);
    expect(first.franchise_id).toBe(second.franchise_id);
    expect(items.map((x) => x.media + ':' + x.mal_id)).toEqual([
      'anime:1',
      'anime:2',
      'anime:3',
      'manga:1',
    ]);
    expect(items[0]).toMatchObject({
      title: 'Anime 1',
      relations: expect.arrayContaining([
        { mal_id: 4, relation: 'character', media: 'anime', title: 'Title 4' },
      ]),
    });
    expect(JSON.stringify(items)).not.toContain('Plot ');
    expect(
      (await call('get_franchise', { mal_id: 1, summary: 'provider_synopsis' })).items.map(
        (x) => x.synopsis
      )
    ).toContain('Plot 1');
    cached(1, []);
    cached(2, []);
    expect((await call('get_franchise', { mal_id: 1 })).total).toBe(1);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('walks provider IDs through completed sequels and scopes exclusions to the requesting owner', async () => {
    db.exec(
      "INSERT INTO assistant_library VALUES('u1','anime','1','Done'),('u1','anime','2','Watching'),('u2','anime','2','Done'),('u2','anime','3','Done')"
    );
    const released = await call('get_released_sequels', {});
    expect(released.items).toEqual([]);
    db.exec("UPDATE assistant_library SET status='Delaying' WHERE user_id='u1' AND mal_id='2'");
    const delayed = await call('get_released_sequels', {});
    expect(delayed.items.map((i) => [i.mal_id, i.origin_ids])).toEqual([[2, [1]]]);
    const upcoming = await call('get_upcoming_sequels', {});
    expect(upcoming.items.map((i) => [i.mal_id, i.origin_ids])).toEqual([[3, [1]]]);
    expect(upcoming.coverage).toMatchObject({
      origins_and_descendants: 3,
      relation_records: 3,
      unknown_release_states: 0,
    });
    expect((await call('get_upcoming_sequels', {}, 'u2')).items).toEqual([]);
    expect(releaseState({ status: 'Not yet aired', start: '2000-01-01' }, '2020-01-01')).toBe(
      'unknown'
    );
  });
  it('indexes newly fetched manga and follows manga sequels separately from colliding anime IDs', async () => {
    db.exec("INSERT INTO assistant_library VALUES('u1','manga','9','Done')");
    const provider = vi.fn(async (url: string) => {
      const id = Number(url.match(/manga\/(\d+)/)?.[1]);
      return Response.json({
        data: {
          mal_id: id,
          title: 'Book ' + id,
          titles: [{ title: 'Alias ' + id }],
          status: 'Publishing',
          chapters: 3,
          published: { from: '2000-01-01' },
          relations:
            id === 9
              ? [
                  {
                    relation: 'Sequel',
                    entry: [
                      {
                        mal_id: 10,
                        type: 'manga',
                        name: 'Book 10',
                        url: 'https://myanimelist.net/manga/10',
                      },
                    ],
                  },
                ]
              : [],
        },
      });
    });
    vi.stubGlobal('fetch', provider);
    const seed = await call('get_franchise', { media: 'manga', mal_id: 9 });
    expect(seed.coverage).toMatchObject({ complete: false, missing_relation_records: 1 });
    const full = await call('get_franchise', { media: 'manga', mal_id: 9 });
    expect(full.coverage.complete).toBe(true);
    expect((await call('get_released_sequels', { media: 'manga' })).items).toMatchObject([
      { mal_id: 10, title: 'Book 10', media: 'manga', origin_ids: [9] },
    ]);
    expect(provider).toHaveBeenCalledTimes(2);
  });
  it('retains partial evidence when source fails and refuses to invent an unknown seed', async () => {
    cached(2, [{ rel: 'Sequel', id: 83 }]);
    const graph = await call('get_franchise', { mal_id: 1 });
    expect(graph.coverage).toMatchObject({ complete: false, missing_relation_records: 1 });
    expect(graph.items.find((i) => i.mal_id === 83).status).toBeNull();
    await expect(call('get_franchise', { mal_id: 1234 })).rejects.toMatchObject({
      code: 'upstream_unavailable',
    });
  });
  it('keeps premieres and continued broadcasts distinct and returns source continuation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          pagination: { current_page: 1, last_visible_page: 2, has_next_page: true },
          data: [
            {
              mal_id: 1,
              title: 'Continuing',
              year: 2024,
              season: 'winter',
              synopsis: 'Earlier plot',
            },
            { mal_id: 9, title: 'Premiere', year: 2025, season: 'spring', synopsis: 'Later plot' },
          ],
        })
      )
    );
    const page = await call('get_seasonal_anime', {
      year: 2025,
      season: 'spring',
      premieres_only: true,
    });
    expect(page.next_page).toBe(2);
    expect(page.items).toMatchObject([{ title: 'Premiere' }]);
    expect(page.items[0].synopsis).toBeUndefined();
  });
  it('polls new source observations per owner and keeps unchanged snapshots quiet', async () => {
    let status = 'Not yet aired',
      calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls++;
        const id = Number(url.match(/anime\/(\d+)/)?.[1]);
        return Response.json({
          data: {
            mal_id: id,
            title: 'Provider ' + id,
            status,
            streaming: [{ name: 'Stream', url: 'https://provider.example/title' }],
            relations: [],
          },
        });
      })
    );
    cached(2, []);
    await call('set_franchise_monitor', { mal_id: 3, enabled: true });
    expect(await refreshFranchiseIndex(1)).toMatchObject({ selected: 1, refreshed: 1 });
    const first = await call('get_franchise_updates', {});
    expect(first.items).toMatchObject([{ mal_id: 3, status, previous_status: null }]);
    await refreshTitle(3);
    expect((await call('get_franchise_updates', { after_id: first.last_id })).items).toEqual([]);
    status = 'Currently Airing';
    await refreshTitle(3);
    const updated = await call('get_franchise_updates', { after_id: first.last_id });
    expect(updated.items).toMatchObject([{ mal_id: 3, status, previous_status: 'Not yet aired' }]);
    expect((await call('get_franchise_updates', {}, 'u2')).items).toEqual([]);
    const streams = await call('get_streaming_links', { mal_id: 3 });
    expect(streams).toMatchObject({
      territory: 'unspecified',
      services: [{ name: 'Stream' }],
      stale: false,
    });
    expect(calls).toBe(3);
    await call('set_franchise_monitor', { mal_id: 3, enabled: false });
    expect((await call('get_franchise_updates', {})).items).toEqual([]);
  });
});
