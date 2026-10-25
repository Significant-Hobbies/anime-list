import { describe, expect, it } from 'vitest';
import { getAnimeSearchReturnTo } from '@/lib/searchReturnTo';

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
