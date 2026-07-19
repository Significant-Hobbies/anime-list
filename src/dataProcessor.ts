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
export const getMangaFieldValue = (manga: MangaItem, field: MangaField): unknown => {
  switch (field) {
    case MangaField.MalId:
      return manga.mal_id;
    case MangaField.Title:
      return manga.title;
    case MangaField.TitleEnglish:
      return manga.title_english;
    case MangaField.Type:
      return manga.type;
    case MangaField.Chapters:
      return manga.chapters;
    case MangaField.Volumes:
      return manga.volumes;
    case MangaField.Score:
      return manga.score;
    case MangaField.ScoredBy:
      return manga.scored_by;
    case MangaField.Rank:
      return manga.rank;
    case MangaField.Status:
      return manga.status;
    case MangaField.Popularity:
      return manga.popularity;
    case MangaField.Members:
      return manga.members;
    case MangaField.Favorites:
      return manga.favorites;
    case MangaField.Year:
      return manga.year;
    case MangaField.Synopsis:
      return manga.synopsis;
    case MangaField.Genres:
      return manga.genres;
    case MangaField.Themes:
      return manga.themes;
    case MangaField.Demographics:
      return manga.demographics;
    case MangaField.HasColored:
      return manga.has_colored;
    case MangaField.IsCompleted:
      return manga.is_completed;
    case MangaField.AvailableInEnglish:
      return manga.available_in_english;
    case MangaField.AvailableLanguages:
      return manga.available_languages;
    default:
      return undefined;
  }
};

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
