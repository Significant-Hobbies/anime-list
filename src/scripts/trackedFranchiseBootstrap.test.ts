// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { DatabaseClient, DatabaseStatement } from '../db/client';
import { prepareD1Import } from '../../scripts/lib/d1-import.mjs';
import { bootstrapTrackedFranchises } from './trackedFranchiseBootstrap';

let db: DatabaseSync;
let client: DatabaseClient;
beforeEach(() => {
  db = new DatabaseSync(':memory:');
  for (const migration of [
    '0001_initial',
    '0006_assistant_franchises',
    '0010_franchise_release_observations',
  ])
    db.exec(readFileSync('migrations/d1/' + migration + '.sql', 'utf8'));
  const execute = async (stmt: DatabaseStatement) => {
    const { sql, args = [] } = typeof stmt === 'string' ? { sql: stmt } : stmt;
    return { rows: db.prepare(sql).all(...(args as (number | string | null)[])), rowsAffected: 0 };
  };
  client = { execute, batch: async (statements) => Promise.all(statements.map(execute)) };
});
afterEach(() => db.close());

it('continues from tracked origins through newly discovered cross-media links and counts unavailable sources', async () => {
  db.exec(
    "INSERT INTO anime_watchlist(user_id,mal_id,tag_id) VALUES('u','1','done'); INSERT INTO manga_watchlist VALUES('u','2','done');"
  );
  const reader = {
    full: vi.fn(async (media: string, id: number) => {
      if (media === 'manga' && id === 2) return null;
      const edge = {
        relation: 'Adaptation',
        entry: [
          { mal_id: 1, type: 'manga', url: 'https://example.com', name: 'A different title' },
        ],
      };
      return {
        data: {
          mal_id: id,
          title: media + ' ' + id,
          status: media === 'manga' ? 'Publishing' : 'Finished Airing',
          relations: media === 'anime' ? [edge] : [],
        },
      };
    }),
  };
  const bounded = await bootstrapTrackedFranchises(client, reader, 1, () => {});
  expect(bounded.coverage).toEqual([
    { media: 'anime', scope: 'tracked_origin', known: 1, indexed: 1, pending: 0, deferred: 0 },
    { media: 'manga', scope: 'tracked_origin', known: 1, indexed: 0, pending: 1, deferred: 0 },
    { media: 'manga', scope: 'related', known: 1, indexed: 0, pending: 1, deferred: 0 },
  ]);
  const next = await bootstrapTrackedFranchises(client, reader, 20, () => {});
  expect(next).toMatchObject({
    fetched: 1,
    provider_missing: 1,
    coverage: [{ indexed: 1 }, { indexed: 0, deferred: 1 }, { indexed: 1 }],
  });
  expect((await bootstrapTrackedFranchises(client, reader, 20, () => {})).fetched).toBe(0);
  expect(reader.full.mock.calls).toEqual([
    ['anime', 1],
    ['manga', 2],
    ['manga', 1],
  ]);
});
it('replays saved franchise observations without creating new release events', () => {
  const dump = [
    "INSERT INTO assistant_release_events(id,mal_id,observed_at,previous_status,status) VALUES(42,1,'2026-01-01','Not yet aired','Currently Airing');",
    "INSERT INTO assistant_anime_details(mal_id,title,aliases,studios,streaming,status,updated_at) VALUES(1,'Example','[]','[]','[]','Currently Airing','2026-01-01');",
  ].join('\n');
  const { chunks } = prepareD1Import(dump);
  for (let n = 0; n < 2; n++) for (const chunk of chunks) db.exec(chunk);
  expect(
    db.prepare('SELECT id,mal_id,previous_status,status FROM assistant_release_events').all()
  ).toEqual([{ id: 42, mal_id: 1, previous_status: 'Not yet aired', status: 'Currently Airing' }]);
});
