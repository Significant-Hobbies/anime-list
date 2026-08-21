import type { AnimeItem, RawAnimeData } from './types/anime';
import { filterCollection } from './filterEngine';
import {
  type MangaItem,
  MangaField,
  type MangaFilter,
  isMangaNumericField,
  isMangaArrayField,
  isMangaStringField,
  type RawMangaData,
} from './types/manga';

const extractImageUrl = (images?: {
  webp?: { image_url?: string };
  jpg?: { image_url?: string };
}): string | undefined => images?.webp?.image_url || images?.jpg?.image_url || undefined;

const arrayToMap = (arr?: Array<{ name: string }>): { [key: string]: number } => {
  const map: { [key: string]: number } = {};
  if (arr) {
    arr.forEach(({ name }) => (map[name] = 1));
  }
  return map;
};

export const transformRawAnime = (rawAnime: RawAnimeData[0]): AnimeItem => {
  return {
    mal_id: rawAnime.mal_id,
    url: rawAnime.url,
    title: rawAnime.title,
    title_english: rawAnime.title_english,
    type: rawAnime.type,
    episodes: rawAnime.episodes,
    score: rawAnime.score,
    scored_by: rawAnime.scored_by,
    rank: rawAnime.rank,
    popularity: rawAnime.popularity,
    members: rawAnime.members,
    favorites: rawAnime.favorites,
    synopsis: rawAnime.synopsis,
    year: rawAnime.year || Number(rawAnime.aired?.from?.slice(0, 4)),
    season: rawAnime.season,
    status: rawAnime.status,
    image: extractImageUrl(rawAnime.images),
    genres: arrayToMap(rawAnime.genres),
    themes: arrayToMap(rawAnime.themes),
    demographics: arrayToMap(rawAnime.demographics),
  };
};

// Manga data processing functions
export const transformRawManga = (rawManga: RawMangaData[0]): MangaItem => {
  return {
    mal_id: rawManga.mal_id,
    url: rawManga.url,
    title: rawManga.title,
    title_english: rawManga.title_english,
    type: rawManga.type,
    chapters: rawManga.chapters,
    volumes: rawManga.volumes,
    score: rawManga.score,
    scored_by: rawManga.scored_by,
    rank: rawManga.rank,
    popularity: rawManga.popularity,
    members: rawManga.members,
    favorites: rawManga.favorites,
    synopsis: rawManga.synopsis,
    year: rawManga.year || Number(rawManga.published?.from?.slice(0, 4)),
    status: rawManga.status,
    image: extractImageUrl(rawManga.images),
    genres: arrayToMap(rawManga.genres),
    themes: arrayToMap(rawManga.themes),
    demographics: arrayToMap(rawManga.demographics),
  };
};

// Manga filtering functions
const MANGA_FIELD_ACCESSORS: Record<MangaField, (manga: MangaItem) => unknown> = {
  [MangaField.MalId]: (m) => m.mal_id,
  [MangaField.Title]: (m) => m.title,
  [MangaField.TitleEnglish]: (m) => m.title_english,
  [MangaField.Type]: (m) => m.type,
  [MangaField.Chapters]: (m) => m.chapters,
  [MangaField.Volumes]: (m) => m.volumes,
  [MangaField.Score]: (m) => m.score,
  [MangaField.ScoredBy]: (m) => m.scored_by,
  [MangaField.Rank]: (m) => m.rank,
  [MangaField.Status]: (m) => m.status,
  [MangaField.Popularity]: (m) => m.popularity,
  [MangaField.Members]: (m) => m.members,
  [MangaField.Favorites]: (m) => m.favorites,
  [MangaField.Year]: (m) => m.year,
  [MangaField.Synopsis]: (m) => m.synopsis,
  [MangaField.Genres]: (m) => m.genres,
  [MangaField.Themes]: (m) => m.themes,
  [MangaField.Demographics]: (m) => m.demographics,
  [MangaField.HasColored]: (m) => m.has_colored,
  [MangaField.IsCompleted]: (m) => m.is_completed,
  [MangaField.AvailableInEnglish]: (m) => m.available_in_english,
  [MangaField.AvailableLanguages]: (m) => m.available_languages,
};

export const getMangaFieldValue = (manga: MangaItem, field: MangaField): unknown =>
  MANGA_FIELD_ACCESSORS[field]?.(manga);

export const filterMangaList = async (filters: MangaFilter[]): Promise<MangaItem[]> => {
  try {
    const { mangaStore } = await import('./store/mangaStore');
    const mangaList = await mangaStore.getMangaList();

    return filterCollection(mangaList, filters, {
      getFieldValue: getMangaFieldValue,
      isNumericField: isMangaNumericField,
      isArrayField: isMangaArrayField,
      isStringField: isMangaStringField,
    });
  } catch (error) {
    console.error('Error during manga filtering:', error);
    throw error;
  }
};
