import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { getDb } from '../src/db/client';
import { configureOperatorDatabaseFromArgs } from '../src/db/operatorClient';

async function resolveUserId(db: ReturnType<typeof getDb>, emailOrId: string): Promise<string> {
  // If it looks like an email, look up or create the user
  if (emailOrId.includes('@')) {
    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [emailOrId],
    });
    if (existing.rows.length > 0) {
      console.log(`Found existing user for ${emailOrId}: ${existing.rows[0].id}`);
      return existing.rows[0].id as string;
    }
    // Create a placeholder user (will be linked to Google on first login)
    const id = crypto.randomUUID();
    await db.execute({
      sql: 'INSERT INTO users (id, google_id, email, name) VALUES (?, ?, ?, ?)',
      args: [id, `pending_${id}`, emailOrId, emailOrId.split('@')[0]],
    });
    console.log(`Created placeholder user for ${emailOrId}: ${id}`);
    return id;
  }
  return emailOrId;
}

async function seed() {
  configureOperatorDatabaseFromArgs();
  const db = getDb();

  const input = process.argv.slice(2).find((argument) => !argument.startsWith('--')) || 'default';
  const userId = await resolveUserId(db, input);
  console.log(`Seeding watchlist for user_id: ${userId}`);

  // Seed anime watchlist
  try {
    const animeData = JSON.parse(readFileSync('user_watchedlist_data.json', 'utf-8'));
    const entries = Object.values(animeData.anime) as Array<{
      id: string;
      status: string;
      title?: string;
      type?: string;
      episodes?: number | string;
    }>;

    console.log(`Seeding ${entries.length} anime watchlist entries...`);

    for (let i = 0; i < entries.length; i += 100) {
      const chunk = entries.slice(i, i + 100);
      await db.batch(
        chunk.map((e) => ({
          sql: `INSERT OR REPLACE INTO anime_watchlist (user_id, mal_id, status, title, type, episodes) VALUES (?, ?, ?, ?, ?, ?)`,
          args: [
            userId,
            e.id,
            e.status,
            e.title || null,
            e.type || null,
            e.episodes ? Number(e.episodes) : null,
          ],
        }))
      );
      console.log(`  ${Math.min(i + 100, entries.length)}/${entries.length}`);
    }

    console.log('Anime watchlist seeded.');
  } catch {
    console.log('No anime watchlist file found, skipping.');
  }

  // Seed manga watchlist
  try {
    const mangaData = JSON.parse(readFileSync('user_manga_watchedlist_data.json', 'utf-8'));
    const entries = Object.values(mangaData.manga) as Array<{
      id: string;
      status: string;
    }>;

    console.log(`Seeding ${entries.length} manga watchlist entries...`);

    for (let i = 0; i < entries.length; i += 100) {
      const chunk = entries.slice(i, i + 100);
      await db.batch(
        chunk.map((e) => ({
          sql: `INSERT OR REPLACE INTO manga_watchlist (user_id, mal_id, status) VALUES (?, ?, ?)`,
          args: [userId, e.id, e.status],
        }))
      );
      console.log(`  ${Math.min(i + 100, entries.length)}/${entries.length}`);
    }

    console.log('Manga watchlist seeded.');
  } catch {
    console.log('No manga watchlist file found, skipping.');
  }

  console.log('Done!');
}

seed().catch(console.error);
