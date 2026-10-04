import { describe, expect, it } from 'vitest';
import { AnimeField } from '../config';
import { getScoreSortedList } from './statistics';
import type { AnimeItem } from '../types/anime';

const anime = (mal_id: number, score: number): AnimeItem => ({
  mal_id,
  url: `https://example.invalid/anime/${mal_id}`,
  title: `Anime ${mal_id}`,
  score,
  genres: {},
  themes: {},
  demographics: {},
});

const TIED_CATALOG = [anime(30, 9), anime(10, 9), anime(20, 9), anime(5, 8), anime(1, 10)];

describe('getScoreSortedList', () => {
  it('breaks points ties by mal_id asc, matching the D1 search path', () => {
    const sorted = getScoreSortedList([...TIED_CATALOG], [], AnimeField.Score);
    expect(sorted.map((item) => item.mal_id)).toEqual([1, 10, 20, 30, 5]);
  });

  it('returns the same ordering regardless of catalog input order', () => {
    const forward = getScoreSortedList([...TIED_CATALOG], [], AnimeField.Score);
    const reversed = getScoreSortedList([...TIED_CATALOG].reverse(), [], AnimeField.Score);
    expect(reversed.map((item) => item.mal_id)).toEqual(forward.map((item) => item.mal_id));
  });

  it('sorts items missing the sort field last', () => {
    const missingScore: AnimeItem = { ...anime(10, 0), score: undefined };
    const items = [anime(30, 9), missingScore, anime(20, 8)];
    const sorted = getScoreSortedList(items, [], AnimeField.Score);
    expect(sorted.map((item) => item.mal_id)).toEqual([30, 20, 10]);
  });

  it('keeps identical top-K tie membership through the heap path', () => {
    const expected = [1, 10];
    const forward = getScoreSortedList([...TIED_CATALOG], [], AnimeField.Score, 2);
    const reversed = getScoreSortedList([...TIED_CATALOG].reverse(), [], AnimeField.Score, 2);
    expect(forward.map((item) => item.mal_id)).toEqual(expected);
    expect(reversed.map((item) => item.mal_id)).toEqual(expected);
  });
});
