import { getDb } from './client';

/** Unfiltered retained D1 rows, independent of search popularity and pagination. */
export async function getCatalogCounts(): Promise<{ anime: number; manga: number }> {
  const result = await getDb().execute(
    'SELECT (SELECT COUNT(*) FROM anime_data) AS anime, (SELECT COUNT(*) FROM manga_data) AS manga'
  );
  return { anime: Number(result.rows[0].anime), manga: Number(result.rows[0].manga) };
}
