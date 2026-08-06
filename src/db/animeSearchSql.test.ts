import { describe, expect, it } from 'vitest';
import { AnimeField, FilterAction } from '../config';
import { buildAnimeSearchWhere } from './animeData';

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
});
