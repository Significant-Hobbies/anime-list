#!/usr/bin/env node
/**
 * Build chunked XML sitemaps from the SEO datasets.
 *
 * Emits:
 *   dist/sitemap-index.xml        — index pointing to all chunks
 *   dist/sitemap-static.xml       — static routes (homepage, tools, legal, agent surfaces)
 *   dist/sitemap-anime-<n>.xml    — chunked anime detail URLs (≤5000 per file)
 *   dist/sitemap-manga-<n>.xml    — chunked manga detail URLs (≤5000 per file)
 *
 * Every detail URL emitted here MUST exist in the SEO dataset, because
 * functions/{anime,manga}/[malId].ts serves `noindex` for any id the dataset
 * does not contain. Advertising ids the dataset lacks makes the sitemap
 * contradict the pages it points at.
 *
 * Runs as a postbuild step (after Vite emits dist/).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist');
const ORIGIN = 'https://anime.significanthobbies.com';
const CHUNK_SIZE = 5000;

// Static routes worth advertising. Kept explicit rather than crawled off the
// router so a new internal-only route is not published by accident.
const STATIC_PATHS = [
  '/',
  '/search',
  '/discover',
  '/random',
  '/schedule',
  '/stats',
  '/manga-search',
  '/manga-stats',
  '/collections',
  '/quiz',
  '/changelog',
  '/about',
  '/privacy',
  '/terms',
  // Agent-indexing surfaces (foundry/ops/docs/agent-indexing-standard.md)
  '/llms.txt',
  '/index.md',
  '/api/ai',
];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function sitemapUrl(loc, lastmod) {
  const parts = [`  <url>`, `    <loc>${loc}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
  parts.push(`  </url>`);
  return parts.join('\n');
}

function buildChunkXml(urls) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

function buildIndexXml(sitemaps) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemaps.map((s) => `  <sitemap>\n    <loc>${s}</loc>\n  </sitemap>`),
    '</sitemapindex>',
    '',
  ].join('\n');
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function buildSitemapsForKind(kind, ids, indexEntries) {
  const chunks = chunkArray(ids, CHUNK_SIZE);
  const files = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkNum = i + 1;
    const fileName = `sitemap-${kind}-${chunkNum}.xml`;
    const urls = chunks[i].map((id) => sitemapUrl(`${ORIGIN}/${kind}/${id}`));
    const xml = buildChunkXml(urls);
    writeFileSync(resolve(DIST, fileName), xml, 'utf8');
    files.push(fileName);
    indexEntries.push(`${ORIGIN}/${fileName}`);
    console.log(`  ${fileName}: ${chunks[i].length} urls`);
  }
  return files;
}

// Ensure dist exists
mkdirSync(DIST, { recursive: true });

const animeData = readJson(resolve(ROOT, 'src/data/seo-anime.json'));
const mangaData = readJson(resolve(ROOT, 'src/data/seo-manga.json'));

const animeIds = animeData.map((e) => e.id).sort((a, b) => a - b);
const mangaIds = mangaData.map((e) => e.id).sort((a, b) => a - b);

console.log(`Anime: ${animeIds.length} ids → ${Math.ceil(animeIds.length / CHUNK_SIZE)} chunks`);
console.log(`Manga: ${mangaIds.length} ids → ${Math.ceil(mangaIds.length / CHUNK_SIZE)} chunks`);

const indexEntries = [];

// Static pages first, generated here. This used to point at a checked-in
// public/sitemap.xml holding ~25k ids from an older catalog; ~17k of those
// were absent from the SEO dataset and therefore served `noindex`, so the
// sitemap told crawlers to index pages that refused indexing.
const staticXml = buildChunkXml(
  STATIC_PATHS.map((p) => sitemapUrl(`${ORIGIN}${p === '/' ? '' : p}`))
);
writeFileSync(resolve(DIST, 'sitemap-static.xml'), staticXml, 'utf8');
console.log(`  sitemap-static.xml: ${STATIC_PATHS.length} urls`);
indexEntries.push(`${ORIGIN}/sitemap-static.xml`);

// Build anime + manga chunks
buildSitemapsForKind('anime', animeIds, indexEntries);
buildSitemapsForKind('manga', mangaIds, indexEntries);

// Write the index. `/sitemap.xml` is the primary entry point because
// robots.txt, public/api-ai.json, llms.txt, llms-full.txt, _redirects,
// _headers and src/agent-edge.mjs all advertise that path; it is written here
// instead of being a checked-in public/ asset so it can never drift from the
// SEO dataset again. `sitemap-index.xml` stays as an already-advertised alias.
const indexXml = buildIndexXml(indexEntries);
for (const name of ['sitemap.xml', 'sitemap-index.xml']) {
  writeFileSync(resolve(DIST, name), indexXml, 'utf8');
  console.log(`  ${name}: ${indexEntries.length} entries`);
}
