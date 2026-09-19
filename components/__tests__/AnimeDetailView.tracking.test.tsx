import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QueryProvider } from '@/lib/query-provider';
import AnimeDetailView from '../AnimeDetailView';

const fixture = vi.hoisted(() => ({
  user: { id: 'tracker' } as { id: string } | null,
  status: null as string | null,
  note: null as string | null,
  failAdd: false,
  // Simulates a lost acknowledgement: the write lands server-side but the
  // client observes an error.
  persistOnError: false,
  failNote: false,
  add: vi.fn(),
  updateNote: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: fixture.user }) }));
vi.mock('@/lib/analytics', () => ({ trackCoreAction: vi.fn(), trackActivated: vi.fn() }));
vi.mock('@/lib/api', () => ({
  getAnimeDetail: async () => ({
    anime: { mal_id: 1, title: 'Synthetic anime', genres: [], themes: [], demographics: [] },
    relations: [],
    recommendations: [],
    watchlistEntry:
      fixture.user && fixture.status ? { status: fixture.status, note: fixture.note } : null,
  }),
  getWatchlistTags: async () => ({ tags: [] }),
  addToWatchlist: async (ids: number[], status: string) => {
    fixture.add(ids, status);
    if (fixture.failAdd) {
      if (fixture.persistOnError) fixture.status = status;
      throw new Error('save failed');
    }
    fixture.status = status;
  },
  removeFromWatchlist: vi.fn(),
  updateAnimeNote: async (_malId: number, note: string) => {
    fixture.updateNote(note);
    if (fixture.failNote) throw new Error('note save failed');
    fixture.note = note;
    return { success: true, note };
  },
  addToSchedule: vi.fn(),
}));

beforeEach(() => {
  fixture.user = { id: 'tracker' };
  fixture.status = null;
  fixture.note = null;
  fixture.failAdd = false;
  fixture.persistOnError = false;
  fixture.failNote = false;
  fixture.add.mockClear();
  fixture.updateNote.mockClear();
});
afterEach(cleanup);

const detail = (malId = 1) => (
  <QueryProvider>
    <AnimeDetailView key={`${fixture.user?.id ?? 'guest'}:${malId}`} malId={malId} isModal />
  </QueryProvider>
);

it('tracks from detail, restores the saved status after remount, and explains guest access', async () => {
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

it('tells the truth after a failed save and persists the retry', async () => {
  fixture.status = 'Done';
  fixture.failAdd = true;
  const view = render(detail());

  fireEvent.click(await screen.findByRole('button', { name: 'Edit watchlist status: Done' }));
  fireEvent.click(screen.getByRole('button', { name: 'Watching', exact: true }));

  // The failed write surfaces an error and the display falls back to the
  // durable status instead of sticking on the optimistic pick.
  await screen.findByText(/didn't save/);
  await screen.findByRole('button', { name: 'Edit watchlist status: Done' });

  // Signing out after the failure drops to the guest state with no stale
  // status or error left mounted.
  fixture.user = null;
  view.rerender(detail());
  const guestAction = await screen.findByRole('button', {
    name: 'Sign in to track this anime',
  });
  expect(guestAction).toBeDisabled();
  expect(screen.queryByText(/didn't save/)).not.toBeInTheDocument();
  cleanup();

  // A retry on a healthy session persists the intended status.
  fixture.user = { id: 'tracker' };
  fixture.failAdd = false;
  render(detail());
  fireEvent.click(await screen.findByRole('button', { name: 'Edit watchlist status: Done' }));
  fireEvent.click(screen.getByRole('button', { name: 'Watching', exact: true }));
  await screen.findByRole('button', { name: 'Edit watchlist status: Watching' });
  expect(fixture.add).toHaveBeenLastCalledWith([1], 'Watching');
  expect(screen.queryByText(/didn't save/)).not.toBeInTheDocument();
});

it('shows the durable record when a save acknowledgement is lost', async () => {
  fixture.failAdd = true;
  fixture.persistOnError = true; // write lands, response never arrives
  render(detail());

  fireEvent.click(await screen.findByRole('button', { name: 'Add to watchlist' }));
  fireEvent.click(screen.getByRole('button', { name: 'Watching', exact: true }));

  // The failed mutation re-reads the detail, so the displayed status is the
  // value the server actually holds — not a stale optimistic or reverted one.
  await screen.findByText(/didn't save/);
  await screen.findByRole('button', { name: 'Edit watchlist status: Watching' });
});

it('keeps an unsaved note draft when a later detail read arrives', async () => {
  fixture.status = 'Watching';
  fixture.note = 'saved note';
  render(detail());

  const editor = await screen.findByPlaceholderText('Document your thoughts...');
  await waitFor(() => expect(editor).toHaveValue('saved note'));
  fireEvent.change(editor, { target: { value: 'unsaved draft' } });

  // A different device saved meanwhile; the next status change re-reads the
  // detail and must not clobber the in-progress draft.
  fixture.note = 'changed elsewhere';
  fireEvent.click(screen.getByRole('button', { name: 'Edit watchlist status: Watching' }));
  fireEvent.click(screen.getByRole('button', { name: 'Done', exact: true }));
  await screen.findByRole('button', { name: 'Edit watchlist status: Done' });

  expect(editor).toHaveValue('unsaved draft');
});

it('reports a failed note save, keeps the draft, and persists on retry', async () => {
  fixture.status = 'Watching';
  fixture.note = null;
  render(detail());

  const editor = await screen.findByPlaceholderText('Document your thoughts...');
  fireEvent.change(editor, { target: { value: 'first attempt' } });

  fixture.failNote = true;
  fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
  await screen.findByText(/Couldn't save the note/);
  expect(editor).toHaveValue('first attempt');

  fixture.failNote = false;
  fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
  await waitFor(() => expect(screen.queryByText(/Couldn't save the note/)).not.toBeInTheDocument());
  expect(fixture.updateNote).toHaveBeenLastCalledWith('first attempt');
  expect(fixture.note).toBe('first attempt');
});

it('resets a note draft when the detail identity changes, but keeps it for a refetch', async () => {
  fixture.status = 'Watching';
  fixture.note = 'saved note';
  const view = render(detail());
  const editor = await screen.findByPlaceholderText('Document your thoughts...');
  await waitFor(() => expect(editor).toHaveValue('saved note'));

  fireEvent.change(editor, { target: { value: 'unsaved draft' } });
  fixture.note = 'other anime note';
  view.rerender(detail(2));
  const otherEditor = await screen.findByPlaceholderText('Document your thoughts...');
  await waitFor(() => expect(otherEditor).toHaveValue('other anime note'));

  fireEvent.change(otherEditor, { target: { value: 'same anime draft' } });
  fixture.note = 'server changed note';
  view.rerender(detail(2));
  await waitFor(() => expect(otherEditor).toHaveValue('same anime draft'));
});

it('clears an in-progress draft when the account identity changes', async () => {
  fixture.status = 'Watching';
  fixture.note = 'account A note';
  const view = render(detail());
  const editor = await screen.findByPlaceholderText('Document your thoughts...');
  await waitFor(() => expect(editor).toHaveValue('account A note'));
  fireEvent.change(editor, { target: { value: 'private account A draft' } });

  fixture.user = null;
  view.rerender(detail());
  await waitFor(() => {
    expect(screen.queryByDisplayValue('private account A draft')).not.toBeInTheDocument();
    expect(screen.queryByText('private account A draft')).not.toBeInTheDocument();
  });
});
