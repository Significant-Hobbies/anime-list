import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import StatsPage from './StatsPage';

const { getWatchlistTags } = vi.hoisted(() => ({ getWatchlistTags: vi.fn() }));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'test-account' }, loading: false }),
}));
vi.mock('@/lib/api', () => ({
  getWatchlistTags,
  getStats: async () => ({
    totalAnime: 42,
    scoreDistribution: [],
    membersDistribution: [],
    favoritesDistribution: [],
    yearDistribution: [],
    percentiles: {},
    genreCounts: [],
    themeCounts: [],
    demographicCounts: [],
    typeDistribution: [],
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  getWatchlistTags.mockReset();
});

it('recovers failed tags and retains the verified empty result during a background read', async () => {
  let rejectTags: (reason: Error) => void = () => {};
  let rejectRefresh: (reason: Error) => void = () => {};
  const initialRead = new Promise((_, reject) => {
    rejectTags = reject;
  });
  getWatchlistTags
    .mockReturnValueOnce(initialRead)
    .mockResolvedValueOnce({ tags: [] })
    .mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectRefresh = reject;
        })
    )
    .mockResolvedValueOnce({ tags: [] });
  let now = Date.now();
  vi.spyOn(Date, 'now').mockImplementation(() => now);

  render(
    <QueryClientProvider client={new QueryClient()}>
      <StatsPage />
    </QueryClientProvider>
  );

  expect(await screen.findByText('Loading watchlist tags…')).toBeVisible();
  expect(screen.queryByText('No tags yet')).not.toBeInTheDocument();
  await act(async () => {
    rejectTags(Object.assign(new Error('Read failed'), { status: 400 }));
  });
  const retry = await screen.findByRole('button', { name: 'Retry tags' });
  expect(screen.getByRole('alert')).toHaveTextContent('Could not load watchlist tags.');
  expect(screen.queryByText('No tags yet')).not.toBeInTheDocument();
  expect(screen.getByText('total anime: 42')).toBeVisible();

  fireEvent.click(retry);
  expect(screen.getByRole('group', { name: 'Watchlist filters' })).toHaveFocus();
  expect(await screen.findByText('No tags yet')).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();

  now += 31_000;
  fireEvent(window, new Event('online'));
  await waitFor(() => expect(getWatchlistTags).toHaveBeenCalledTimes(3));
  expect(screen.getByText('No tags yet')).toBeVisible();
  expect(screen.queryByText('Loading watchlist tags…')).not.toBeInTheDocument();
  await act(async () => {
    rejectRefresh(Object.assign(new Error('Refresh failed'), { status: 400 }));
  });
  const retryRefresh = await screen.findByRole('button', { name: 'Retry tags' });
  expect(screen.getByText('No tags yet')).toBeVisible();
  expect(screen.getByRole('alert')).toHaveTextContent('Could not refresh watchlist tags.');

  fireEvent.click(retryRefresh);
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(screen.getByText('No tags yet')).toBeVisible();
});
