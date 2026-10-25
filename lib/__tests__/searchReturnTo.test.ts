import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import {
  getAnimeDetailLinkState,
  getAnimeSearchReturnTo,
  getAnimeSearchReturnToLocation,
} from '@/lib/searchReturnTo';

describe('getAnimeSearchReturnTo', () => {
  it('preserves the originating search query and page', () => {
    expect(
      getAnimeSearchReturnTo({
        returnToSearch: '/search?af=score%3E%3D8%26type%3DTV&airing=no&page=3',
      })
    ).toBe('/search?af=score%3E%3D8%26type%3DTV&airing=no&page=3');
  });

  it.each([
    undefined,
    null,
    {},
    { returnToSearch: 'https://example.com/search?query=outside' },
    { returnToSearch: '//example.com/search?query=outside' },
    { returnToSearch: '/about' },
    { returnToSearch: '/search#results' },
    { returnToSearch: '/search/../about' },
  ])('falls back to search for unsafe or absent state: %j', (state) => {
    expect(getAnimeSearchReturnTo(state)).toBe('/search');
  });
});

it('clears a stale return path when a detail link is opened outside search', () => {
  expect(getAnimeDetailLinkState({ returnToSearch: '/search?old=1', other: 'kept' })).toEqual({
    other: 'kept',
  });
});

it('builds a real search route location with JSON filters and all query criteria', () => {
  const rootRoute = createRootRoute();
  const searchRoute = createRoute({ getParentRoute: () => rootRoute, path: '/search' });
  const detailRoute = createRoute({ getParentRoute: () => rootRoute, path: '/anime/$malId' });
  const router = createRouter({
    routeTree: rootRoute.addChildren([searchRoute, detailRoute]),
    history: createMemoryHistory({ initialEntries: ['/anime/1'] }),
  });
  const filters = JSON.stringify({
    f: [
      { field: 'score', action: 'GREATER_THAN_OR_EQUALS', value: 8 },
      { field: 'type', action: 'EQUALS', value: 'TV' },
    ],
  });
  const query = new URLSearchParams({
    af: filters,
    airing: 'no',
    sort: 'score',
    wt: 'Done',
    page: '3',
  }).toString();
  const destination = getAnimeSearchReturnToLocation(`/search?${query}`);

  const location = router.buildLocation(destination);

  expect(location.pathname).toBe('/search');
  expect(location.search).toEqual({
    af: {
      f: [
        { field: 'score', action: 'GREATER_THAN_OR_EQUALS', value: 8 },
        { field: 'type', action: 'EQUALS', value: 'TV' },
      ],
    },
    airing: 'no',
    sort: 'score',
    wt: 'Done',
    page: 3,
  });
  expect(location.searchStr).toBe(`?${query}`);
});

it('uses the bare search route for a direct detail entry without saved search state', () => {
  expect(getAnimeSearchReturnToLocation(undefined)).toEqual({ to: '/search', search: {} });
});
