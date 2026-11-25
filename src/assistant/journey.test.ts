// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import worker from '../worker';
import { bindD1Database } from '../db/client';
import { createApiToken } from '../db/apiTokens';

const sqlite = new DatabaseSync(':memory:');
function prepare(sql: string, args: (number | string | null)[] = []) {
  return {
    bind: (...values: typeof args) => prepare(sql, values),
    all: () => ({ results: sqlite.prepare(sql).all(...args), meta: { changes: 1 } }),
  };
}
const fixtureDb = {
  prepare,
  withSession: () => fixtureDb,
  batch: async (statements: ReturnType<typeof prepare>[]) => {
    sqlite.exec('BEGIN');
    try {
      const output = statements.map((s) => s.all());
      sqlite.exec('COMMIT');
      return output;
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }
  },
};
const env = {
  DB: fixtureDb as unknown as D1Database,
  JWT_SECRET: 'fixture-only',
  GOOGLE_CLIENT_ID: 'fixture',
};
const ctx = { waitUntil: () => {} } as unknown as ExecutionContext;
let reader = '',
  writer = '',
  second = '';
async function call(name: string, args: Record<string, unknown>, token = writer) {
  const request = new Request('https://fixture.invalid/api/mcp', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  });
  const res = await worker.fetch(request, env, ctx);
  if (!res.ok) throw new Error('MCP HTTP status ' + res.status);
  return (await res.json()).result;
}
beforeAll(async () => {
  const dir = new URL('../../migrations/d1/', import.meta.url);
  for (const file of readdirSync(dir)
    .filter((n) => n.endsWith('.sql'))
    .sort())
    sqlite.exec(readFileSync(new URL(file, dir), 'utf8'));
  bindD1Database(env.DB);
  reader = (await createApiToken('a', 'reader')).token;
  writer = (await createApiToken('a', 'writer', true)).token;
  second = (await createApiToken('b', 'writer', true)).token;
  for (let i = 1; i <= 8; i++)
    sqlite
      .prepare(
        'INSERT INTO anime_data(mal_id,title,url,year,score,genres,themes,synopsis) VALUES(?,?,?,2024,?, ?, ?,?)'
      )
      .run(
        i,
        'Fantasy season ' + i,
        'https://example.invalid/' + i,
        i === 8 ? 6 : 8,
        '{"Fantasy":1}',
        '{"Isekai":1}',
        'A reincarnated hero learns magic in another world.'
      );
  sqlite.exec(
    "INSERT INTO manga_data(mal_id,title,url,score) VALUES(1,'Fantasy manga','https://example.invalid/m1',8)"
  );
});
afterAll(() => sqlite.close());

describe('scoped MCP tracking journey', () => {
  const key = { media_type: 'anime', catalog_id: 1 };
  const set = {
    entries: [{ ...key, watch_status: 'Watching', personal_rating: 8 }],
    user_authorized: true,
  };
  it('requires a write grant and user intent, including at alternative REST entry points', async () => {
    expect((await call('upsert_watchlist_entries', set, reader)).structuredContent.error.code).toBe(
      'forbidden'
    );
    expect(
      (await call('upsert_watchlist_entries', { entries: set.entries })).structuredContent.error
        .code
    ).toBe('invalid_argument');
    for (const path of ['watched/add', 'manga/watched/add', 'tokens']) {
      const res = await worker.fetch(
        new Request('https://fixture.invalid/api/' + path, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + reader, 'Content-Type': 'application/json' },
          body: '{}',
        }),
        env,
        ctx
      );
      expect(res.status).toBe(403);
    }
    expect(sqlite.prepare('SELECT count(*) AS n FROM anime_watchlist').get()?.n).toBe(0);
  });
  it('tracks seven exact seasons, preserves ratings, isolates owners and supports manga with the same ID', async () => {
    expect((await call('upsert_watchlist_entries', set)).structuredContent.succeeded).toBe(1);
    const bulk = {
      entries: Array.from({ length: 7 }, (_, i) => ({
        ...key,
        catalog_id: i + 1,
        watch_status: 'Done',
      })),
      user_authorized: true,
    };
    for (let retry = 0; retry < 2; retry++)
      expect((await call('upsert_watchlist_entries', bulk)).structuredContent.succeeded).toBe(7);
    const page = (await call('get_watchlist', { watch_statuses: ['Done'], limit: 4 }, reader))
      .structuredContent;
    expect(page).toMatchObject({ total: 7, returned: 4, nextOffset: 4 });
    expect(
      (await call('get_watchlist', { min_personal_rating: 8 }, reader)).structuredContent.items
    ).toMatchObject([{ catalog_id: 1, personal_rating: 8 }]);
    expect((await call('get_watchlist', {}, second)).structuredContent.total).toBe(0);
    const manga = { media_type: 'manga', catalog_id: 1, watch_status: 'Delaying' };
    expect(
      (await call('upsert_watchlist_entries', { entries: [manga], user_authorized: true }))
        .structuredContent.succeeded
    ).toBe(1);
    expect(
      (
        await call('upsert_watchlist_entries', {
          entries: [{ ...key, personal_rating: null }],
          user_authorized: true,
        })
      ).structuredContent.results[0].entry
    ).toMatchObject({ watch_status: 'Done', personal_rating: null });
    expect(
      (
        await call('remove_watchlist_entries', {
          entries: [manga].map(({ media_type, catalog_id }) => ({ media_type, catalog_id })),
          user_authorized: true,
        })
      ).structuredContent.succeeded
    ).toBe(1);
    expect((await call('get_watchlist', {}, reader)).structuredContent.total).toBe(7);
  });
  it('uses saved hard constraints, account history, and temporary overrides through the actual protocol', async () => {
    await call('update_user_preferences', {
      hard_filters: { min_score: 7 },
      user_authorized: true,
    });
    const fresh = (await call('discover_titles', { media_type: 'anime' })).structuredContent;
    expect(fresh.results).toEqual([]);
    const retry = (
      await call('discover_titles', { media_type: 'anime', filters: { min_score: 5 } })
    ).structuredContent;
    expect(retry.results.map((row: { mal_id: number }) => row.mal_id)).toEqual([8]);
    const stats = (await call('get_watchlist_stats', { media_type: 'anime' })).structuredContent;
    expect(stats.total).toBe(7);
    expect(stats.by_status).toContainEqual({ label: 'Done', count: 7 });
    const foreign = (await call('get_user_preferences', {}, second)).structuredContent;
    expect(foreign.hard_filters.min_score).toBeUndefined();
    const publicResult = (
      await call('semantic_search', { media_type: 'anime', query: 'magic' }, '')
    ).structuredContent;
    expect(publicResult.results.length).toBeGreaterThan(0);
  });
});

it('imports historical completions through the website without inventing or overwriting dates', async () => {
  async function post(path: string, body: unknown) {
    const response = await worker.fetch(
      new Request('https://fixture.invalid/api/' + path, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + second, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      env,
      ctx
    );
    expect(response.status).toBe(200);
    return response.json();
  }
  await post('watched/add', { mal_ids: ['102'], status: 'Watching' });
  await post('watched/add', { mal_ids: ['103'], status: 'Done' });
  const dates = () =>
    sqlite
      .prepare(
        "SELECT mal_id, completed_at FROM assistant_library WHERE user_id='b' AND media='anime' AND mal_id IN ('101','102','103') ORDER BY mal_id"
      )
      .all();
  const known = dates()[1].completed_at;
  expect(known).toEqual(expect.any(String));
  const body = {
    source: 'shelf',
    mode: 'replace',
    payload: JSON.stringify({
      anime: ['101', '102', '103'].map((id) => ({ id, status: 'Completed' })),
    }),
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    expect(await post('watchlist/import/apply', body)).toMatchObject({ imported: 3 });
    expect(dates()).toEqual([
      { mal_id: '101', completed_at: null },
      { mal_id: '102', completed_at: null },
      { mal_id: '103', completed_at: known },
    ]);
  }
});
