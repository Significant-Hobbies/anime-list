import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { QueryProvider } from '@/lib/query-provider';
import AnimeDetailView from '../AnimeDetailView';

const fixture = vi.hoisted(() => ({
  user: { id: 'tracker' } as { id: string } | null,
  status: null as string | null,
  add: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: fixture.user }) }));
vi.mock('@/lib/analytics', () => ({ trackCoreAction: vi.fn(), trackActivated: vi.fn() }));
vi.mock('@/lib/api', () => ({
  getAnimeDetail: async () => ({
    anime: { mal_id: 1, title: 'Synthetic anime', genres: [], themes: [], demographics: [] },
    relations: [],
    recommendations: [],
    watchlistEntry: fixture.user && fixture.status ? { status: fixture.status } : null,
  }),
  getWatchlistTags: async () => ({ tags: [] }),
  addToWatchlist: async (ids: number[], status: string) => {
    fixture.add(ids, status);
    fixture.status = status;
  },
  removeFromWatchlist: vi.fn(),
  updateAnimeNote: vi.fn(),
  addToSchedule: vi.fn(),
}));
afterEach(cleanup);

it('tracks from detail, restores the saved status after remount, and explains guest access', async () => {
  const detail = () => (
    <QueryProvider>
      <AnimeDetailView malId={1} isModal />
    </QueryProvider>
  );
  const first = render(detail());
  fireEvent.click(await screen.findByRole('button', { name: 'Add to watchlist' }));
  fireEvent.click(screen.getByRole('button', { name: 'Watching', exact: true }));
  await waitFor(() => expect(fixture.add).toHaveBeenCalledWith([1], 'Watching'));
  first.unmount();
  const restored = render(detail());
  await screen.findByRole('button', { name: 'Edit watchlist status: Watching' });
  fixture.user = null;
  restored.rerender(detail());
  const guestAction = await screen.findByRole('button', { name: 'Sign in to track this anime' });
  expect(guestAction).toBeDisabled();
  expect(screen.queryByText('IN LIST: Watching')).not.toBeInTheDocument();
  fireEvent.click(guestAction);
  expect(fixture.add).toHaveBeenCalledTimes(1);
});
