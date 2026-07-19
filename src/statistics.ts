import {
  AnimeField,
  DISTRIBUTION_RANGES,
  MANGA_DISTRIBUTION_RANGES,
  PERCENTILE_FIELDS,
} from './config';
import type { AnimeItem } from './types/anime';
import type { MangaItem } from './types/manga';
import type { AnimeStats, Percentiles } from './types/statistics';
import {
  getDistribution,
  getFieldCounts,
  getPercentiles,
  getTypeDistribution,
} from './utils/statistics';

export const getAnimeStats = async (animeList: AnimeItem[]): Promise<AnimeStats> => {
  const data = animeList;

  const percentiles: Record<string, Percentiles> = {};
  Object.entries(PERCENTILE_FIELDS).forEach(([key, field]) => {
    percentiles[key] = getPercentiles(data, field);
  });

  const distributions = {
    score: getDistribution(data, DISTRIBUTION_RANGES.score, AnimeField.Score),
    members: getDistribution(data, DISTRIBUTION_RANGES.members, AnimeField.Members),
    favorites: getDistribution(data, DISTRIBUTION_RANGES.favorites, AnimeField.Favorites),
    yearDistribution: getDistribution(data, DISTRIBUTION_RANGES.years, AnimeField.Year),
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

export const getMangaStats = async (mangaList: MangaItem[] | null = null): Promise<AnimeStats> => {
  const data =
    mangaList ?? (await import('./store/mangaStore').then((m) => m.mangaStore.getMangaList()));
  const asAnimeShape = data as unknown as AnimeItem[];

  const percentiles: Record<string, Percentiles> = {};
  Object.entries(PERCENTILE_FIELDS).forEach(([key, field]) => {
    percentiles[key] = getPercentiles(asAnimeShape, field);
  });

  const distributions = {
    score: getDistribution(asAnimeShape, MANGA_DISTRIBUTION_RANGES.score, AnimeField.Score),
    members: getDistribution(asAnimeShape, MANGA_DISTRIBUTION_RANGES.members, AnimeField.Members),
    favorites: getDistribution(
      asAnimeShape,
      MANGA_DISTRIBUTION_RANGES.favorites,
      AnimeField.Favorites
    ),
    yearDistribution: getDistribution(
      asAnimeShape,
      MANGA_DISTRIBUTION_RANGES.years,
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
    genreCounts: getFieldCounts(asAnimeShape, AnimeField.Genres),
    themeCounts: getFieldCounts(asAnimeShape, AnimeField.Themes),
    demographicCounts: getFieldCounts(asAnimeShape, AnimeField.Demographics),
    typeDistribution: getTypeDistribution(asAnimeShape),
  };
};

export type { AnimeStats };
