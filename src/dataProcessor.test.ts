import { describe, expect, it } from 'vitest';
import { transformRawAnime, transformRawManga } from './dataProcessor';
import type { RawAnimeData } from './types/anime';
import type { RawMangaData } from './types/manga';

describe('catalog provider response contract', () => {
  it('normalizes a Tenrai anime response without losing required catalog fields', () => {
    const rawAnime = {
      mal_id: 1,
      url: 'https://myanimelist.net/anime/1/Cowboy_Bebop',
      title: 'Cowboy Bebop',
      title_english: 'Cowboy Bebop',
      type: 'TV',
      episodes: 26,
      aired: { from: '1998-04-03T00:00:00+00:00', to: '1999-04-24T00:00:00+00:00' },
      score: 8.75,
      scored_by: 1_074_094,
      rank: 46,
      popularity: 43,
      members: 2_083_215,
      favorites: 90_704,
      synopsis: 'A space western.',
      season: 'spring',
      status: 'Finished Airing',
      images: { webp: { image_url: 'https://cdn.myanimelist.net/cowboy-bebop.webp' } },
      genres: [{ name: 'Action' }],
      themes: [{ name: 'Space' }],
      demographics: [{ name: 'Seinen' }],
    } satisfies RawAnimeData[0];

    expect(transformRawAnime(rawAnime)).toMatchObject({
      mal_id: 1,
      score: 8.75,
      scored_by: 1_074_094,
      members: 2_083_215,
      favorites: 90_704,
      aired: {
        from: '1998-04-03T00:00:00+00:00',
        to: '1999-04-24T00:00:00+00:00',
      },
      year: 1998,
      image: 'https://cdn.myanimelist.net/cowboy-bebop.webp',
      genres: { Action: 1 },
      themes: { Space: 1 },
      demographics: { Seinen: 1 },
    });
  });

  it('normalizes a Tenrai manga response and derives its publication year', () => {
    const rawManga = {
      mal_id: 2,
      url: 'https://myanimelist.net/manga/2/Berserk',
      title: 'Berserk',
      type: 'Manga',
      chapters: 390,
      volumes: 43,
      published: { from: '1989-08-25T00:00:00+00:00', to: '' },
      score: 9.46,
      scored_by: 404_332,
      rank: 1,
      popularity: 1,
      members: 808_113,
      favorites: 139_315,
      synopsis: 'A dark fantasy.',
      status: 'Publishing',
      images: { jpg: { image_url: 'https://cdn.myanimelist.net/berserk.jpg' } },
      genres: [{ name: 'Action' }, { name: 'Fantasy' }],
      themes: [],
      demographics: [{ name: 'Seinen' }],
    } satisfies RawMangaData[0];

    expect(transformRawManga(rawManga)).toMatchObject({
      mal_id: 2,
      score: 9.46,
      scored_by: 404_332,
      members: 808_113,
      favorites: 139_315,
      published: {
        from: '1989-08-25T00:00:00+00:00',
        to: '',
      },
      year: 1989,
      image: 'https://cdn.myanimelist.net/berserk.jpg',
      genres: { Action: 1, Fantasy: 1 },
      themes: {},
      demographics: { Seinen: 1 },
    });
  });
});
