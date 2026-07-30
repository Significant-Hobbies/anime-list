import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchAnime } from '../api';
import { CATALOG_UNAVAILABLE_CODE, CATALOG_UNAVAILABLE_MESSAGE } from '../apiErrors';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('search API errors', () => {
  it('preserves the catalog-unavailable code as a safe user-facing error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: 'untrusted upstream detail',
            code: CATALOG_UNAVAILABLE_CODE,
          },
          { status: 503 }
        )
      )
    );

    await expect(searchAnime([])).rejects.toMatchObject({
      name: 'ApiError',
      status: 503,
      code: CATALOG_UNAVAILABLE_CODE,
      message: CATALOG_UNAVAILABLE_MESSAGE,
    });
  });
});
