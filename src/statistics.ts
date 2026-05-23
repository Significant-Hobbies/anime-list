import {
  AnimeField,
  DISTRIBUTION_RANGES,
  MANGA_DISTRIBUTION_RANGES,
  PERCENTILE_FIELDS,
} from "./config";
import { AnimeItem } from "./types/anime";
import { MangaItem, MangaField } from "./types/manga";
import {
  AnimeStats,
  Distribution,
  FieldCount,
  Percentiles,
  TypeDistribution,
} from "./types/statistics";
import {
  getDistribution,
  getFieldCounts,
  getPercentiles,
  getTypeDistribution,
} from "./utils/statistics";

export const getAnimeStats = async (
  animeList: AnimeItem[]
): Promise<AnimeStats> => {
  const data = animeList;

  const percentiles: Record<string, Percentiles> = {};
  Object.entries(PERCENTILE_FIELDS).forEach(([key, field]) => {
    percentiles[key] = getPercentiles(data, field);
  });

  const distributions = {
    score: getDistribution(data, DISTRIBUTION_RANGES.score, AnimeField.Score),
    members: getDistribution(
      data,
      DISTRIBUTION_RANGES.members,
      AnimeField.Members
    ),
    favorites: getDistribution(
      data,
      DISTRIBUTION_RANGES.favorites,
      AnimeField.Favorites
    ),
    yearDistribution: getDistribution(
      data,
      DISTRIBUTION_RANGES.years,
      AnimeField.Year
    ),
  };

  return {
    totalAnime: data.length,
    scoreDistribution: distributions.score,
    membersDistribution: distributions.members,
    favoritesDistribution: distributions.favorites,
    yearDistribution: distributions.yearDistribution,
    percentiles,
    genreCounts: getFieldCounts(data, AnimeField.Genres),
    themeCounts: getFieldCounts(data, AnimeField.Themes),
    demographicCounts: getFieldCounts(data, AnimeField.Demographics),
    typeDistribution: getTypeDistribution(data),
  };
};

export const getMangaStats = async (
  mangaList: MangaItem[] | null = null
): Promise<AnimeStats> => {
  const data = mangaList ?? (await import("./store/mangaStore").then((m) => m.mangaStore.getMangaList()));

  const percentiles: Record<string, Percentiles> = {};
  Object.entries(PERCENTILE_FIELDS).forEach(([key, field]) => {
    percentiles[key] = getPercentiles(data, field as any);
  });

  const distributions = {
    score: getDistribution(data, MANGA_DISTRIBUTION_RANGES.score, MangaField.Score as any),
    members: getDistribution(
      data,
      MANGA_DISTRIBUTION_RANGES.members,
      MangaField.Members as any
    ),
    favorites: getDistribution(
      data,
      MANGA_DISTRIBUTION_RANGES.favorites,
      MangaField.Favorites as any
    ),
    yearDistribution: getDistribution(
      data,
      MANGA_DISTRIBUTION_RANGES.years,
      MangaField.Year as any
    ),
  };

  return {
    totalAnime: data.length,
    scoreDistribution: distributions.score,
    membersDistribution: distributions.members,
    favoritesDistribution: distributions.favorites,
    yearDistribution: distributions.yearDistribution,
    percentiles,
    genreCounts: getFieldCounts(data as any, MangaField.Genres as any),
    themeCounts: getFieldCounts(data as any, MangaField.Themes as any),
    demographicCounts: getFieldCounts(data as any, MangaField.Demographics as any),
    typeDistribution: getTypeDistribution(data as any),
  };
};

export type {
  AnimeStats,
  Distribution,
  FieldCount,
  Percentiles,
  TypeDistribution,
};
