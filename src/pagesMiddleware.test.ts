import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { onRequest } from '../functions/_middleware';
import { onRequestGet as mangaDetail } from '../functions/manga/[malId]';

vi.mock('../functions/_seo-dataset', () => ({ getMangaEntry: vi.fn(() => undefined) }));

const shell = readFileSync(resolve(__dirname, '../index.html'), 'utf8');

function context(path: string, method = 'GET', accept = 'text/html') {
  const next = vi.fn(
    async () =>
      new Response(method === 'HEAD' ? null : shell, {
        headers: { 'content-type': 'text/html', 'cache-control': 'public, max-age=3600' },
      })
  );
  return {
    request: new Request(`https://anime.significanthobbies.com${path}`, {
      method,
      headers: { accept },
    }),
    env: { ASSETS: { fetch: vi.fn(async () => new Response('markdown')) } },
    next,
    params: {},
    data: {},
    functionPath: '',
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  };
}

describe('Pages SPA routing status', () => {
  for (const path of ['/%60', '/not-a-real-page', '/missing.html']) {
    it(`does not index the SPA fallback for ${path}`, async () => {
      const response = await onRequest(context(path));
      expect(response.status).toBe(404);
      expect(response.headers.get('x-robots-tag')).toBe('noindex');
      expect(response.headers.get('cache-control')).toBe('no-store');
      const html = await response.text();
      expect(html).toContain('content="noindex"');
      expect(html).not.toContain('rel="canonical"');
    });
  }

  it('returns the same not-found status for HEAD without a body', async () => {
    const response = await onRequest(context('/%60', 'HEAD'));
    expect(response.status).toBe(404);
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
    expect(await response.text()).toBe('');
  });

  for (const path of [
    '/search',
    '/watchlist',
    '/manga/watchlist',
    '/schedule',
    '/quiz',
    '/genre/action',
    '/anime/5114',
    '/manga/2',
    '/api/search',
  ]) {
    it(`preserves the existing route handler for ${path}`, async () => {
      const ctx = context(path);
      const response = await onRequest(ctx);
      expect(response.status).toBe(200);
      expect(ctx.next).toHaveBeenCalledOnce();
    });
  }

  for (const route of ['stats', 'watchlist']) {
    it(`preserves /manga/${route} through the actual detail wildcard`, async () => {
      const ctx = context(`/manga/${route}`);
      const assets = vi.fn(
        async () => new Response(shell, { headers: { 'content-type': 'text/html' } })
      );
      ctx.next.mockImplementation(() =>
        mangaDetail({ ...ctx, params: { malId: route }, next: assets })
      );
      const response = await onRequest(ctx);
      expect(response.status).toBe(200);
      expect(assets).toHaveBeenCalledOnce();
      const html = await response.text();
      if (route === 'stats') {
        expect(html).toContain('<h1>Manga catalog statistics — Anime List</h1>');
        expect(html).toContain('href="https://anime.significanthobbies.com/manga/stats"');
      }
    });
  }

  it('keeps genuine invalid manga IDs at 404 through the same wildcard', async () => {
    const ctx = context('/manga/invalid-id');
    ctx.env.ASSETS.fetch.mockImplementation(async () => new Response(shell));
    ctx.next.mockImplementation(() => mangaDetail({ ...ctx, params: { malId: 'invalid-id' } }));
    const response = await onRequest(ctx);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('content="noindex"');
  });

  it('does not intercept detail Markdown before the detail function', async () => {
    const ctx = context('/anime/5114', 'GET', 'text/markdown');
    const response = await onRequest(ctx);
    expect(response.status).toBe(200);
    expect(ctx.next).toHaveBeenCalledOnce();
  });

  it('does not convert genuine static assets to not-found', async () => {
    const ctx = context('/assets/index.js');
    ctx.next.mockImplementation(
      async () => new Response('script', { headers: { 'content-type': 'application/javascript' } })
    );
    const response = await onRequest(ctx);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('script');
  });

  it('drops stale entity headers when rewriting a fallback', async () => {
    const ctx = context('/missing');
    ctx.next.mockImplementation(
      async () =>
        new Response(shell, {
          headers: {
            'content-type': 'text/html',
            'content-length': String(shell.length),
            etag: 'homepage',
          },
        })
    );
    const response = await onRequest(ctx);
    expect(response.status).toBe(404);
    expect(response.headers.has('content-length')).toBe(false);
    expect(response.headers.has('etag')).toBe(false);
  });

  it('marks an unrecognized HTML fallback without SEO markers instead of throwing', async () => {
    const ctx = context('/missing');
    ctx.next.mockImplementation(
      async () =>
        new Response('<h1>Not found</h1>', {
          headers: { 'content-type': 'text/html' },
        })
    );
    const response = await onRequest(ctx);
    expect(response.status).toBe(404);
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
    expect(await response.text()).toBe('<h1>Not found</h1>');
  });
});
