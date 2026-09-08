import { describe, expect, it } from 'vitest';
import { enrichAnimeRelations } from './animeDetailRelations';

describe('related title identity', () => {
  it('keeps a manga adaptation distinct from an anime with the same MAL ID', () => {
    const relations = enrichAnimeRelations(
      [
        {
          relation: 'Adaptation',
          entries: [
            {
              mal_id: 174,
              type: 'manga',
              name: 'Cowboy Bebop',
              url: 'https://myanimelist.net/manga/174',
            },
            {
              mal_id: 174,
              type: 'anime',
              name: 'Tenjou Tenge',
              url: 'https://myanimelist.net/anime/174',
            },
          ],
        },
      ],
      new Map([
        [
          174,
          {
            mal_id: 174,
            title: 'Tenjou Tenge',
            title_english: 'Tenjho Tenge',
            type: 'TV',
            url: 'https://myanimelist.net/anime/174',
            year: 2004,
          },
        ],
      ])
    );
    expect(relations[0]).toMatchObject({
      title: 'Cowboy Bebop',
      type: 'manga',
      url: 'https://myanimelist.net/manga/174',
    });
    expect(relations[0].title_english).toBeUndefined();
    expect(relations[0].year).toBeUndefined();
    expect(relations[1]).toMatchObject({ title_english: 'Tenjho Tenge', type: 'TV', year: 2004 });
  });
});
