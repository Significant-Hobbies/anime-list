import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import surfaces from './data/public-surfaces.json';
import anime from './data/seo-anime.json';
import manga from './data/seo-manga.json';
import { renderPublicMarkdown } from './publicMarkdown';
import { rewriteStaticSeo } from './staticSeo';

describe('public agent surface coverage', () => {
  it('maps every canonical static HTML route to distinct Markdown', () => {
    const publicPages = surfaces.filter((surface) => surface.path !== '/discover');
    expect(publicPages).toHaveLength(12);
    expect(new Set(publicPages.map((surface) => surface.path)).size).toBe(12);
    expect(new Set(publicPages.map((surface) => surface.markdownPath)).size).toBe(12);
    expect(publicPages.every((surface) => surface.markdownPath.endsWith('.md'))).toBe(true);
  });

  it('keeps personal and machine resources out of the HTML registry', () => {
    const paths = surfaces
      .filter((surface) => surface.path !== '/discover')
      .map((surface) => surface.path);
    for (const excluded of [
      '/discover',
      '/quiz',
      '/schedule',
      '/watchlist',
      '/manga/watchlist',
      '/alerts',
      '/collections',
      '/llms.txt',
      '/index.md',
      '/api/ai',
    ]) {
      expect(paths).not.toContain(excluded);
    }
  });

  it('renders full public source Markdown for both detail collections', async () => {
    expect(anime).toHaveLength(5306);
    expect(manga).toHaveLength(2288);
    for (const [kind, entry] of [
      ['anime', anime[0]],
      ['manga', manga[0]],
    ] as const) {
      const upstream = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            [kind]: {
              mal_id: entry.id,
              title: entry.title,
              synopsis: 'Untruncated public synopsis',
              genres: entry.genres,
            },
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      );
      try {
        const markdown = await renderPublicMarkdown(`/${kind}/${entry.id}`);
        expect(markdown).toContain(`# ${entry.title}`);
        expect(markdown).toContain(`/${kind}/${entry.id}`);
        expect(markdown).toContain('Untruncated public synopsis');
      } finally {
        upstream.mockRestore();
      }
    }
  });

  it('rewrites the SPA canonical and social metadata for static routes', () => {
    const shell = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
    const search = surfaces.find((surface) => surface.path === '/search');
    expect(search).toBeDefined();
    const rewritten = rewriteStaticSeo(shell, search!, 'https://anime.significanthobbies.com');
    expect(rewritten).toContain(
      '<link rel="canonical" href="https://anime.significanthobbies.com/search" />'
    );
    expect(rewritten).toContain(`content="${search!.description}"`);
    expect(rewritten).not.toContain('content="/og.png"');
  });

  it('serves a route-specific primary heading and readable content before JavaScript', () => {
    const shell = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
    for (const surface of surfaces.filter((surface) => surface.path !== '/')) {
      const rewritten = rewriteStaticSeo(shell, surface, 'https://anime.significanthobbies.com');
      const body = rewritten.split('<body')[1];
      expect(body.match(/<h1\b/g)).toHaveLength(1);
      expect(body).toContain(`<h1>${surface.title}</h1>`);
      expect(body).toContain('<article data-ssr aria-label="Page summary">');
    }
    const search = surfaces.find((surface) => surface.path === '/search')!;
    const body = rewriteStaticSeo(shell, search, 'https://anime.significanthobbies.com').split(
      '<body'
    )[1];
    expect(body).toContain('The default popularity threshold is 100,000 MyAnimeList members');
  });

  it('preserves the persistent homepage hero and does not add a second primary heading', () => {
    const shell = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
    const home = surfaces.find((surface) => surface.path === '/')!;
    const rewritten = rewriteStaticSeo(shell, home, 'https://anime.significanthobbies.com');
    expect(rewritten.split('<body')[1]).toBe(shell.split('<body')[1]);
  });

  it('escapes route copy in the body and refuses a shell without summary markers', () => {
    const shell = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
    const surface = {
      path: '/search',
      title: '<img src=x onerror=alert(1)>',
      description: 'A & B',
      markdown: '<script>alert(1)</script>\n\nLiteral $& marker',
    };
    const body = rewriteStaticSeo(shell, surface, 'https://anime.significanthobbies.com').split(
      '<body'
    )[1];
    expect(body).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(body).not.toContain('<script>alert(1)</script>');
    expect(body).toContain('<p>Literal $&amp; marker</p>');
    expect(() =>
      rewriteStaticSeo(
        shell.replace('<!-- ssr:end -->', ''),
        surface,
        'https://anime.significanthobbies.com'
      )
    ).toThrow('ssr:start/end markers');
  });
});
