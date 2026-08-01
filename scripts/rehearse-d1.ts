#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { prepareD1Import } from './lib/d1-import.mjs';
import { upsertAnimeBatch } from '../src/db/animeData';
import { createApiToken, resolveApiToken, revokeApiToken } from '../src/db/apiTokens';
import { getDb } from '../src/db/client';
import { createCollection, getCollectionBySlug } from '../src/db/collections';
import { upsertMangaBatch } from '../src/db/mangaData';
import { configureOperatorDatabase } from '../src/db/operatorClient';
import { getSchedule, upsertScheduleItems } from '../src/db/schedule';
import {
  getAnimeWatchlistEntry,
  seedDefaultUserTags,
  upsertAnimeWatchlist,
} from '../src/db/watchlist';

const execFileAsync = promisify(execFile);

const userId = 'd1-rehearsal-user';
const animeId = 1;
const mangaId = 2;

const rehearsalDirectory = await mkdtemp(path.join(tmpdir(), 'anime-list-d1-rehearsal-'));
const sourcePersistence = path.join(rehearsalDirectory, 'source-state');
const targetPersistence = path.join(rehearsalDirectory, 'target-state');
const wrangler = path.resolve('node_modules/.bin/wrangler');

try {
  await Promise.all([mkdir(sourcePersistence), mkdir(targetPersistence)]);
  await execFileAsync(
    wrangler,
    [
      'd1',
      'migrations',
      'apply',
      'anime-list',
      '--local',
      '--config',
      'wrangler.local.toml',
      '--persist-to',
      sourcePersistence,
    ],
    { maxBuffer: 16 * 1024 * 1024 }
  );

  configureOperatorDatabase({ remote: false, persistTo: sourcePersistence });
  const db = getDb();

  await db.execute({
    sql: 'INSERT INTO users (id, google_id, email, name) VALUES (?, ?, ?, ?)',
    args: [userId, 'google-d1-rehearsal', 'd1-rehearsal@example.invalid', 'D1 Rehearsal'],
  });
  await seedDefaultUserTags(userId);

  await upsertAnimeBatch([
    {
      mal_id: animeId,
      url: 'https://example.invalid/anime/1',
      title: 'D1 Anime',
      score: 8,
      scored_by: 100,
      members: 1000,
      favorites: 10,
      year: 2026,
      genres: { Action: 1 },
      themes: {},
      demographics: {},
    },
  ]);
  await upsertMangaBatch([
    {
      mal_id: mangaId,
      url: 'https://example.invalid/manga/2',
      title: 'D1 Manga',
      score: 8,
      scored_by: 100,
      members: 1000,
      favorites: 10,
      year: 2026,
      genres: { Action: 1 },
      themes: {},
      demographics: {},
    },
  ]);

  await upsertAnimeWatchlist([String(animeId)], 'Watching', userId);
  await upsertScheduleItems(userId, [{ malId: String(animeId), episodesPerDay: 2 }]);
  const collection = await createCollection(userId, {
    title: 'D1 Rehearsal',
    items: [{ mal_id: String(animeId) }],
  });
  const token = await createApiToken(userId, 'D1 Rehearsal');

  const [watchlist, schedule, ownedCollection, resolvedToken] = await Promise.all([
    getAnimeWatchlistEntry(String(animeId), userId),
    getSchedule(userId),
    getCollectionBySlug(collection.slug, { ownerId: userId }),
    resolveApiToken(token.token),
  ]);
  const revoked = await revokeApiToken(userId, token.id);

  const counts = await db.execute(`
    SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM anime_data) AS anime,
      (SELECT COUNT(*) FROM manga_data) AS manga,
      (SELECT COUNT(*) FROM anime_watchlist) AS anime_watchlist,
      (SELECT COUNT(*) FROM collections) AS collections,
      (SELECT COUNT(*) FROM user_api_tokens) AS api_tokens
  `);
  const foreignKeys = await db.execute('PRAGMA foreign_key_check');
  const ownershipOrphans = await db.execute(`
    SELECT
      (SELECT COUNT(*) FROM anime_watchlist aw LEFT JOIN users u ON u.id = aw.user_id WHERE u.id IS NULL) +
      (SELECT COUNT(*) FROM collections c LEFT JOIN users u ON u.id = c.user_id WHERE u.id IS NULL) +
      (SELECT COUNT(*) FROM collection_items ci LEFT JOIN collections c ON c.id = ci.collection_id WHERE c.id IS NULL) AS count
  `);

  const invariants = {
    watchlist: watchlist?.status === 'Watching',
    schedule: schedule.length === 1,
    collectionOwnership: ownedCollection?.user_id === userId,
    tokenOwnership: resolvedToken?.userId === userId,
    tokenRevocation: revoked.revoked,
    foreignKeys: foreignKeys.rows.length === 0,
    ownershipOrphans: Number(ownershipOrphans.rows[0]?.count ?? -1) === 0,
  };

  if (Object.values(invariants).some((passed) => !passed)) {
    throw new Error(`D1 rehearsal invariant failed: ${JSON.stringify(invariants)}`);
  }

  const sourceExport = path.join(rehearsalDirectory, 'source.sql');
  const stateFiles = await readdir(sourcePersistence, { recursive: true });
  const sqliteRelativePath = stateFiles.find((file) => file.endsWith('.sqlite'));
  if (!sqliteRelativePath) throw new Error('Wrangler local D1 SQLite file was not found');
  const { stdout: sourceSql } = await execFileAsync(
    '/usr/bin/sqlite3',
    [path.join(sourcePersistence, sqliteRelativePath), '.dump'],
    { maxBuffer: 128 * 1024 * 1024 }
  );
  await writeFile(sourceExport, sourceSql, { encoding: 'utf8', mode: 0o600 });

  const prepared = prepareD1Import(await readFile(sourceExport, 'utf8'), { maxBytes: 1024 });
  if (prepared.chunks.length < 2) {
    throw new Error('D1 import rehearsal did not exercise chunking');
  }

  const chunkDirectory = path.join(rehearsalDirectory, 'chunks');
  await mkdir(chunkDirectory);
  const chunkPaths: string[] = [];
  for (const [index, chunk] of prepared.chunks.entries()) {
    const chunkPath = path.join(chunkDirectory, `${String(index + 1).padStart(4, '0')}.sql`);
    await writeFile(chunkPath, chunk, { encoding: 'utf8', mode: 0o600 });
    chunkPaths.push(chunkPath);
  }

  await execFileAsync(
    wrangler,
    [
      'd1',
      'migrations',
      'apply',
      'anime-list',
      '--local',
      '--config',
      'wrangler.local.toml',
      '--persist-to',
      targetPersistence,
    ],
    { maxBuffer: 16 * 1024 * 1024 }
  );
  for (const chunkPath of chunkPaths) {
    await execFileAsync(
      wrangler,
      [
        'd1',
        'execute',
        'anime-list',
        '--local',
        '--config',
        'wrangler.local.toml',
        '--persist-to',
        targetPersistence,
        '--file',
        chunkPath,
      ],
      { maxBuffer: 16 * 1024 * 1024 }
    );
  }

  configureOperatorDatabase({ remote: false, persistTo: targetPersistence });
  const targetDb = getDb();
  const targetCounts = await targetDb.execute(`
    SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM anime_data) AS anime,
      (SELECT COUNT(*) FROM manga_data) AS manga,
      (SELECT COUNT(*) FROM anime_watchlist) AS anime_watchlist,
      (SELECT COUNT(*) FROM collections) AS collections,
      (SELECT COUNT(*) FROM user_api_tokens) AS api_tokens
  `);
  const targetForeignKeys = await targetDb.execute('PRAGMA foreign_key_check');
  const targetOwnershipOrphans = await targetDb.execute(`
    SELECT
      (SELECT COUNT(*) FROM anime_watchlist aw LEFT JOIN users u ON u.id = aw.user_id WHERE u.id IS NULL) +
      (SELECT COUNT(*) FROM collections c LEFT JOIN users u ON u.id = c.user_id WHERE u.id IS NULL) +
      (SELECT COUNT(*) FROM collection_items ci LEFT JOIN collections c ON c.id = ci.collection_id WHERE c.id IS NULL) AS count
  `);

  if (
    JSON.stringify(targetCounts.rows[0]) !== JSON.stringify(counts.rows[0]) ||
    targetForeignKeys.rows.length !== 0 ||
    Number(targetOwnershipOrphans.rows[0]?.count ?? -1) !== 0
  ) {
    throw new Error('Chunked D1 import parity failed');
  }

  console.log(
    JSON.stringify({
      schema: '0001_initial.sql',
      sourceCounts: counts.rows[0],
      targetCounts: targetCounts.rows[0],
      importChunks: prepared.chunks.length,
      importStatements: prepared.manifest.statementCount,
      foreignKeyViolations: targetForeignKeys.rows.length,
      ownershipOrphans: Number(targetOwnershipOrphans.rows[0]?.count ?? 0),
      journeys: ['catalog', 'watchlist', 'schedule', 'collection', 'api-token'],
    })
  );
} finally {
  await rm(rehearsalDirectory, { recursive: true, force: true });
}
