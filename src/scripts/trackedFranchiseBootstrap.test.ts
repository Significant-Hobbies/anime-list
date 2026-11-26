// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { DatabaseClient, DatabaseStatement } from '../db/client';
import { prepareD1Import } from '../../scripts/lib/d1-import.mjs';
import { franchiseSnapshotStatements } from '../assistant/franchiseProvider';
import { ProviderUnavailableError } from './catalogMetadataProvider';
import { bootstrapTrackedFranchises } from './trackedFranchiseBootstrap';

let db: DatabaseSync;
let client: DatabaseClient;
beforeEach(() => {
  db = new DatabaseSync(':memory:');
  for (const migration of [
    '0001_initial',
    '0006_assistant_franchises',
    '0010_franchise_release_observations',
    '0013_franchise_bootstrap_failures',
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
    {
      media: 'anime',
      scope: 'tracked_origin',
      known: 1,
      indexed: 1,
      pending: 0,
      deferred: 0,
      missing: 0,
    },
    {
      media: 'manga',
      scope: 'tracked_origin',
      known: 1,
      indexed: 0,
      pending: 1,
      deferred: 0,
      missing: 0,
    },
    { media: 'manga', scope: 'related', known: 1, indexed: 0, pending: 1, deferred: 0, missing: 0 },
  ]);
  const next = await bootstrapTrackedFranchises(client, reader, 20, () => {});
  expect(next).toMatchObject({
    fetched: 1,
    provider_missing: 1,
    coverage: [{ indexed: 1 }, { indexed: 0, deferred: 1, missing: 1 }, { indexed: 1 }],
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

it('checkpoints malformed responses, wrong identifiers and failed requests and continues other titles', async () => {
  for (let i = 1; i <= 6; i++)
    db.prepare("INSERT INTO anime_watchlist(user_id,mal_id,tag_id) VALUES('u',?,'done')").run(
      String(i)
    );
  const full = vi.fn(async (_: unknown, id: number) => {
    if (id === 1) return {};
    if (id === 2) return { data: { mal_id: 42, title: 'Wrong', relations: [] } };
    if (id === 3) throw new Error('HTTP 410');
    if (id === 4) return null;
    return { data: { mal_id: id, title: 'Valid', relations: [] } };
  });
  const result = await bootstrapTrackedFranchises(client, { full }, 20, () => {});
  expect(result).toMatchObject({
    fetched: 2,
    failed: 3,
    provider_missing: 1,
    interrupted: false,
    coverage: [{ known: 6, missing: 1, pending: 0, deferred: 4 }],
  });
  db.exec(
    "UPDATE assistant_provider_attempts SET attempted_at='2000-01-01'; UPDATE assistant_bootstrap_failures SET retry_after='2000-01-01' WHERE reason='rejected'"
  );
  await bootstrapTrackedFranchises(client, { full }, 20, () => {});
  expect(full.mock.calls.map(([, id]) => id)).toEqual([1, 2, 3, 4, 5, 6, 1, 2, 3]);
});

it('stops on an exhausted provider outage and leaves remaining titles ready for a rerun', async () => {
  db.exec(
    "INSERT INTO anime_watchlist(user_id,mal_id,tag_id) VALUES('u','1','done'),('u','2','done')"
  );
  const full = vi.fn(async () => {
    throw new ProviderUnavailableError('upstream down');
  });
  const result = await bootstrapTrackedFranchises(client, { full }, 20, () => {});
  expect(result).toMatchObject({
    failed: 1,
    interrupted: true,
    coverage: [{ known: 2, deferred: 1, pending: 1, missing: 0 }],
  });
  expect(full).toHaveBeenCalledTimes(1);
});

it.each(['anime', 'manga'] as const)(
  'refreshes %s without rewriting identical edges',
  async (media) => {
    const edges = media === 'anime' ? 'assistant_franchise_edges' : 'assistant_manga_edges';
    db.exec(`CREATE TABLE mutations(k TEXT); CREATE TRIGGER test_insert AFTER INSERT ON ${edges} BEGIN INSERT INTO mutations VALUES('insert'); END;
    CREATE TRIGGER test_delete AFTER DELETE ON ${edges} BEGIN INSERT INTO mutations VALUES('delete'); END;`);
    const entry = { mal_id: 2, type: 'anime', name: 'Related', url: 'https://example.org' };
    const data = { mal_id: 1, title: 'Root', relations: [{ relation: 'Sequel', entry: [entry] }] };
    for (const day of ['01', '02'])
      await client.batch(
        franchiseSnapshotStatements(media, 1, '2026-01-' + day, { data }),
        'write'
      );
    expect(db.prepare('SELECT k FROM mutations').all()).toEqual([{ k: 'insert' }]);
    await client.batch(
      franchiseSnapshotStatements(media, 1, '2026-01-03', { data: { ...data, relations: [] } }),
      'write'
    );
    expect(db.prepare('SELECT k FROM mutations').all()).toEqual([{ k: 'insert' }, { k: 'delete' }]);
  }
);
