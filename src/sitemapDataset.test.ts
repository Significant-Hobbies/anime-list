/**
 * Guard: the sitemap must never advertise a detail URL that the Pages Function
 * will serve `noindex` for.
 *
 * functions/{anime,manga}/[malId].ts calls rewriteShellNoindex() whenever the
 * requested id is absent from the SEO dataset. A checked-in public/sitemap.xml
 * once advertised ~25k ids from an older catalog while the dataset held ~7.6k,
 * so ~17k advertised URLs actively told crawlers not to index them. The
 * sitemap is now generated from the same datasets the Function reads
 * (scripts/build-sitemaps.mjs); these tests pin that single source of truth.
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist');

function idsFrom(file: string): { kind: string; id: number }[] {
  const xml = readFileSync(resolve(DIST, file), 'utf8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].match(/\/(anime|manga)\/(\d+)$/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => ({ kind: m[1], id: Number(m[2]) }));
}

describe('sitemap / SEO dataset consistency', () => {
  mkdirSync(DIST, { recursive: true });
  execFileSync('node', [resolve(ROOT, 'scripts/build-sitemaps.mjs')], { cwd: ROOT });

  const animeIds = new Set<number>(
    JSON.parse(readFileSync(resolve(ROOT, 'src/data/seo-anime.json'), 'utf8')).map(
      (e: { id: number }) => e.id
    )
  );
  const mangaIds = new Set<number>(
    JSON.parse(readFileSync(resolve(ROOT, 'src/data/seo-manga.json'), 'utf8')).map(
      (e: { id: number }) => e.id
    )
  );

  // Derived from the index, never hardcoded: a hardcoded chunk list silently
  // stops covering chunk N+1 the moment the catalog grows past a chunk boundary.
  const indexXml = readFileSync(resolve(DIST, 'sitemap.xml'), 'utf8');
  const chunks = [...indexXml.matchAll(/<loc>[^<]*\/([^/<]+\.xml)<\/loc>/g)].map((m) => m[1]);

  it('emits sitemap.xml as an index, not a URL list', () => {
    expect(indexXml).toContain('<sitemapindex');
    // Must not point at itself — that is what the stale public/ asset did.
    expect(indexXml).not.toContain('/sitemap.xml<');
  });

  it('indexes every generated chunk', () => {
    // Guards the coverage of the test below: if the index omits a chunk, the
    // missing-id assertion would silently stop inspecting those URLs.
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks).toContain('sitemap-static.xml');
    expect(chunks.some((c) => c.startsWith('sitemap-anime-'))).toBe(true);
    expect(chunks.some((c) => c.startsWith('sitemap-manga-'))).toBe(true);
    for (const c of chunks) expect(existsSync(resolve(DIST, c))).toBe(true);
  });

  it('advertises no id that is missing from the SEO dataset', () => {
    const missing = chunks
      .flatMap((f) => idsFrom(f))
      .filter(({ kind, id }) => !(kind === 'anime' ? animeIds : mangaIds).has(id));

    expect(missing).toEqual([]);
  });

  it('advertises the static routes', () => {
    const xml = readFileSync(resolve(DIST, 'sitemap-static.xml'), 'utf8');
    for (const path of [
      '/search',
      '/discover',
      '/manga',
      '/manga/stats',
      '/catalog-updates',
      '/mcp',
    ]) {
      expect(xml).toContain(`<loc>https://anime.significanthobbies.com${path}</loc>`);
    }
    expect(xml).not.toContain('/manga-search');
    expect(xml).not.toContain('/manga-stats');
    expect(xml).not.toContain('/schedule');
    expect(xml).not.toContain('/collections');
    expect(xml).not.toContain('/llms.txt');
    expect(xml).not.toContain('/index.md');
    expect(xml).not.toContain('/api/ai');
    expect([...xml.matchAll(/<url>/g)]).toHaveLength(13);
  });
});
