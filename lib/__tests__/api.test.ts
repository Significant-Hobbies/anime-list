import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchAnime } from '../api';
import { CATALOG_UNAVAILABLE_CODE, CATALOG_UNAVAILABLE_MESSAGE } from '../apiErrors';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
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

describe('search API timeout', () => {
  it('keeps the timeout armed while the response body downloads', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) =>
        Promise.resolve({
          ok: true,
          status: 200,
          // Headers arrived; the body stalls until the request is aborted.
          json: () =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener('abort', () =>
                reject(new DOMException('Aborted', 'AbortError'))
              );
            }),
        })
      )
    );

    const pending = searchAnime([]);
    const assertion = expect(pending).rejects.toThrow('Search service timed out');
    await vi.advanceTimersByTimeAsync(12_000);
    await assertion;
  });
});
