import { afterEach, expect, it, vi } from 'vitest';
import { getAnimeDetail, searchAnime, searchManga } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

it.each([searchAnime, searchManga])(
  'normalizes a successful empty search response',
  async (search) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', { status: 200 })));
    expect(await search([])).toEqual({ filteredList: [], totalFiltered: 0 });
  }
);

it.each([401, 404, 503])(
  'preserves HTTP status %s for the resource retry policy',
  async (status) => {
    vi.stubGlobal('localStorage', { removeItem: vi.fn() });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status })));
    await expect(getAnimeDetail(1)).rejects.toMatchObject({ status });
  }
);

it('forwards a resource cancellation signal to detail reads', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetcher);
  const controller = new AbortController();
  await getAnimeDetail(1, controller.signal);
  expect(fetcher).toHaveBeenCalledWith(
    expect.stringContaining('/api/anime/1'),
    expect.objectContaining({ signal: controller.signal, credentials: 'include' })
  );
});
