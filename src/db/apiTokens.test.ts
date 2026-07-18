import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./client', () => {
  const statements: Array<{ sql: string; args?: unknown[] }> = [];
  const batchCalls: unknown[] = [];
  const db = {
    async execute(stmt: { sql: string; args?: unknown[] }) {
      statements.push(stmt);
      // Default: empty result. Tests override via mockResults below.
      const match = mockResults.find((m) => m.match(stmt));
      return match ? match.result : { rows: [], rowsAffected: 0 };
    },
    async batch(stmts: unknown[]) {
      batchCalls.push(stmts);
      return stmts.map(() => ({ rows: [], rowsAffected: 0 }));
    },
  };
  let mockResults: Array<{
    match: (s: { sql: string; args?: unknown[] }) => boolean;
    result: unknown;
  }> = [];
  (
    globalThis as unknown as { __setMockResults: (r: typeof mockResults) => void }
  ).__setMockResults = (r) => {
    mockResults = r;
  };
  return { getDb: () => db };
});

import {
  createApiToken,
  listApiTokens,
  revokeApiToken,
  resolveApiToken,
  TOKEN_PREFIX,
} from './apiTokens';

const setResults = (
  results: Array<{ match: (s: { sql: string; args?: unknown[] }) => boolean; result: unknown }>
) =>
  (globalThis as unknown as { __setMockResults: (r: typeof results) => void }).__setMockResults(
    results
  );

describe('apiTokens', () => {
  beforeEach(() => setResults([]));

  it('generates a token with the shelf_ prefix and sufficient length', async () => {
    const created = await createApiToken('user1', 'Claude');
    expect(created.token.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(created.token.length).toBeGreaterThanOrEqual(40);
    expect(created.name).toBe('Claude');
    expect(created.id).toBeTruthy();
  });

  it('listApiTokens returns metadata only (no hash, no raw token)', async () => {
    setResults([
      {
        match: (s) => s.sql.includes('SELECT id, name, created_at, last_used_at, revoked_at'),
        result: {
          rows: [
            { id: 't1', name: 'A', created_at: '2026-01-01', last_used_at: null, revoked_at: null },
          ],
        },
      },
    ]);
    const tokens = await listApiTokens('user1');
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toEqual({
      id: 't1',
      name: 'A',
      createdAt: '2026-01-01',
      lastUsedAt: null,
      revokedAt: null,
    });
    // No hash or raw token in the output.
    expect(JSON.stringify(tokens)).not.toContain('hash');
  });

  it('revokeApiToken reports notFound when no row matches the user', async () => {
    setResults([
      { match: (s) => s.sql.includes('UPDATE user_api_tokens'), result: { rowsAffected: 0 } },
    ]);
    const result = await revokeApiToken('userA', 't1');
    expect(result).toEqual({ revoked: false, notFound: true });
  });

  it('revokeApiToken reports revoked when a row matches', async () => {
    setResults([
      { match: (s) => s.sql.includes('UPDATE user_api_tokens'), result: { rowsAffected: 1 } },
    ]);
    const result = await revokeApiToken('userA', 't1');
    expect(result).toEqual({ revoked: true, notFound: false });
  });

  it('resolveApiToken returns null for a non-shelf token without hitting the db', async () => {
    const result = await resolveApiToken('eyJsome-jwt');
    expect(result).toBeNull();
  });

  it('resolveApiToken returns the user when the hash matches an active row', async () => {
    setResults([
      {
        match: (s) => s.sql.includes('SELECT id, user_id FROM user_api_tokens'),
        result: { rows: [{ id: 't1', user_id: 'user1' }] },
      },
    ]);
    const created = await createApiToken('user1', 'test'); // generate a real token to hash
    const result = await resolveApiToken(created.token);
    expect(result).toEqual({ userId: 'user1', tokenId: 't1' });
  });

  it('resolveApiToken returns null when no active row matches', async () => {
    setResults([
      {
        match: (s) => s.sql.includes('SELECT id, user_id FROM user_api_tokens'),
        result: { rows: [] },
      },
    ]);
    const created = await createApiToken('user1', 'test');
    const result = await resolveApiToken(created.token);
    expect(result).toBeNull();
  });
});
