// @vitest-environment node
/// <reference types="@cloudflare/workers-types" />
import { SignJWT } from 'jose';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import worker from './worker';

// Relations and recommendations fall back to an empty payload when the
// catalog provider is unreachable; keep tests hermetic by refusing at once.
vi.mock('axios', () => ({
  default: { get: vi.fn(() => Promise.reject(new Error('offline test'))) },
}));

const JWT_SECRET = 'worker-watchlist-test-secret';
const MAL_ID = 1;

type Row = Record<string, unknown>;

// Minimal stateful D1 stand-in covering the watchlist, tag, catalog, and
// detail-cache statements the exercised handlers issue. Writes are applied
// with the same ON CONFLICT semantics as the real schema so handler tests
// observe durable per-user records rather than mocked call counts.
class FakeD1 {
  readonly statements: { sql: string; args: unknown[] }[] = [];
  private readonly userTags = new Map<string, Row>();
  private readonly animeWatchlist = new Map<string, Row>();
  private readonly animeData: Row[];

  constructor(animeData: Row[]) {
    this.animeData = animeData;
  }

  prepare(sql: string) {
    const run = (args: unknown[]) => Promise.resolve(this.exec(sql, args));
    const bound = (args: unknown[]) => ({
      all: () => run(args),
      run: () => run(args),
      first: async () => (await run(args)).results[0] ?? null,
    });
    return {
      bind: (...args: unknown[]) => bound(args),
      all: () => run([]),
      run: () => run([]),
      first: async () => (await run([])).results[0] ?? null,
    };
  }

  batch(statements: { all: () => Promise<unknown> }[]) {
    return Promise.all(statements.map((statement) => statement.all()));
  }

  withSession() {
    return this;
  }

  private exec(sql: string, args: unknown[]): { results: Row[]; meta: { changes: number } } {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    this.statements.push({ sql: normalized, args });

    if (normalized.startsWith('SELECT id, name, color FROM user_tags')) {
      const [userId, key] = args as [string, string];
      const byName = normalized.includes('lower(name) = lower(?)');
      const row = [...this.userTags.values()].find(
        (tag) =>
          tag.user_id === userId &&
          (byName ? String(tag.name).toLowerCase() === key.toLowerCase() : tag.id === key)
      );
      return { results: row ? [{ ...row }] : [], meta: { changes: 0 } };
    }

    if (normalized.startsWith('INSERT INTO user_tags')) {
      const [id, userId, name, color] = args as [string, string, string, string];
      this.userTags.set(id, { id, user_id: userId, name, color });
      return { results: [], meta: { changes: 1 } };
    }

    if (normalized.startsWith('UPDATE user_tags SET color')) {
      const [color, id] = args as [string, string];
      const row = this.userTags.get(id);
      if (row) row.color = color;
      return { results: [], meta: { changes: row ? 1 : 0 } };
    }

    if (normalized.startsWith('INSERT INTO anime_watchlist')) {
      const [userId, malId, tagId] = args as [string, string, string];
      const key = `${userId}|${malId}`;
      const existing = this.animeWatchlist.get(key);
      // Mirrors ON CONFLICT(user_id, mal_id) DO UPDATE SET tag_id = excluded.tag_id:
      // a status change must preserve the stored note.
      this.animeWatchlist.set(key, {
        user_id: userId,
        mal_id: malId,
        tag_id: tagId,
        note: existing?.note ?? null,
      });
      return { results: [], meta: { changes: 1 } };
    }

    if (normalized.startsWith('DELETE FROM anime_watchlist')) {
      const [userId, malId] = args as [string, string];
      const deleted = this.animeWatchlist.delete(`${userId}|${malId}`);
      return { results: [], meta: { changes: deleted ? 1 : 0 } };
    }

    if (normalized.startsWith('UPDATE anime_watchlist SET note')) {
      const [note, userId, malId] = args as [string | null, string, string];
      const row = this.animeWatchlist.get(`${userId}|${malId}`);
      if (row) row.note = note;
      return { results: [], meta: { changes: row ? 1 : 0 } };
    }

    if (normalized.startsWith('SELECT aw.mal_id, ut.name AS tag_name')) {
      const [userId, malId] = args as [string, string?];
      const rows = [...this.animeWatchlist.values()]
        .filter(
          (entry) => entry.user_id === userId && (malId === undefined || entry.mal_id === malId)
        )
        .map((entry) => ({
          mal_id: entry.mal_id,
          tag_name: this.userTags.get(entry.tag_id as string)?.name ?? '',
          title: null,
          type: null,
          episodes: null,
          note: entry.note,
        }));
      return { results: rows, meta: { changes: 0 } };
    }

    if (normalized === 'SELECT * FROM anime_data') {
      return { results: this.animeData.map((row) => ({ ...row })), meta: { changes: 0 } };
    }

    if (normalized.startsWith('SELECT * FROM anime_data WHERE mal_id = ?')) {
      const [malId] = args as [number];
      const row = this.animeData.find((anime) => anime.mal_id === malId);
      return { results: row ? [{ ...row }] : [], meta: { changes: 0 } };
    }

    if (
      normalized.startsWith('SELECT mal_id, payload, fetched_at FROM anime_relations_cache') ||
      normalized.startsWith('SELECT mal_id, payload, fetched_at FROM anime_recommendations_cache')
    ) {
      return { results: [], meta: { changes: 0 } };
    }

    throw new Error(`FakeD1 received an unhandled statement: ${normalized}`);
  }
}

const ANIME_ROW: Row = {
  mal_id: MAL_ID,
  url: 'https://example.invalid/anime/1',
  title: 'Handler Test Anime',
  title_english: null,
  type: 'TV',
  episodes: 12,
  aired_from: null,
  aired_to: null,
  score: 8,
  scored_by: 100,
  rank: null,
  status: 'Finished Airing',
  popularity: null,
  members: 5000,
  favorites: 10,
  synopsis: null,
  year: 2026,
  season: 'winter',
  image: null,
  genres: '{}',
  themes: '{}',
  demographics: '{}',
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

let db: FakeD1;
let edgeCache: Map<string, string>;
let pending: Promise<unknown>[];

const executionCtx = {
  waitUntil: (promise: Promise<unknown>) => {
    pending.push(promise);
  },
};

function tokenFor(
  userId: string,
  opts: { expired?: boolean; secret?: string } = {}
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jwt = new SignJWT({ userId, email: `${userId}@test.invalid`, name: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(opts.expired ? now - 7200 : now)
    .setExpirationTime(opts.expired ? now - 3600 : '7d');
  return jwt.sign(new TextEncoder().encode(opts.secret ?? JWT_SECRET));
}

async function call(path: string, opts: { method?: string; token?: string; body?: unknown } = {}) {
  const response = await worker.fetch(
    new Request(`https://worker.test${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    }),
    {
      DB: db as unknown as D1Database,
      JWT_SECRET,
      GOOGLE_CLIENT_ID: 'test-google-client',
    },
    executionCtx as unknown as ExecutionContext
  );
  await Promise.all(pending);
  return response;
}

const addStatus = (token: string, status: string) =>
  call('/api/watched/add', {
    method: 'POST',
    token,
    body: { mal_ids: [MAL_ID], status },
  });

const watchlistFor = async (token: string) =>
  (await (await call('/api/watchlist', { token })).json()) as {
    anime: Record<string, { status: string; note?: string }>;
  };

beforeAll(() => {
  vi.stubGlobal('caches', {
    default: {
      match: async (request: Request) => {
        const body = edgeCache.get(request.url);
        return body ? new Response(body, { status: 200 }) : undefined;
      },
      put: async (request: Request, response: Response) => {
        edgeCache.set(request.url, await response.text());
      },
    },
  });
});

beforeEach(() => {
  db = new FakeD1([ANIME_ROW]);
  edgeCache = new Map();
  pending = [];
});

describe('watchlist handlers', () => {
  it('persists status and note changes across later reads for the same account', async () => {
    const alice = await tokenFor('alice');

    expect((await addStatus(alice, 'Watching')).status).toBe(200);
    expect(
      (
        await call(`/api/anime/${MAL_ID}/note`, {
          method: 'POST',
          token: alice,
          body: { note: '  durable note  ' },
        })
      ).status
    ).toBe(200);

    // A later read (the reload/reopen path) must return the durable values.
    const firstRead = await watchlistFor(alice);
    expect(firstRead.anime[String(MAL_ID)]).toMatchObject({
      status: 'Watching',
      note: 'durable note',
    });

    // Status changes keep the stored note; reads stay consistent afterwards.
    expect((await addStatus(alice, 'Deferred')).status).toBe(200);
    const secondRead = await watchlistFor(alice);
    expect(secondRead.anime[String(MAL_ID)]).toMatchObject({
      status: 'Deferred',
      note: 'durable note',
    });
  });

  it('keeps accounts isolated through the real handlers', async () => {
    const alice = await tokenFor('alice');
    const bob = await tokenFor('bob');
    await addStatus(alice, 'Watching');
    await call(`/api/anime/${MAL_ID}/note`, {
      method: 'POST',
      token: alice,
      body: { note: 'alice only' },
    });

    // Bob cannot read, edit, or delete Alice's records.
    expect((await watchlistFor(bob)).anime).toEqual({});
    expect(
      (
        await call(`/api/anime/${MAL_ID}/note`, {
          method: 'POST',
          token: bob,
          body: { note: 'hijack' },
        })
      ).status
    ).toBe(404);
    expect(
      (
        await call('/api/watched/remove', {
          method: 'POST',
          token: bob,
          body: { mal_ids: [MAL_ID] },
        })
      ).status
    ).toBe(200);
    expect((await watchlistFor(alice)).anime[String(MAL_ID)]).toMatchObject({
      status: 'Watching',
      note: 'alice only',
    });

    // Bob's own write lands under his account without touching Alice's.
    await addStatus(bob, 'Completed');
    expect((await watchlistFor(bob)).anime[String(MAL_ID)].status).toBe('Completed');
    expect((await watchlistFor(alice)).anime[String(MAL_ID)].status).toBe('Watching');
  });

  it('rejects missing, expired, and foreign-signed tokens without mutating records', async () => {
    const alice = await tokenFor('alice');
    await addStatus(alice, 'Watching');

    const anonymous = await addStatus('', 'Completed');
    const expired = await addStatus(await tokenFor('alice', { expired: true }), 'Completed');
    const foreignSigned = await addStatus(
      await tokenFor('alice', { secret: 'not-the-worker-secret' }),
      'Completed'
    );
    const expiredRead = await call('/api/watchlist', {
      token: await tokenFor('alice', { expired: true }),
    });

    expect(anonymous.status).toBe(401);
    expect(expired.status).toBe(401);
    expect(foreignSigned.status).toBe(401);
    expect(expiredRead.status).toBe(401);

    // The prior record survives failed/expired writes untouched.
    expect((await watchlistFor(alice)).anime[String(MAL_ID)].status).toBe('Watching');
  });

  it('notes for titles outside the watchlist fail truthfully', async () => {
    const alice = await tokenFor('alice');
    const response = await call(`/api/anime/${MAL_ID}/note`, {
      method: 'POST',
      token: alice,
      body: { note: 'no entry yet' },
    });
    expect(response.status).toBe(404);
  });

  it('embeds per-user watchlist state in detail responses and never edge-caches it', async () => {
    const alice = await tokenFor('alice');
    await addStatus(alice, 'BRR');
    await call(`/api/anime/${MAL_ID}/note`, {
      method: 'POST',
      token: alice,
      body: { note: 'private note' },
    });

    // Anonymous detail is edge-cacheable.
    const anonymousFirst = await call(`/api/anime/${MAL_ID}`);
    expect(anonymousFirst.headers.get('X-Detail-Cache')).toBe('MISS');
    expect((await anonymousFirst.json()).watchlistEntry).toBeNull();
    const anonymousSecond = await call(`/api/anime/${MAL_ID}`);
    expect(anonymousSecond.headers.get('X-Detail-Cache')).toBe('HIT');
    expect((await anonymousSecond.json()).watchlistEntry).toBeNull();

    // Alice's signed-in response carries her private state and bypasses the
    // shared edge cache in both directions.
    const aliceDetail = await call(`/api/anime/${MAL_ID}`, { token: alice });
    expect(aliceDetail.headers.get('X-Detail-Cache')).toBe('BYPASS');
    expect((await aliceDetail.json()).watchlistEntry).toEqual({
      status: 'BRR',
      note: 'private note',
    });

    // The anonymous cache entry remains clean afterwards — no leak of
    // Alice's status or note into shared cached responses.
    const anonymousThird = await call(`/api/anime/${MAL_ID}`);
    expect(anonymousThird.headers.get('X-Detail-Cache')).toBe('HIT');
    expect((await anonymousThird.json()).watchlistEntry).toBeNull();
  });
});
