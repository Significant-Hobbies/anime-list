import { getDb } from './client';

export interface CollectionRow {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  description: string;
  visibility: string;
  cover_mode: string;
  created_at: string;
  updated_at: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const db = getDb();
  const root = slugify(base) || 'collection';
  let candidate = root;
  let suffix = 1;

  while (true) {
    const result = await db.execute({
      sql: `SELECT id FROM collections WHERE slug = ? ${excludeId ? 'AND id != ?' : ''} LIMIT 1`,
      args: excludeId ? [candidate, excludeId] : [candidate],
    });
    if (result.rows.length === 0) return candidate;
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }
}

export async function getCollectionBySlug(
  slug: string,
  options: { ownerId?: string; publicOnly?: boolean } = {}
): Promise<CollectionRow | null> {
  const db = getDb();
  const clauses = ['slug = ?'];
  const args: string[] = [slug];
  if (options.ownerId) {
    clauses.push('user_id = ?');
    args.push(options.ownerId);
  }
  if (options.publicOnly) {
    clauses.push("visibility = 'public'");
  }

  const result = await db.execute({
    sql: `SELECT * FROM collections WHERE ${clauses.join(' AND ')} LIMIT 1`,
    args,
  });
  return result.rows.length ? (result.rows[0] as unknown as CollectionRow) : null;
}

export async function createCollection(
  userId: string,
  input: {
    title: string;
    description?: string;
    visibility?: string;
    items?: Array<{ mal_id: string; media_type?: string; note?: string }>;
  }
): Promise<CollectionRow> {
  const db = getDb();
  const id = crypto.randomUUID();
  const slug = await uniqueSlug(input.title);
  await db.execute({
    sql: `INSERT INTO collections (id, user_id, slug, title, description, visibility)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      userId,
      slug,
      input.title.trim(),
      input.description?.trim() ?? '',
      input.visibility ?? 'public',
    ],
  });

  if (input.items?.length) {
    await replaceCollectionItems(id, input.items);
  }

  return (await getCollectionBySlug(slug, { ownerId: userId }))!;
}

async function replaceCollectionItems(
  collectionId: string,
  items: Array<{ mal_id: string; media_type?: string; note?: string }>
): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: 'DELETE FROM collection_items WHERE collection_id = ?',
    args: [collectionId],
  });

  const statements = items.map((item, index) => ({
    sql: `INSERT INTO collection_items (id, collection_id, mal_id, media_type, position, note)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      crypto.randomUUID(),
      collectionId,
      item.mal_id,
      item.media_type ?? 'anime',
      index,
      item.note ?? null,
    ],
  }));

  if (statements.length > 0) {
    await db.batch(statements);
  }
}
