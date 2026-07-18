import { getDb } from './client';

export const TOKEN_PREFIX = 'shelf_';

export interface ApiTokenRow {
  id: string;
  userId: string;
  name: string;
  tokenHash: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface CreatedApiToken {
  token: string;
  id: string;
  name: string;
  createdAt: string;
}

export interface ApiTokenMetadata {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export async function initApiTokensTable(): Promise<void> {
  const db = getDb();
  await db.batch([
    `CREATE TABLE IF NOT EXISTS user_api_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      last_used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      revoked_at TEXT
    )`,
    'CREATE INDEX IF NOT EXISTS idx_user_api_tokens_user ON user_api_tokens(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_user_api_tokens_hash ON user_api_tokens(token_hash)',
  ]);
}

function toMetadata(row: Record<string, unknown>): ApiTokenMetadata {
  return {
    id: row.id as string,
    name: row.name as string,
    createdAt: row.created_at as string,
    lastUsedAt: (row.last_used_at as string | null) ?? null,
    revokedAt: (row.revoked_at as string | null) ?? null,
  };
}

function generateRawToken(): string {
  // 32 bytes of crypto-random data, url-safe base64 (no padding).
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${TOKEN_PREFIX}${base64}`;
}

async function hashToken(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createApiToken(userId: string, name: string): Promise<CreatedApiToken> {
  const db = getDb();
  const id = crypto.randomUUID();
  const raw = generateRawToken();
  const tokenHash = await hashToken(raw);
  await db.execute({
    sql: 'INSERT INTO user_api_tokens (id, user_id, name, token_hash) VALUES (?, ?, ?, ?)',
    args: [id, userId, name, tokenHash],
  });
  const createdAt = new Date().toISOString();
  return { token: raw, id, name, createdAt };
}

export async function listApiTokens(userId: string): Promise<ApiTokenMetadata[]> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT id, name, created_at, last_used_at, revoked_at
          FROM user_api_tokens
          WHERE user_id = ?
          ORDER BY created_at DESC`,
    args: [userId],
  });
  return result.rows.map((row) => toMetadata(row as unknown as Record<string, unknown>));
}

export async function revokeApiToken(
  userId: string,
  tokenId: string
): Promise<{ revoked: boolean; notFound: boolean }> {
  const db = getDb();
  // Only touch rows owned by this user; if no row matches, treat as not found.
  const result = await db.execute({
    sql: `UPDATE user_api_tokens
          SET revoked_at = COALESCE(revoked_at, datetime('now'))
          WHERE id = ? AND user_id = ?`,
    args: [tokenId, userId],
  });
  const affected = Number(result.rowsAffected || 0);
  if (affected === 0) return { revoked: false, notFound: true };
  return { revoked: true, notFound: false };
}

export async function resolveApiToken(
  rawToken: string
): Promise<{ userId: string; tokenId: string } | null> {
  if (!rawToken.startsWith(TOKEN_PREFIX)) return null;
  const db = getDb();
  const tokenHash = await hashToken(rawToken);
  const result = await db.execute({
    sql: `SELECT id, user_id FROM user_api_tokens
          WHERE token_hash = ? AND revoked_at IS NULL`,
    args: [tokenHash],
  });
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return { userId: row.user_id as string, tokenId: row.id as string };
}

export async function touchApiTokenLastUsed(tokenId: string): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: "UPDATE user_api_tokens SET last_used_at = datetime('now') WHERE id = ?",
    args: [tokenId],
  });
}
