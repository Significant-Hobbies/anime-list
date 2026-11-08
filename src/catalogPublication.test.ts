import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { qualifies } from '../scripts/lib/seo-admission.mjs';
import anime from './data/seo-anime.json';
import manga from './data/seo-manga.json';
import catalog from './data/catalog-pages.json';
import { rewriteShell, escapeHtml } from './seoRewrite';
import { detailPage } from '../functions/_detail-page';
import { getAnimeEntry } from './seoCatalog';

const source = JSON.parse(readFileSync('cleaned_anime_data.json', 'utf8'))[0];
const shell = readFileSync('index.html', 'utf8');
const origin = 'https://anime.significanthobbies.com';

describe('source-backed catalog admission and publication', () => {
  it('requires meaningful text and verifiable identity, not popularity', () => {
    expect(qualifies({ ...source, members: 0, title: 'X' }, 'anime')).toBe(true);
    for (const patch of [
      { synopsis: '' },
      { synopsis: 'x'.repeat(200) },
      { synopsis: 'No synopsis ' + source.synopsis },
      { url: 'https://myanimelist.net.evil.example/anime/' + source.mal_id },
      { url: 'https://myanimelist.net/manga/' + source.mal_id },
      { mal_id: -1 },
      { title: '' },
      { genres: {} },
      { type: null },
      { year: null },
    ])
      expect(qualifies({ ...source, ...patch }, 'anime')).toBe(false);
  });

  it('has no generation drift and exposes facts and provenance for every admitted detail', () => {
    execFileSync(process.execPath, ['scripts/build-seo-dataset.mjs', '--check']);
    for (const [kind, entries] of [
      ['anime', anime],
      ['manga', manga],
    ] as const) {
      for (const entry of entries) {
        const html = rewriteShell(shell, { origin, kind, entry });
        expect(html).toContain(`<link rel="canonical" href="${origin}/${kind}/${entry.id}"`);
        expect(html).toContain(`<h1>${escapeHtml(entry.title)}</h1>`);
        expect(html).toContain(escapeHtml(entry.synopsis));
        expect(html).toContain(`https://myanimelist.net/${kind}/${entry.id}`);
        expect(html).not.toContain('name="robots" content="noindex"');
      }
    }
  }, 30000);

  it('links every admitted title once from real HTML pages reachable from the catalog hub', () => {
    execFileSync(process.execPath, ['scripts/build-catalog.mjs']);
    const expected = [
      ...anime.map((entry) => `/anime/${entry.id}`),
      ...manga.map((entry) => `/manga/${entry.id}`),
    ].sort();
    const linked = [];
    const hub = readFileSync('dist/catalog.html', 'utf8');
    for (const page of catalog.filter((page) => page.kind)) {
      expect(hub).toContain(`href="${page.path}"`);
      const html = readFileSync(`dist${page.path}.html`, 'utf8');
      expect(html).toContain(`rel="canonical" href="${origin}${page.path}"`);
      linked.push(
        ...[...html.matchAll(/href="(\/(?:anime|manga)\/\d+)"/g)].map((match) => match[1])
      );
    }
    expect(linked.sort()).toEqual(expected);
    expect(new Set(linked).size).toBe(expected.length);
  });

  it('returns factual HTML for supported IDs and 404/noindex for unknown IDs', async () => {
    const context = (id: string) => ({
      request: new Request(origin + '/anime/' + id),
      params: { malId: id },
      env: { ASSETS: { fetch: async () => new Response(shell) } },
    });
    const known = await detailPage(context('1') as never, 'anime', getAnimeEntry);
    expect(known.status).toBe(200);
    expect(await known.text()).toContain('<h1>Cowboy Bebop</h1>');
    const unknown = await detailPage(context('999999999') as never, 'anime', getAnimeEntry);
    expect(unknown.status).toBe(404);
    expect(unknown.headers.get('x-robots-tag')).toBe('noindex');
    const body = await unknown.text();
    expect(body).toContain('name="robots" content="noindex"');
    expect(body).not.toContain('rel="canonical"');
  });
});
