import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleReadability, publicRoutes } from '../functions/_readability';
import { renderPublicMarkdown } from './publicMarkdown';
import copy from './data/public-markdown.json';

const origin = 'https://anime.significanthobbies.com';
const assets = {
  fetch: vi.fn(
    async () =>
      new Response(readFileSync('public/llms-full.txt', 'utf8'), {
        headers: { 'Content-Type': 'text/plain' },
      })
  ),
};
const request = (path: string, accept = 'text/markdown', method = 'GET') =>
  new Request(origin + path, {
    method,
    headers: { Accept: accept, Cookie: 'session=private', Authorization: 'Bearer private' },
  });
const reply = (value: object) =>
  new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
afterEach(() => vi.restoreAllMocks());

describe('public source readability', () => {
  it('exports complete authored legal, product, release and MCP source', () => {
    expect(copy['/about']).toContain('A log-scale popularity formula');
    expect(copy['/privacy']).toContain('Revoke the Google OAuth grant');
    expect(copy['/privacy']).toContain('up to 90 days');
    expect(copy['/terms']).toContain('Cross-check before marathon-watching.');
    expect(copy['/changelog']).toContain('2026-07-25');
    expect(copy['/changelog']).toContain('2026-06-20');
    expect(copy['/mcp']).toContain('```\n{');
    expect(copy['/mcp']).toContain('search_manga');
    expect(copy['/']).toContain('How often is it updated?');
    expect(copy['/']).toContain('Hajime no Ippo');
    for (const body of Object.values(copy)) expect(body).toContain('Canonical: ' + origin);
  });

  it('covers every public router path and excludes personal state and random redirect families', () => {
    const router = readFileSync('src/router.tsx', 'utf8');
    const exclusions = [
      '/discover',
      '/quiz',
      '/schedule',
      '/watchlist',
      '/manga/watchlist',
      '/genre/$genre',
    ];
    for (const [, path] of router.matchAll(/path: '([^']+)'/g)) {
      if (exclusions.includes(path))
        expect(publicRoutes.some((route) => route.path === path)).toBe(false);
      else if (path.includes('$malId'))
        expect(publicRoutes.some((route) => route.path.startsWith(path.split('$')[0]))).toBe(true);
      else expect(publicRoutes.some((route) => route.path === path)).toBe(true);
    }
    expect(publicRoutes).toHaveLength(7606);
    expect(new Set(publicRoutes.map((route) => route.path)).size).toBe(7606);
  });

  it('returns the same canonical body and contract across suffix, API and negotiation', async () => {
    const bodies = [];
    for (const path of ['/about.md', '/api/md/about', '/about']) {
      const response = await handleReadability(request(path), assets);
      expect(response?.status).toBe(200);
      expect(response?.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
      expect(response?.headers.get('Content-Location')).toBe(origin + '/about');
      expect(response?.headers.get('Link')).toContain('rel="canonical"');
      expect(response?.headers.get('Link')).toContain('rel="describedby"');
      expect(response?.headers.get('X-Robots-Tag')).toBe('noindex, follow');
      expect(response?.headers.get('Access-Control-Allow-Origin')).toBe('*');
      const body = await response!.text();
      expect(Number(response?.headers.get('X-Markdown-Tokens'))).toBe(Math.ceil(body.length / 4));
      bodies.push(body);
    }
    expect(new Set(bodies).size).toBe(1);
    const head = await handleReadability(request('/about.md', 'text/markdown', 'HEAD'), assets);
    expect(await head?.text()).toBe('');
    const options = await handleReadability(request('/about.md', '*/*', 'OPTIONS'), assets);
    expect(options?.status).toBe(204);
  });

  it('honors q values and leaves HTML, wildcard and native assets alone', async () => {
    for (const accept of [
      '',
      '*/*',
      'text/markdown;q=0',
      'text/markdown;q=0.5,text/html;q=0.9',
      'text/markdown;q=1,text/html;q=1',
    ]) {
      expect(await handleReadability(request('/about', accept), assets)).toBeNull();
    }
    expect(
      (await handleReadability(request('/about', 'text/html;q=0.4,text/markdown;q=0.9'), assets))
        ?.status
    ).toBe(200);
    expect(await handleReadability(request('/fonts/LICENSE.md'), assets)).toBeNull();
    expect(await handleReadability(request('/api/watchlist'), assets)).toBeNull();
    expect((await handleReadability(request('/api/md/watchlist'), assets))?.status).toBe(404);
  });

  it('uses full public enrichment without any auth, query or private response fields', async () => {
    const synopsis = 'Complete synopsis. '.repeat(100);
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      reply({
        anime: { mal_id: 1, title: 'Cowboy Bebop', synopsis, genres: ['Action'], members: 100 },
        relations: [{ mal_id: 5, title: 'Related', relation: 'Sequel' }],
        recommendations: [{ mal_id: 7, title: 'Recommended', votes: 8 }],
        watchlistEntry: { note: 'SECRET NOTE', status: 'PRIVATE STATUS' },
        user: { email: 'private@example.com' },
      })
    );
    const response = await handleReadability(request('/anime/1.md?wt=private'), assets);
    const body = await response!.text();
    expect(body).toContain(synopsis.trim());
    expect(body).toContain('[Related]');
    expect(body).toContain('[Recommended]');
    expect(body).not.toMatch(/SECRET|PRIVATE|private@example/);
    expect(fetcher.mock.calls[0][0]).toBe(
      'https://mal-api.sarthakagrawal927.workers.dev/api/anime/1'
    );
    const headers = new Headers(fetcher.mock.calls[0][1]?.headers);
    expect(fetcher.mock.calls[0][1]?.redirect).toBe('manual');
    expect(headers.has('Cookie')).toBe(false);
    expect(headers.has('Authorization')).toBe(false);
  });

  it('fails closed for upstream errors, invalid IDs and HTML fallback', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>fallback</html>', { headers: { 'Content-Type': 'text/html' } })
    );
    const response = await handleReadability(request('/anime/1.md'), assets);
    expect(response?.status).toBe(503);
    expect(response?.headers.get('Cache-Control')).toBe('no-store');
    expect(response?.headers.get('X-Robots-Tag')).toBe('noindex, follow');
    expect((await handleReadability(request('/anime/999999999.md'), assets))?.status).toBe(404);
  });

  it('renders default public search IDs and synopsis without forwarding personalized filters', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      reply({
        totalFiltered: 1,
        filteredList: [{ id: 1, name: 'Cowboy Bebop', synopsis: 'Search synopsis', score: 8.7 }],
      })
    );
    const body = await renderPublicMarkdown('/search');
    expect(body).toContain('[Cowboy Bebop](' + origin + '/anime/1)');
    expect(body).toContain('Search synopsis');
    const payload = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(payload.hideWatched).toEqual([]);
    expect(payload.filters).toEqual([
      { field: 'members', action: 'GREATER_THAN_OR_EQUALS', value: 100000 },
    ]);
  });

  it('bounds the static-only export and advertises the real public MCP endpoint', async () => {
    const response = await handleReadability(request('/llms-full.txt'), assets);
    const body = await response!.text();
    expect(body).toContain('Included 12 of 7606');
    expect(body).toContain('authored static page content only');
    expect(body).toContain('/api/md/_catalog');
    expect(body.length).toBeLessThan(500000);
    const catalog = await (await handleReadability(request('/api/ai'), assets))!.json();
    expect(catalog.mcp.url).toBe(origin + '/api/mcp');
  });
});

it('unknown Markdown paths cannot advertise off-origin canonicals', async () => {
  for (const path of ['/api/md//evil.example/x', '//evil.example/x.md']) {
    const response = await handleReadability(new Request(origin + path), assets);
    expect(response?.status).toBe(404);
    expect(response?.headers.get('content-location')).toBe(origin + '//evil.example/x');
    expect(response?.headers.get('cache-control')).toBe('no-store');
    expect(response?.headers.get('x-robots-tag')).toBe('noindex, follow');
    expect(response?.headers.get('link')).toContain(origin + '/llms.txt');
  }
});
