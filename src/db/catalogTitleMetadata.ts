import type { DatabaseStatement } from './client';

interface TitleMetadata {
  aliases?: string[];
  studios?: string[];
}
interface ProviderNames {
  titles?: { title: string }[];
  title_synonyms?: string[];
  title_japanese?: string;
  studios?: { name: string }[];
}
export function providerNames(row: ProviderNames): TitleMetadata {
  const names = [
    ...(row.titles ?? []).map((t) => t.title),
    ...(row.title_synonyms ?? []),
    row.title_japanese,
  ];
  const aliases = [
    ...new Set(names.filter((name): name is string => typeof name === 'string' && name.length > 0)),
  ];
  return { aliases, studios: row.studios?.map((s) => s.name) };
}

export function metadataStatements(
  media: 'anime' | 'manga',
  entries: (TitleMetadata & { mal_id: number })[]
): DatabaseStatement[] {
  return entries
    .filter((item) => item.aliases?.length || item.studios?.length)
    .map((item) => ({
      sql: `INSERT INTO catalog_title_metadata(media,mal_id,aliases,studios) VALUES(?,?,?,?)
          ON CONFLICT(media,mal_id) DO UPDATE SET aliases=excluded.aliases,studios=excluded.studios`,
      args: [
        media,
        item.mal_id,
        JSON.stringify(item.aliases ?? []),
        JSON.stringify(item.studios ?? []),
      ],
    }));
}

export function catalogWithNames(media: 'anime' | 'manga') {
  return `SELECT c.*,m.aliases,m.studios FROM ${media}_data c LEFT JOIN catalog_title_metadata m ON m.media='${media}' AND m.mal_id=c.mal_id`;
}

export function catalogIdentity(row: Record<string, unknown>) {
  return {
    mal_id: row.mal_id as number,
    url: row.url as string,
    title: row.title as string,
    title_english: (row.title_english as string) || undefined,
    aliases: JSON.parse((row.aliases as string) || '[]') as string[],
    studios: JSON.parse((row.studios as string) || '[]') as string[],
    type: (row.type as string) || undefined,
  };
}
