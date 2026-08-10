import { buildTasteRecommendations } from './recommendations';
import type { AnimeItem } from './types/anime';
import type { WatchlistData } from './types/watchlist';

const anime = (
  mal_id: number,
  title: string,
  genres: string[],
  themes: string[] = []
): AnimeItem => ({
  mal_id,
  title,
  url: `https://myanimelist.net/anime/${mal_id}`,
  score: 8,
  scored_by: 1000,
  rank: 1,
  popularity: 1,
  members: 100000,
  favorites: 1000,
  year: 2024,
  status: 'Finished Airing',
  type: 'TV',
  genres: Object.fromEntries(genres.map((genre) => [genre, 1])),
  themes: Object.fromEntries(themes.map((theme) => [theme, 1])),
  demographics: {},
});

describe('buildTasteRecommendations', () => {
  it('scores unseen anime from positive watchlist signals', () => {
    const watchlist: WatchlistData = {
      user: { id: 'u1', name: 'User' },
      anime: {
        '1': { id: '1', status: 'Done' },
        '2': { id: '2', status: 'Watching' },
      },
    };

    const result = buildTasteRecommendations(
      [
        anime(1, 'Watched action', ['Action'], ['Strategy']),
        anime(2, 'Watched drama', ['Drama'], ['Strategy']),
        anime(3, 'Best match', ['Action', 'Drama'], ['Strategy']),
        anime(4, 'Weak match', ['Comedy']),
      ],
      watchlist,
      2
    );

    expect(result.profile.favoriteGenres.map((signal) => signal.name).sort()).toEqual([
      'Action',
      'Drama',
    ]);
    expect(result.recommendations[0]).toMatchObject({
      mal_id: 3,
      title: 'Best match',
    });
    expect(result.recommendations[0].reasons).toContain('matches Action');
  });

  it('does not recommend already watched titles', () => {
    const watchlist: WatchlistData = {
      user: { id: 'u1', name: 'User' },
      anime: {
        '1': { id: '1', status: 'Done' },
      },
    };

    const result = buildTasteRecommendations(
      [anime(1, 'Watched', ['Action']), anime(2, 'Unseen', ['Action'])],
      watchlist
    );

    expect(result.recommendations.map((item) => item.mal_id)).toEqual([2]);
  });

  it('keeps only the highest-ranked recommendations in stable order', () => {
    const watchlist: WatchlistData = {
      user: { id: 'u1', name: 'User' },
      anime: {
        '1': { id: '1', status: 'Done' },
      },
    };

    const result = buildTasteRecommendations(
      [
        anime(1, 'Watched', ['Action']),
        { ...anime(2, 'Lower score', ['Action']), score: 7 },
        { ...anime(3, 'First tied score', ['Action']), score: 8 },
        { ...anime(4, 'Highest score', ['Action']), score: 9 },
        { ...anime(5, 'Second tied score', ['Action']), score: 8 },
      ],
      watchlist,
      3
    );

    expect(result.recommendations.map((item) => item.mal_id)).toEqual([4, 3, 5]);
  });
});
