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
});
