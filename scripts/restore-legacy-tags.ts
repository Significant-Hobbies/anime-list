#!/usr/bin/env node
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../src/db/client';
import { configureOperatorDatabaseFromArgs } from '../src/db/operatorClient';

type WatchlistEntry = {
  id?: string;
  status?: string;
};

type WatchlistFile = {
  anime?: Record<string, WatchlistEntry>;
  manga?: Record<string, WatchlistEntry>;
};

const BRR_COLOR = '#8b5cf6';
const DELAYING_COLOR = '#ef4444';

const normalizeStatus = (status?: string): 'BRR' | 'Delaying' | null => {
  if (!status) return null;
  const value = status.trim().toLowerCase();
  if (value === 'brr') return 'BRR';
  if (value === 'avoiding' || value === 'delaying') return 'Delaying';
  return null;
};

async function ensureTag(userId: string, tag: string, color: string): Promise<string> {
  const db = getDb();
  const existing = await db.execute({
    sql: 'SELECT id FROM user_tags WHERE user_id = ? AND lower(name) = lower(?) LIMIT 1',
    args: [userId, tag],
  });
  if (existing.rows.length > 0) {
    const tagId = existing.rows[0].id as string;
    await db.execute({
      sql: 'UPDATE user_tags SET color = ? WHERE id = ?',
      args: [color, tagId],
    });
    return tagId;
  }

  const tagId = crypto.randomUUID();
  await db.execute({
    sql: 'INSERT INTO user_tags (id, user_id, name, color) VALUES (?, ?, ?, ?)',
    args: [tagId, userId, tag, color],
  });
  return tagId;
}

function readWatchlistFile(filePath: string): WatchlistFile {
  const resolved = path.resolve(filePath);
  const raw = fs.readFileSync(resolved, 'utf8');
  return JSON.parse(raw) as WatchlistFile;
}

async function restoreAnime(
  userId: string,
  brrTagId: string,
  delayingTagId: string
): Promise<void> {
  const db = getDb();
  const data = readWatchlistFile('user_watchedlist_data.json');
  const anime = data.anime || {};

  let requested = 0;
  let updated = 0;

  for (const [malId, entry] of Object.entries(anime)) {
    const target = normalizeStatus(entry.status);
    if (!target) continue;
    requested += 1;

    const result = await db.execute({
      sql: 'UPDATE anime_watchlist SET tag_id = ? WHERE user_id = ? AND mal_id = ?',
      args: [target === 'BRR' ? brrTagId : delayingTagId, userId, malId],
    });
    updated += Number(result.rowsAffected || 0);
  }

  console.log(`anime restore requested=${requested} updated=${updated}`);
}

async function restoreManga(
  userId: string,
  brrTagId: string,
  delayingTagId: string
): Promise<void> {
  const db = getDb();
  const data = readWatchlistFile('user_manga_watchedlist_data.json');
  const manga = data.manga || {};

  let requested = 0;
  let updated = 0;

  for (const [malId, entry] of Object.entries(manga)) {
    const target = normalizeStatus(entry.status);
    if (!target) continue;
    requested += 1;

    const result = await db.execute({
      sql: 'UPDATE manga_watchlist SET tag_id = ? WHERE user_id = ? AND mal_id = ?',
      args: [target === 'BRR' ? brrTagId : delayingTagId, userId, malId],
    });
    updated += Number(result.rowsAffected || 0);
  }

  console.log(`manga restore requested=${requested} updated=${updated}`);
}

async function printTagCounts(userId: string): Promise<void> {
  const db = getDb();
  const counts = await db.execute({
    sql: `
      SELECT ut.name AS tag, COUNT(aw.mal_id) AS count
      FROM user_tags ut
      LEFT JOIN anime_watchlist aw
        ON aw.user_id = ut.user_id
        AND aw.tag_id = ut.id
      WHERE ut.user_id = ?
      GROUP BY ut.id, ut.name
      ORDER BY count DESC, tag COLLATE NOCASE ASC
    `,
    args: [userId],
  });
  console.log('anime tag counts:', counts.rows);
}

async function main(): Promise<void> {
  configureOperatorDatabaseFromArgs();
  const db = getDb();
  const userResult = await db.execute('SELECT id, email FROM users LIMIT 1');
  if (userResult.rows.length === 0) {
    throw new Error('No user found in users table');
  }

  const userId = userResult.rows[0].id as string;
  const email = userResult.rows[0].email as string;
  console.log(`restoring for user=${email} id=${userId}`);

  const brrTagId = await ensureTag(userId, 'BRR', BRR_COLOR);
  const delayingTagId = await ensureTag(userId, 'Delaying', DELAYING_COLOR);
  console.log(`ensured tags: BRR=${brrTagId}, Delaying=${delayingTagId}`);

  await restoreAnime(userId, brrTagId, delayingTagId);
  await restoreManga(userId, brrTagId, delayingTagId);
  await printTagCounts(userId);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
