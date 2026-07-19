import { AnimeField } from '../config';
import {
  type AnimeItem,
  type Filter,
  isNumericField,
  type NumericField,
  type ScoreMultiplier,
} from '../types/anime';
import type { Distribution, FieldCount, Percentiles, TypeDistribution } from '../types/statistics';

const getNumericValue = (item: AnimeItem, field: AnimeField): number | undefined => {
  switch (field) {
    case AnimeField.Score:
      return item.score;
    case AnimeField.ScoredBy:
      return item.scored_by;
    case AnimeField.Rank:
      return item.rank;
    case AnimeField.Popularity:
      return item.popularity;
    case AnimeField.Members:
      return item.members;
    case AnimeField.Favorites:
      return item.favorites;
    case AnimeField.Year:
      return item.year;
    case AnimeField.Episodes:
      return item.episodes;
    default:
      return undefined;
  }
};

const getMapValue = (item: AnimeItem, field: AnimeField): { [key: string]: number } => {
  switch (field) {
    case AnimeField.Genres:
      return item.genres || {};
    case AnimeField.Themes:
      return item.themes || {};
    case AnimeField.Demographics:
      return item.demographics || {};
    default:
      return {};
  }
};

const getFieldValue = (
  item: AnimeItem,
  field: AnimeField
): number | { [key: string]: number } | undefined => {
  if (
    field === AnimeField.Score ||
    field === AnimeField.ScoredBy ||
    field === AnimeField.Rank ||
    field === AnimeField.Popularity ||
    field === AnimeField.Members ||
    field === AnimeField.Favorites ||
    field === AnimeField.Year ||
    field === AnimeField.Episodes
  ) {
    return getNumericValue(item, field);
  } else {
    return getMapValue(item, field);
  }
};

export const getDistribution = (
  data: AnimeItem[],
  ranges: readonly number[],
  field: AnimeField
): Distribution[] => {
  const values = data
    .map((item) => getFieldValue(item, field))
    .filter((value): value is number => value !== undefined && value !== null)
    .sort((a, b) => b - a); // descending

  const distribution: Distribution[] = [];
  let idx = 0;

  for (let i = ranges.length - 1; i >= 0; i--) {
    let count = 0;
    while (idx < values.length && values[idx] >= ranges[i]) {
      count++;
      idx++;
    }
    distribution.push({ range: `${ranges[i]}+`, count });
  }

  distribution.push({ range: `others`, count: values.length - idx });
  return distribution;
};

export const getFieldCounts = (animeList: AnimeItem[], field: AnimeField): FieldCount[] => {
  const counts: { [key: string]: number } = {};

  animeList.forEach((anime) => {
    const value = getFieldValue(anime, field);
    if (typeof value === 'object' && value !== null) {
      Object.keys(value).forEach((key) => {
        counts[key] = (counts[key] || 0) + 1;
      });
    }
  });

  return Object.entries(counts)
    .map(([field, count]) => ({
      field,
      count,
    }))
    .sort((a, b) => b.count - a.count);
};

export const getPercentiles = (data: AnimeItem[], field: AnimeField): Percentiles => {
  const values = data
    .map((item) => getNumericValue(item, field))
    .filter((value): value is number => value !== undefined)
    .sort((a, b) => a - b);

  const getPercentile = (p: number) => {
    const index = Math.floor((p / 100) * values.length);
    return values[index] || 0;
  };

  return {
    p99: getPercentile(99),
    p95: getPercentile(95),
    p90: getPercentile(90),
    p75: getPercentile(75),
    median: getPercentile(50),
    mean: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
    top100: values.length ? values.slice(-100)[0] : 0,
    top200: values.length ? values.slice(-200)[0] : 0,
    top500: values.length ? values.slice(-500)[0] : 0,
    top1000: values.length ? values.slice(-1000)[0] : 0,
  };
};

export const getTypeDistribution = (data: AnimeItem[]): TypeDistribution[] => {
  const counts: { [key: string]: number } = {};
  data.forEach((item) => {
    if (item.type) {
      counts[item.type] = (counts[item.type] || 0) + 1;
    }
  });

  return Object.entries(counts).map(([type, count]) => ({
    type,
    count,
  }));
};

const BASE_WEIGHTS: Record<NumericField, number> = {
  [AnimeField.Score]: 1,
  [AnimeField.Members]: 1,
  [AnimeField.Favorites]: 1,
  [AnimeField.Year]: 1,
  [AnimeField.Episodes]: 1,
  [AnimeField.ScoredBy]: 1,
  [AnimeField.Rank]: 1,
  [AnimeField.Popularity]: 1,
} as const;

const normalizeValue = (
  field: NumericField,
  value: number,
  minScore: number,
  maxScore: number
): number => {
  if (value <= 0) return 0;

  switch (field) {
    case AnimeField.Score:
      return Math.max(minScore, Math.min(maxScore, value)); // Already 1-10 scale

    case AnimeField.Members:
    case AnimeField.Favorites: {
      // Log transformation for better distribution
      return (Math.log(value + 1) / Math.log(maxScore + 1)) * 10;
    }

    case AnimeField.Year: {
      const currentYear = new Date().getFullYear();
      const range = currentYear - minScore;
      if (range <= 0) return 5;
      // Simple normalization with slight recency bias
      return ((value - minScore) / range) ** 0.8 * 10;
    }

    default:
      return value;
  }
};

const minMaxOfAnimeList = (data: AnimeItem[], field: NumericField) => {
  const cleanedValues = data
    .map((item) => item[field])
    .filter((v): v is number => v !== undefined && v > 0);
  const min = Math.min(...cleanedValues);
  const max = Math.max(...cleanedValues);
  return { min, max };
};

type FiltersWithScoreRange =
  | (Filter & {
      field: NumericField;
      minScore: number;
      maxScore: number;
    })
  | (Filter & {
      field: Exclude<AnimeField, NumericField>;
    });

// takes roughly 1ms, for 18000 anime, was taking upto 18s which is not ideal
const getAnimeScore = (anime: AnimeItem, filters: FiltersWithScoreRange[]): number => {
  const fieldWiseMultipliers: Map<
    AnimeField,
    ScoreMultiplier<number | string | string[]>
  > = filters.reduce((curr, acc) => {
    if (acc.score_multiplier) {
      curr.set(acc.field, acc.score_multiplier);
    }
    return curr;
  }, new Map());
  const baseScore = filters.reduce((currScore: number, filterVal: FiltersWithScoreRange) => {
    const animeField = filterVal.field;
    const value = anime[animeField];

    if (isNumericField(animeField)) {
      if (typeof value !== 'number') return currScore;
      const numericFilter = filterVal as Extract<FiltersWithScoreRange, { field: NumericField }>;
      const normalizedValue = normalizeValue(
        animeField,
        value,
        numericFilter.minScore,
        numericFilter.maxScore
      );
      const baseWeight = BASE_WEIGHTS[animeField] || 1;

      return (
        currScore +
        (1 + normalizedValue * baseWeight * ((fieldWiseMultipliers.get(animeField) as number) || 1))
      );
    }

    switch (animeField) {
      case AnimeField.Genres:
      case AnimeField.Themes: {
        const multiplier = fieldWiseMultipliers.get(animeField);
        const animeInfoForField = getMapValue(anime, animeField);
        if (multiplier) {
          Object.keys(animeInfoForField).forEach((fieldVal) => {
            const multiplierValue = (multiplier as { [key: string]: number })[fieldVal];
            if (multiplierValue !== undefined) {
              currScore *= multiplierValue;
            }
          });
        }
        return currScore;
      }

      default:
        return currScore;
    }
  }, 1);

  return baseScore;
};

type ScoredAnime = AnimeItem & { points: number };

// Top-K selection by partial sort. When `limit` is much smaller than the
// filtered list (typical pagesize 40 vs 14k anime), this is O(n + k log n)
// — orders of magnitude faster than the prior O(n log n) full sort.
const partialSortDescending = (items: ScoredAnime[], limit: number): ScoredAnime[] => {
  if (limit <= 0 || items.length === 0) return items;
  if (limit >= items.length) {
    return items.sort((a, b) => b.points - a.points);
  }
  // Build a min-heap of size `limit`; smallest element is at root.
  const heap: ScoredAnime[] = [];
  const swap = (i: number, j: number) => {
    const tmp = heap[i];
    heap[i] = heap[j];
    heap[j] = tmp;
  };
  const siftUp = (idx: number) => {
    let i = idx;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent].points <= heap[i].points) break;
      swap(parent, i);
      i = parent;
    }
  };
  const siftDown = (idx: number) => {
    const n = heap.length;
    let i = idx;
    for (;;) {
      const l = i * 2 + 1;
      const r = l + 1;
      let smallest = i;
      if (l < n && heap[l].points < heap[smallest].points) smallest = l;
      if (r < n && heap[r].points < heap[smallest].points) smallest = r;
      if (smallest === i) return;
      swap(i, smallest);
      i = smallest;
    }
  };
  for (const item of items) {
    if (heap.length < limit) {
      heap.push(item);
      siftUp(heap.length - 1);
    } else if (item.points > heap[0].points) {
      heap[0] = item;
      siftDown(0);
    }
  }
  return heap.sort((a, b) => b.points - a.points);
};

export const getScoreSortedList = (
  animeList: AnimeItem[],
  filters: Filter[],
  sortBy?: NumericField,
  limit?: number
): ScoredAnime[] => {
  const filtersWithScoreRange: FiltersWithScoreRange[] = filters.map((filter) => {
    if (!isNumericField(filter.field)) return filter as FiltersWithScoreRange;
    const { min, max } = minMaxOfAnimeList(animeList, filter.field);
    return {
      ...filter,
      minScore: min,
      maxScore: max,
    };
  });
  // Avoid spreading every anime into a new object; mutate-once with type cast
  // keeps allocations down on hot paths over the full 14k catalogue.
  const scored = animeList.map((anime) => {
    const points =
      sortBy && typeof anime[sortBy] === 'number'
        ? (anime[sortBy] as number)
        : getAnimeScore(anime, filtersWithScoreRange);
    (anime as ScoredAnime).points = points;
    return anime as ScoredAnime;
  });

  if (limit != null) {
    return partialSortDescending(scored, limit);
  }
  return scored.sort((a, b) => b.points - a.points);
};
