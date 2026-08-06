import { describe, expect, it, vi } from 'vitest';
import { AnimeField, FilterAction } from '../config';
import { buildAnimeSearchWhere, getSimpleAnimeSearchPage } from './animeData';
import { setDbClient, type DatabaseClient } from './client';

describe('buildAnimeSearchWhere', () => {
  it('translates the default popularity filter', () => {
    expect(
      buildAnimeSearchWhere(
        [
          {
            field: AnimeField.Members,
            action: FilterAction.GreaterThanOrEquals,
            value: 100_000,
          },
        ],
        'any'
      )
    ).toEqual({ whereClause: 'WHERE members >= ?', args: [100_000] });
  });

  it('translates title, genre, and airing filters to parameterized SQL', () => {
    const result = buildAnimeSearchWhere(
      [
        { field: AnimeField.Title, action: FilterAction.Contains, value: 'bebop' },
        {
          field: AnimeField.Genres,
          action: FilterAction.IncludesAll,
          value: ['Action', 'Sci-Fi'],
        },
      ],
      'yes'
    );

    expect(result?.whereClause).toContain('instr(lower(title), lower(?)) > 0');
    expect(result?.whereClause).toContain("COALESCE(title_english, '')");
    expect(result?.whereClause.match(/EXISTS/g)).toHaveLength(2);
    expect(result?.whereClause).toContain("lower(status) = 'currently airing'");
    expect(result?.args).toEqual(['bebop', 'bebop', 'Action', 'Sci-Fi']);
  });

  it('falls back for weighted ranking filters', () => {
    expect(
      buildAnimeSearchWhere(
        [
          {
            field: AnimeField.Score,
            action: FilterAction.GreaterThanOrEquals,
            value: 7,
            score_multiplier: 2,
          },
        ],
        'any'
      )
    ).toBeNull();
  });

  it('gets the page and total count in one D1 batch call', async () => {
    const execute = vi.fn();
    const batch = vi.fn(async () => [
      { rows: [{ count: 42 }], rowsAffected: 0 },
      {
        rows: [
          {
            mal_id: 1,
            url: 'https://example.com/anime/1',
            title: 'Cowboy Bebop',
            score: 8.75,
            genres: '{}',
            themes: '{}',
            demographics: '{}',
          },
        ],
        rowsAffected: 0,
      },
    ]);
    setDbClient({ execute, batch } as DatabaseClient);

    const result = await getSimpleAnimeSearchPage({
      filters: [],
      sortBy: AnimeField.Score,
      airing: 'any',
      pagesize: 40,
      offset: 0,
    });

    expect(execute).not.toHaveBeenCalled();
    expect(batch).toHaveBeenCalledOnce();
    expect(batch).toHaveBeenCalledWith(
      [
        { sql: expect.stringContaining('SELECT COUNT(*) AS count'), args: [] },
        { sql: expect.stringContaining('ORDER BY score DESC'), args: [40, 0] },
      ],
      'read'
    );
    expect(result).toMatchObject({
      totalFiltered: 42,
      page: [{ mal_id: 1, title: 'Cowboy Bebop', points: 8.75 }],
    });
  });
});
