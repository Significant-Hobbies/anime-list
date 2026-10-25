import { describe, expect, it } from 'vitest';
import { getAnimeDetailLinkState, getAnimeSearchReturnTo } from '@/lib/searchReturnTo';

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
