// @vitest-environment node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createSeoCatalog } from './seoCatalog';
import index from './data/seo-index.json';
import { detailPage } from '../functions/_detail-page';
import { onRequest } from '../functions/_middleware';

beforeAll(() => execFileSync(process.execPath, ['scripts/build-seo-assets.mjs', '--assets']));
const origin = 'https://anime.significanthobbies.com';
const first = index.collections.anime.titles[0];
const shell = readFileSync('index.html', 'utf8');
const asset = (input: Request) =>
  new Response(readFileSync('dist' + new URL(input.url).pathname), {
    headers: { 'content-type': 'application/json' },
  });
const requestContext = (
  path: string,
  method: string,
  fetcher: (input: Request) => Promise<Response> | Response
) => ({
  request: new Request(origin + path, { method }),
  params: { malId: path.split('/').at(-1) },
  env: { ASSETS: { fetch: fetcher } },
  next: () => new Response(shell, { headers: { 'content-type': 'text/html' } }),
});

describe('immutable public catalog asset loading', () => {
  it('keeps every admitted field and identity in all 138 content-hashed shards', () => {
    execFileSync(process.execPath, ['scripts/build-seo-assets.mjs', '--check']);
    for (const kind of ['anime', 'manga'] as const) {
      const rows = index.collections[kind].shards.flatMap((shard) => {
        const bytes = readFileSync('dist' + shard.path);
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(shard.sha256);
        expect(bytes.length).toBe(shard.bytes);
        expect(bytes.length).toBeLessThanOrEqual(512 * 1024);
        return JSON.parse(bytes.toString()).entries;
      });
      expect(rows).toEqual(JSON.parse(readFileSync(`src/data/seo-${kind}.json`, 'utf8')));
    }
    expect(index.collections.anime.shards.length + index.collections.manga.shards.length).toBe(138);
    expect(index.collections.anime.titles.length + index.collections.manga.titles.length).toBe(
      27436
    );
  });

  it('returns unknown identities without an asset or network request', async () => {
    const fetcher = vi.fn(asset);
    expect(await createSeoCatalog()('anime', 999999999, { fetch: fetcher } as never)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('reads one direct immutable shard and coalesces concurrent lookups', async () => {
    const get = createSeoCatalog();
    const fetcher = vi.fn(asset);
    const ids = index.collections.anime.titles.slice(0, 2).map((title) => title.id);
    const rows = await Promise.all(ids.map((id) => get('anime', id, { fetch: fetcher } as never)));
    expect(rows.map((row) => row!.id)).toEqual(ids);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const input = fetcher.mock.calls[0][0];
    expect(input.url).toBe(origin + index.collections.anime.shards[0].path);
    expect(input.redirect).toBe('manual');
    expect(input.headers.has('cookie')).toBe(false);
    expect(input.headers.has('authorization')).toBe(false);
  });

  it('accepts a valid decoded body even when encoded transport length differs', async () => {
    const body = readFileSync('dist' + index.collections.anime.shards[0].path);
    const get = createSeoCatalog();
    const row = await get('anime', first.id, {
      fetch: () =>
        new Response(body, {
          headers: {
            'content-type': 'application/json',
            'content-encoding': 'gzip',
            'content-length': '20',
          },
        }),
    } as never);
    expect(row!.id).toBe(first.id);
  });

  it('evicts old shard promises after eight cached shards', async () => {
    const get = createSeoCatalog();
    const fetcher = vi.fn(asset);
    const ids = Array.from(
      { length: 9 },
      (_, i) => index.collections.anime.titles[i * index.shardSize].id
    );
    for (const id of ids) await get('anime', id, { fetch: fetcher } as never);
    await get('anime', ids[8], { fetch: fetcher } as never);
    expect(fetcher).toHaveBeenCalledTimes(9);
    await get('anime', ids[0], { fetch: fetcher } as never);
    expect(fetcher).toHaveBeenCalledTimes(10);
  });

  it('drops failed cache entries so a later valid asset can recover', async () => {
    const get = createSeoCatalog();
    const fetcher = vi.fn(asset).mockImplementationOnce(() => new Response(null, { status: 404 }));
    await expect(get('anime', first.id, { fetch: fetcher } as never)).rejects.toThrow();
    expect((await get('anime', first.id, { fetch: fetcher } as never))!.id).toBe(first.id);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  for (const failure of [
    () => new Response(null, { status: 404 }),
    () => new Response(null, { status: 308, headers: { location: '/' } }),
    () => new Response('<html>fallback</html>', { headers: { 'content-type': 'text/html' } }),
    () =>
      new Response('x'.repeat(512 * 1024 + 1), { headers: { 'content-type': 'application/json' } }),
    () => {
      const text = readFileSync('dist' + index.collections.anime.shards[0].path, 'utf8');
      return new Response('[' + text.slice(1), { headers: { 'content-type': 'application/json' } });
    },
  ]) {
    it('rejects missing, redirected, HTML, oversized or corrupt content', async () => {
      await expect(
        createSeoCatalog()('anime', first.id, { fetch: failure } as never)
      ).rejects.toThrow();
    });
  }

  it('validates row identity even when bytes match their declared content hash', async () => {
    const body = JSON.stringify({
      version: 1,
      kind: 'anime',
      entries: [
        {
          id: first.id + 1,
          title: first.title,
          synopsis: 'text '.repeat(40),
          genres: ['Action'],
          type: 'TV',
          year: 1998,
        },
      ],
    });
    const sha256 = createHash('sha256').update(body).digest('hex');
    const custom = {
      version: 1,
      shardSize: 200,
      collections: {
        anime: {
          titles: [first],
          shards: [
            {
              path: `/catalog-data/anime/${sha256}.json`,
              sha256,
              count: 1,
              bytes: Buffer.byteLength(body),
            },
          ],
        },
        manga: { titles: [], shards: [] },
      },
    };
    await expect(
      createSeoCatalog(custom)('anime', first.id, {
        fetch: () => new Response(body, { headers: { 'content-type': 'application/json' } }),
      } as never)
    ).rejects.toThrow('identity');
  });

  for (const method of ['GET', 'HEAD']) {
    it(`returns known missing-asset HTML as 503/noindex for ${method}, not 404`, async () => {
      const fetcher = vi.fn(() => new Response(null, { status: 404 }));
      const get = createSeoCatalog();
      const response = await detailPage(
        requestContext('/anime/' + first.id, method, fetcher) as never,
        'anime',
        (id, assets) => get('anime', id, assets)
      );
      expect(response.status).toBe(503);
      expect(response.headers.get('x-robots-tag')).toBe('noindex');
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('retry-after')).toBe('60');
      if (method === 'HEAD') expect(await response.text()).toBe('');
      else expect(await response.text()).toContain('Catalog temporarily unavailable');
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it(`returns known missing-asset Markdown as 503/noindex for ${method}`, async () => {
      const response = await onRequest(
        requestContext(
          '/anime/' + first.id + '.md',
          method,
          () => new Response(null, { status: 404 })
        ) as never
      );
      expect(response.status).toBe(503);
      expect(response.headers.get('x-robots-tag')).toContain('noindex');
      expect(response.headers.get('content-type')).toContain('text/markdown');
      if (method === 'HEAD') expect(await response.text()).toBe('');
    });
  }
});
