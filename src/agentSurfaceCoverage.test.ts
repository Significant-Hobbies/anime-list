import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import surfaces from './data/public-surfaces.json';
import anime from './data/seo-anime.json';
import manga from './data/seo-manga.json';
import { renderDetailMarkdown } from './agentMarkdown';
import { rewriteStaticSeo } from './staticSeo';

describe('public agent surface coverage', () => {
  it('maps every canonical static HTML route to distinct Markdown', () => {
    expect(surfaces).toHaveLength(13);
    expect(new Set(surfaces.map((surface) => surface.path)).size).toBe(13);
    expect(new Set(surfaces.map((surface) => surface.markdownPath)).size).toBe(13);
    expect(surfaces.every((surface) => surface.markdownPath.endsWith('.md'))).toBe(true);
  });

  it('keeps personal and machine resources out of the HTML registry', () => {
    const paths = surfaces.map((surface) => surface.path);
    for (const excluded of [
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

  it('renders source-derived Markdown for both detail collections', () => {
    expect(anime).toHaveLength(5306);
    expect(manga).toHaveLength(2288);
    const animeMarkdown = renderDetailMarkdown(anime[0], 'anime');
    const mangaMarkdown = renderDetailMarkdown(manga[0], 'manga');
    expect(animeMarkdown).toContain(`# ${anime[0].title}`);
    expect(animeMarkdown).toContain(`/anime/${anime[0].id}`);
    expect(mangaMarkdown).toContain(`# ${manga[0].title}`);
    expect(mangaMarkdown).toContain(`/manga/${manga[0].id}`);
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
