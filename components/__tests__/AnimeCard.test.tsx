import { vi } from 'vitest';
import type React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { AnimeSummary } from '@/lib/types';

const { mockInvalidateQueries, mockMutate, mockSearchLocation, mockTrackDiscoveryEvent } =
  vi.hoisted(() => ({
    mockInvalidateQueries: vi.fn(),
    mockMutate: vi.fn(),
    mockTrackDiscoveryEvent: vi.fn(),
    mockSearchLocation: { pathname: '/search', searchStr: '?af=score%3E%3D8&airing=no&page=3' },
  }));
let mockUser: { id: string } | null = null;
let mockWatchlistData = {
  user: { id: 'u1', name: 'user' },
  anime: {} as Record<string, { status: string }>,
};

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    state,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
    state?: (previous: Record<string, unknown>) => Record<string, unknown>;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  }) => {
    const linkState = state?.({});
    return (
      <a
        href={to}
        data-return-to-search={linkState?.returnToSearch}
        onClick={(event) => {
          event.preventDefault();
          onClick?.(event);
        }}
        {...props}
      >
        {children}
      </a>
    );
  },
  useRouterState: ({
    select,
  }: {
    select: (state: { location: typeof mockSearchLocation }) => unknown;
  }) => select({ location: mockSearchLocation }),
}));

vi.mock('@/lib/use-resource-query', () => ({
  useResourceQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === 'watchlist' && queryKey[1] === 'tags') {
      return { data: { tags: [] } };
    }
    if (queryKey[0] === 'watchlist') {
      return { data: mockWatchlistData };
    }
    return { data: undefined };
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutate: mockMutate, isPending: false }),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

vi.mock('@/lib/api', () => ({
  addToWatchlist: vi.fn(),
  removeFromWatchlist: vi.fn(),
  addToSchedule: vi.fn(),
  getWatchlist: vi.fn().mockResolvedValue({ user: { id: 'u1', name: 'user' }, anime: {} }),
  getWatchlistTags: vi.fn().mockResolvedValue({ tags: [] }),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: mockUser }),
}));
vi.mock('@/lib/analytics', () => ({
  trackActivated: vi.fn(),
  trackCoreAction: vi.fn(),
  trackDiscoveryEvent: mockTrackDiscoveryEvent,
}));

import AnimeCard from '../AnimeCard';

const baseAnime: AnimeSummary = {
  id: 1,
  score: 9.0,
  points: 200,
  name: 'Shingeki no Kyojin',
  link: 'https://myanimelist.net/anime/16498',
  synopsis:
    'Centuries ago, mankind was slaughtered to near extinction by monstrous humanoid creatures called Titans.',
  members: 3500000,
  favorites: 180000,
  year: 2013,
  status: 'Finished Airing',
  genres: ['Action', 'Drama'],
  themes: ['Military'],
  type: 'TV',
  image: 'https://example.com/aot.jpg',
};

describe('AnimeCard', () => {
  beforeEach(() => {
    mockUser = null;
    mockSearchLocation.pathname = '/search';
    mockSearchLocation.searchStr = '?af=score%3E%3D8&airing=no&page=3';
    mockWatchlistData = {
      user: { id: 'u1', name: 'user' },
      anime: {},
    };
    mockInvalidateQueries.mockClear();
    mockMutate.mockClear();
    mockTrackDiscoveryEvent.mockClear();
  });

  it('displays English title when title_english is provided', () => {
    const anime = { ...baseAnime, title_english: 'Attack on Titan' };
    render(<AnimeCard anime={anime} />);

    expect(screen.getByText('Attack on Titan')).toBeInTheDocument();
  });

  it('falls back to Japanese name when title_english is undefined', () => {
    render(<AnimeCard anime={baseAnime} />);

    expect(screen.getByText('Shingeki no Kyojin')).toBeInTheDocument();
  });

  it('falls back to Japanese name when title_english is empty string', () => {
    const anime = { ...baseAnime, title_english: '' };
    render(<AnimeCard anime={anime} />);

    expect(screen.getByText('Shingeki no Kyojin')).toBeInTheDocument();
  });

  it('uses English title for image alt text', () => {
    const anime = { ...baseAnime, title_english: 'Attack on Titan' };
    render(<AnimeCard anime={anime} />);

    const img = screen.getByAltText('Attack on Titan');
    expect(img).toBeInTheDocument();
  });

  it('uses Japanese name for image alt when no English title', () => {
    render(<AnimeCard anime={baseAnime} />);

    const img = screen.getByAltText('Shingeki no Kyojin');
    expect(img).toBeInTheDocument();
  });

  it('routes internal detail links to the anime page', () => {
    render(<AnimeCard anime={baseAnime} />);

    const links = screen.getAllByRole('link');
    expect(links.some((link) => link.getAttribute('href') === '/anime/1')).toBe(true);
  });

  it('carries the current filtered search URL into detail navigation', () => {
    render(<AnimeCard anime={baseAnime} />);

    const detailLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/anime/1');
    expect(detailLinks).toHaveLength(2);
    for (const link of detailLinks) {
      expect(link).toHaveAttribute(
        'data-return-to-search',
        '/search?af=score%3E%3D8&airing=no&page=3'
      );
    }
  });

  it('tracks poster and title choices without sending card data', () => {
    render(<AnimeCard anime={baseAnime} />);

    const links = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/anime/1');
    fireEvent.click(links[0]!);
    fireEvent.click(links[1]!);

    expect(mockTrackDiscoveryEvent.mock.calls).toEqual([
      ['discovery.choice_selected'],
      ['discovery.choice_selected'],
    ]);
  });

  it('does not carry a search return path when opened outside search', () => {
    mockSearchLocation.pathname = '/watchlist';
    render(<AnimeCard anime={baseAnime} />);

    const detailLink = screen
      .getAllByRole('link')
      .find((link) => link.getAttribute('href') === '/anime/1');
    expect(detailLink).not.toHaveAttribute('data-return-to-search');
  });

  it('keeps an external MAL link available', () => {
    render(<AnimeCard anime={baseAnime} />);

    expect(
      screen.getByRole('link', { name: 'Open Shingeki no Kyojin on MyAnimeList' })
    ).toHaveAttribute('href', 'https://myanimelist.net/anime/16498');
  });

  it('displays score badge', () => {
    render(<AnimeCard anime={baseAnime} />);

    expect(screen.getByText('9.0')).toBeInTheDocument();
  });

  it('displays year and member count', () => {
    render(<AnimeCard anime={baseAnime} />);

    expect(screen.getByText('2013')).toBeInTheDocument();
    expect(screen.getByText('3500k users')).toBeInTheDocument();
  });

  it('keeps the watchlist control editable for anime already in the watchlist', () => {
    mockUser = { id: 'u1' };
    mockWatchlistData = {
      user: { id: 'u1', name: 'user' },
      anime: {
        '1': { status: 'Watching' },
      },
    };

    render(<AnimeCard anime={baseAnime} />);

    expect(
      screen.getByRole('button', { name: 'Edit watchlist status: Watching' })
    ).toBeInTheDocument();
    expect(screen.getByText('Watching')).toBeInTheDocument();
  });

  it('unselects the current tag when it is clicked again', () => {
    mockUser = { id: 'u1' };
    mockWatchlistData = {
      user: { id: 'u1', name: 'user' },
      anime: { '1': { status: 'Watching' } },
    };

    render(<AnimeCard anime={baseAnime} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit watchlist status: Watching' }));
    fireEvent.click(screen.getByRole('button', { pressed: true }));

    expect(screen.getByRole('button', { name: 'Add to watchlist' })).toBeInTheDocument();
  });
});
