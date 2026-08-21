import { getMangaCatalogDb } from './client';
import type { MangaItem } from '../types/manga';

const mapMangaRow = (row: Record<string, unknown>): MangaItem => ({
  mal_id: row.mal_id as number,
  url: row.url as string,
  title: row.title as string,
  title_english: (row.title_english as string) || undefined,
  type: (row.type as string) || undefined,
  chapters: (row.chapters as number) || undefined,
  volumes: (row.volumes as number) || undefined,
  published: row.published_from
    ? {
        from: row.published_from as string,
        to: (row.published_to as string) || '',
      }
    : undefined,
  score: (row.score as number) || undefined,
  scored_by: (row.scored_by as number) || undefined,
  rank: (row.rank as number) || undefined,
  status: (row.status as string) || undefined,
  popularity: (row.popularity as number) || undefined,
  members: (row.members as number) || undefined,
  favorites: (row.favorites as number) || undefined,
  synopsis: (row.synopsis as string) || undefined,
  year: (row.year as number) || undefined,
  image: (row.image as string) || undefined,
  has_colored: row.has_colored ? Boolean(row.has_colored) : undefined,
  is_completed: row.is_completed ? Boolean(row.is_completed) : undefined,
  available_in_english: row.available_in_english ? Boolean(row.available_in_english) : undefined,
  available_languages: row.available_languages
    ? (JSON.parse(row.available_languages as string) as string[])
    : undefined,
  genres: JSON.parse((row.genres as string) || '{}'),
  themes: JSON.parse((row.themes as string) || '{}'),
  demographics: JSON.parse((row.demographics as string) || '{}'),
});

const UPSERT_BATCH_SIZE = 100;

const nullable = (v: unknown) => v || null;
const toFlag = (v: unknown) => (v ? 1 : 0);

const buildMangaUpsertStatement = (manga: MangaItem) => ({
  sql: `
    INSERT INTO manga_data (
      mal_id, url, title, title_english, type, chapters, volumes,
      published_from, published_to, score, scored_by, rank, status,
      popularity, members, favorites, synopsis, year, image,
      has_colored, is_completed, available_in_english, available_languages,
      genres, themes, demographics, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(mal_id) DO UPDATE SET
      url = excluded.url,
      title = excluded.title,
      title_english = excluded.title_english,
      type = excluded.type,
      chapters = excluded.chapters,
      volumes = excluded.volumes,
      published_from = excluded.published_from,
      published_to = excluded.published_to,
      score = excluded.score,
      scored_by = excluded.scored_by,
      rank = excluded.rank,
      status = excluded.status,
      popularity = excluded.popularity,
      members = excluded.members,
      favorites = excluded.favorites,
      synopsis = excluded.synopsis,
      year = excluded.year,
      image = excluded.image,
      has_colored = excluded.has_colored,
      is_completed = excluded.is_completed,
      available_in_english = excluded.available_in_english,
      available_languages = excluded.available_languages,
      genres = excluded.genres,
      themes = excluded.themes,
      demographics = excluded.demographics,
      updated_at = datetime('now')
  `,
  args: [
    manga.mal_id,
    manga.url,
    manga.title,
    nullable(manga.title_english),
    nullable(manga.type),
    nullable(manga.chapters),
    nullable(manga.volumes),
    nullable(manga.published?.from),
    nullable(manga.published?.to),
    nullable(manga.score),
    nullable(manga.scored_by),
    nullable(manga.rank),
    nullable(manga.status),
    nullable(manga.popularity),
    nullable(manga.members),
    nullable(manga.favorites),
    nullable(manga.synopsis),
    nullable(manga.year),
    nullable(manga.image),
    toFlag(manga.has_colored),
    toFlag(manga.is_completed),
    toFlag(manga.available_in_english),
    JSON.stringify(manga.available_languages || []),
    JSON.stringify(manga.genres),
    JSON.stringify(manga.themes),
    JSON.stringify(manga.demographics),
  ],
});

async function writeMangaBatches(mangaList: MangaItem[]): Promise<void> {
  const db = getMangaCatalogDb();
  for (let i = 0; i < mangaList.length; i += UPSERT_BATCH_SIZE) {
    const batch = mangaList.slice(i, i + UPSERT_BATCH_SIZE);
    await db.batch(batch.map(buildMangaUpsertStatement), 'write');
  }
}

export async function upsertMangaBatch(mangaList: MangaItem[]): Promise<void> {
  await writeMangaBatches(mangaList);
  console.log(`Upserted ${mangaList.length} manga into catalog database`);
}

export async function getAllManga(): Promise<MangaItem[]> {
  const db = getMangaCatalogDb();
  const result = await db.execute('SELECT * FROM manga_data');
  return result.rows.map((row) => mapMangaRow(row as unknown as Record<string, unknown>));
}

export async function getMangaByMalId(malId: number): Promise<MangaItem | null> {
  const db = getMangaCatalogDb();
  const result = await db.execute({
    sql: 'SELECT * FROM manga_data WHERE mal_id = ? LIMIT 1',
    args: [malId],
  });
  if (result.rows.length === 0) return null;
  return mapMangaRow(result.rows[0] as unknown as Record<string, unknown>);
}

export async function getLastMangaDataUpdate(): Promise<string | null> {
  const db = getMangaCatalogDb();
  const result = await db.execute('SELECT MAX(updated_at) as last_updated FROM manga_data');
  return (result.rows[0]?.last_updated as string) || null;
}
