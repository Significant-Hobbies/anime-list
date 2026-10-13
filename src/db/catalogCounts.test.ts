// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { getCatalogCounts } from './catalogCounts';
import { getDb } from './client';
vi.mock('./client', () => ({ getDb: vi.fn() }));
afterEach(() => vi.clearAllMocks());
it('counts both retained D1 catalogs without popularity or pagination constraints', async () => {
  const execute = vi.fn().mockResolvedValue({ rows: [{ anime: 3, manga: 2 }] });
  vi.mocked(getDb).mockReturnValue({ execute, batch: vi.fn() });
  expect(await getCatalogCounts()).toEqual({ anime: 3, manga: 2 });
  expect(execute).toHaveBeenCalledWith(
    'SELECT (SELECT COUNT(*) FROM anime_data) AS anime, (SELECT COUNT(*) FROM manga_data) AS manga'
  );
});
it('propagates database failure instead of inventing a total', async () => {
  vi.mocked(getDb).mockReturnValue({
    execute: vi.fn().mockRejectedValue(new Error('unavailable')),
    batch: vi.fn(),
  });
  await expect(getCatalogCounts()).rejects.toThrow('unavailable');
});
