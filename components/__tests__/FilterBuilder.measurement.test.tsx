import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { withNuqsTestingAdapter } from 'nuqs/adapters/testing';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  trackDiscoveryEvent: vi.fn(),
  user: { id: 'measurement-test' },
}));

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: fixture.user }) }));
vi.mock('@/lib/analytics', () => ({
  trackCoreAction: vi.fn(),
  trackDiscoveryEvent: fixture.trackDiscoveryEvent,
}));
vi.mock('@/lib/use-resource-query', () => ({
  useResourceQuery: ({ queryKey, initialData }: { queryKey: string[]; initialData?: unknown }) => {
    if (queryKey[0] === 'watchlist' && queryKey[1] === 'tags') {
      return { data: { tags: [{ id: 'tag-1', tag: 'Done', count: 1, color: '#34d399' }] } };
    }
    if (queryKey[0] === 'search') {
      return { data: { totalFiltered: 0, filteredList: [] }, isFetching: false };
    }
    if (queryKey[0] === 'catalogCounts') return { data: { anime: 1 } };
    return { data: initialData, isFetching: false };
  },
}));

import FilterBuilder from '../FilterBuilder';

beforeEach(() => fixture.trackDiscoveryEvent.mockClear());
afterEach(cleanup);

it('tracks list mode and tag changes with fixed event names only', () => {
  render(<FilterBuilder />, {
    wrapper: withNuqsTestingAdapter({ searchParams: '?wt=Done&wm=hide' }),
  });

  fireEvent.click(screen.getByRole('button', { name: 'Show only selected tags' }));
  fireEvent.click(screen.getByRole('button', { name: 'Done', pressed: true }));

  expect(fixture.trackDiscoveryEvent.mock.calls).toEqual([
    ['discovery.list_filter_changed'],
    ['discovery.list_filter_changed'],
  ]);
});
