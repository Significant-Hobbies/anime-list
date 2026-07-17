#!/usr/bin/env node
/**
 * Build chunked XML sitemaps from the SEO datasets.
 *
 * Emits:
 *   dist/sitemap-index.xml        — index pointing to all chunks
 *   dist/sitemap-anime-<n>.xml    — chunked anime detail URLs (≤5000 per file)
 *   dist/sitemap-manga-<n>.xml    — chunked manga detail URLs (≤5000 per file)
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

// Add the homepage + static pages first
indexEntries.push(`${ORIGIN}/sitemap.xml`);

// Build anime + manga chunks
buildSitemapsForKind('anime', animeIds, indexEntries);
buildSitemapsForKind('manga', mangaIds, indexEntries);

// Write the index
const indexXml = buildIndexXml(indexEntries);
writeFileSync(resolve(DIST, 'sitemap-index.xml'), indexXml, 'utf8');
console.log(`  sitemap-index.xml: ${indexEntries.length} entries`);
