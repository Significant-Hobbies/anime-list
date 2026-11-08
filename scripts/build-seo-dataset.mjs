#!/usr/bin/env node
/**
 * Build compact SEO datasets from the cleaned anime/manga JSON.
 *
 * Admits source-backed titles with substantive synopses and factual metadata for
 * server-side HTML rewriting on detail pages. Output is committed so
 * `wrangler pages deploy dist` needs no extra step.
 *
 * Usage:
 *   node scripts/build-seo-dataset.mjs          # write src/data/seo-*.json
 *   node scripts/build-seo-dataset.mjs --check   # exit 1 if drift detected
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { qualifies } from './lib/seo-admission.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const ANIME_IN = resolve(ROOT, 'cleaned_anime_data.json');
const MANGA_IN = resolve(ROOT, 'cleaned_manga_data.json');
const ANIME_OUT = resolve(ROOT, 'src/data/seo-anime.json');
const MANGA_OUT = resolve(ROOT, 'src/data/seo-manga.json');

const MAX_SYNOPSIS_LEN = 1200;

const checkMode = process.argv.includes('--check');

function truncate(text, max) {
  if (!text) return '';
  const t = text.replace(/\\r\\n|\\n/g, '\n').trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + '…';
}

function compactAnime(entry) {
  return {
    id: entry.mal_id,
    title: entry.title,
    titleEnglish: entry.title_english || null,
    type: entry.type || null,
    synopsis: truncate(entry.synopsis, MAX_SYNOPSIS_LEN),
    score: entry.score ?? null,
    scoredBy: entry.scored_by ?? null,
    genres: Object.keys(entry.genres ?? {}),
    year: entry.year ?? null,
    episodes: entry.episodes ?? null,
    image: entry.image || null,
    status: entry.status || null,
  };
}

function compactManga(entry) {
  return {
    id: entry.mal_id,
    title: entry.title,
    titleEnglish: entry.title_english || null,
    type: entry.type || null,
    synopsis: truncate(entry.synopsis, MAX_SYNOPSIS_LEN),
    score: entry.score ?? null,
    scoredBy: entry.scored_by ?? null,
    genres: Object.keys(entry.genres ?? {}),
    year: entry.year ?? null,
    chapters: entry.chapters ?? null,
    volumes: entry.volumes ?? null,
    image: entry.image || null,
    status: entry.status || null,
  };
}

function buildDataset(inputPath, compactFn, kind) {
  const raw = JSON.parse(readFileSync(inputPath, 'utf8'));
  const filtered = raw
    .filter((entry) => qualifies(entry, kind))
    .sort((a, b) => a.mal_id - b.mal_id);
  if (new Set(filtered.map((entry) => entry.mal_id)).size !== filtered.length)
    throw new Error(`Duplicate ${kind} source identity`);
  const compacted = filtered.map(compactFn);
  console.log(`${kind}: ${compacted.length} qualified of ${raw.length} source records`);
  return compacted;
}

function jsonStable(data) {
  return JSON.stringify(data, null, 0) + '\n';
}

function writeOrCheck(outPath, data, label) {
  const content = jsonStable(data);
  if (checkMode) {
    if (!existsSync(outPath)) {
      console.error(`✗ ${label}: ${outPath} does not exist (run without --check first)`);
      return false;
    }
    const existing = readFileSync(outPath, 'utf8');
    if (existing !== content) {
      console.error(`✗ ${label}: drift detected — re-run without --check`);
      return false;
    }
    console.log(`✓ ${label}: no drift`);
    return true;
  }
  writeFileSync(outPath, content, 'utf8');
  const kb = Math.round(content.length / 1024);
  console.log(`  → ${outPath.replace(ROOT + '/', '')} (${kb} KB)`);
  return true;
}

let ok = true;

const animeData = buildDataset(ANIME_IN, compactAnime, 'anime');
ok = writeOrCheck(ANIME_OUT, animeData, 'anime') && ok;

const mangaData = buildDataset(MANGA_IN, compactManga, 'manga');
ok = writeOrCheck(MANGA_OUT, mangaData, 'manga') && ok;

if (!ok) process.exit(1);
