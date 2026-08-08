import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertCatalogRefreshComplete,
  assertCatalogRowsFetched,
  fetchFromApi,
  isRequiredSeasonPage,
} from './api';

vi.mock('./utils/file', () => ({
  delay: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('fetchFromApi', () => {
  it('retries a transient HTTP failure', async () => {
    const payload = { data: [{ mal_id: 1 }] };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 504 })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => payload });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(fetchFromApi('https://api.jikan.moe/example')).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null after the bounded retry count', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 504 });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(fetchFromApi('https://api.jikan.moe/example')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('assertCatalogRowsFetched', () => {
  it('rejects an empty anime refresh', () => {
    expect(() => assertCatalogRowsFetched('anime', 0)).toThrow(
      'Jikan returned no usable anime rows'
    );
  });

  it('rejects an empty manga refresh', () => {
    expect(() => assertCatalogRowsFetched('manga', 0)).toThrow(
      'Jikan returned no usable manga rows'
    );
  });

  it('accepts a non-empty refresh', () => {
    expect(() => assertCatalogRowsFetched('anime', 1)).not.toThrow();
  });
});

describe('assertCatalogRefreshComplete', () => {
  it('rejects a partial refresh after preserving fetched rows', () => {
    expect(() => assertCatalogRefreshComplete('anime', ['summer 2026 page 3'])).toThrow(
      'Catalog refresh incomplete: Jikan failed for anime summer 2026 page 3 after retries.'
    );
  });

  it('accepts a refresh with no failed pages', () => {
    expect(() => assertCatalogRefreshComplete('manga', [])).not.toThrow();
  });
});

describe('isRequiredSeasonPage', () => {
  it('fails closed when the first page for a season is unavailable', () => {
    expect(isRequiredSeasonPage(1)).toBe(true);
  });

  it('allows an incremental refresh to keep rows fetched before a tail-page timeout', () => {
    expect(isRequiredSeasonPage(2)).toBe(false);
    expect(isRequiredSeasonPage(3)).toBe(false);
  });
});
