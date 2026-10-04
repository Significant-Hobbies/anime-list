import { describe, expect, it } from 'vitest';
import { AnimeField } from '../config';
import { getScoreSortedList } from './statistics';
import type { AnimeItem } from '../types/anime';

const anime = (mal_id: number, score?: number): AnimeItem => ({
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

  it('keeps missing sort values last while JSON exposes the D1-compatible zero', () => {
    const missingScore: AnimeItem = { ...anime(2), score: undefined };
    const items = [...TIED_CATALOG, missingScore];
    const sorted = getScoreSortedList(items, [], AnimeField.Score);
    expect(sorted.map((item) => item.mal_id)).toEqual([1, 10, 20, 30, 5, 2]);

    const serialized = JSON.parse(JSON.stringify(sorted)) as Array<{
      mal_id: number;
      points: number | null;
    }>;
    expect(serialized.map(({ mal_id, points }) => [mal_id, points])).toEqual([
      [1, 10],
      [10, 9],
      [20, 9],
      [30, 9],
      [5, 8],
      [2, 0],
    ]);
    expect(serialized.some(({ points }) => points === null)).toBe(false);
  });

  it('clears the missing-value marker when the same catalog row is later populated', () => {
    const newlyScored = anime(2);
    const items = [newlyScored, anime(1, 9)];
    expect(getScoreSortedList(items, [], AnimeField.Score).map((item) => item.mal_id)).toEqual([
      1, 2,
    ]);

    newlyScored.score = 10;
    expect(getScoreSortedList(items, [], AnimeField.Score).map((item) => item.mal_id)).toEqual([
      2, 1,
    ]);
  });

  it('keeps tie membership stable across a nonzero offset page', () => {
    const pageSize = 2;
    const offset = 1;
    const sortedWindow = getScoreSortedList(
      [...TIED_CATALOG].reverse(),
      [],
      AnimeField.Score,
      pageSize + offset
    );
    expect(sortedWindow.slice(offset, offset + pageSize).map((item) => item.mal_id)).toEqual([
      10, 20,
    ]);
  });

  it('keeps identical top-K tie membership through the heap path', () => {
    const expected = [1, 10];
    const forward = getScoreSortedList([...TIED_CATALOG], [], AnimeField.Score, 2);
    const reversed = getScoreSortedList([...TIED_CATALOG].reverse(), [], AnimeField.Score, 2);
    expect(forward.map((item) => item.mal_id)).toEqual(expected);
    expect(reversed.map((item) => item.mal_id)).toEqual(expected);
  });
});
