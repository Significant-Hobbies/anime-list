import { describe, expect, it } from 'vitest';
import { boundedReadPage, compareWatchlistIds, pageReadItems } from './readPagination';

describe('read pagination', () => {
  it('enumerates a large watchlist through stable non-overlapping pages', () => {
    const entries = Array.from({ length: 123 }, (_, index) => ({ id: String(123 - index) })).sort(
      compareWatchlistIds
    );
    const first = pageReadItems(entries, { limit: 50, offset: 0 });
    const middle = pageReadItems(entries, { limit: 50, offset: 50 });
    const terminal = pageReadItems(entries, { limit: 50, offset: 100 });

    expect(first).toMatchObject({ total: 123, nextOffset: 50, hasMore: true });
    expect(middle).toMatchObject({ total: 123, nextOffset: 100, hasMore: true });
    expect(terminal).toMatchObject({ total: 123, nextOffset: null, hasMore: false });
    expect(terminal.items).toHaveLength(23);
    expect(
      new Set([...first.items, ...middle.items, ...terminal.items].map((item) => item.id)).size
    ).toBe(123);
  });

  it('bounds malformed and oversized page inputs', () => {
    expect(boundedReadPage('500', '-10')).toEqual({ limit: 50, offset: 0 });
    expect(boundedReadPage('nope', 'nope')).toEqual({ limit: 50, offset: 0 });
  });
});
