#!/usr/bin/env node
/**
 * Build compact SEO datasets from the cleaned anime/manga JSON.
 *
 * Filters by popularity threshold and emits only the fields needed for
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Thresholds (tuned for ~5k anime + ~2k manga) ────────────────────────
const ANIME_MIN_MEMBERS = 20_000; // → ~5,306 entries
const MANGA_MIN_MEMBERS = 10_000; // → ~2,288 entries

const ANIME_IN = resolve(ROOT, 'cleaned_anime_data.json');
const MANGA_IN = resolve(ROOT, 'cleaned_manga_data.json');
const ANIME_OUT = resolve(ROOT, 'src/data/seo-anime.json');
const MANGA_OUT = resolve(ROOT, 'src/data/seo-manga.json');

const MAX_SYNOPSIS_LEN = 300;

const checkMode = process.argv.includes('--check');

function truncate(text, max) {
  if (!text) return '';
  const t = text.trim();
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
  };
}

function buildDataset(inputPath, minMembers, compactFn, label) {
  const raw = JSON.parse(readFileSync(inputPath, 'utf8'));
  const filtered = raw
    .filter((e) => typeof e.members === 'number' && e.members >= minMembers)
    .sort((a, b) => a.mal_id - b.mal_id);
  const compacted = filtered.map(compactFn);
  console.log(`${label}: ${compacted.length} entries (members >= ${minMembers})`);
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

const animeData = buildDataset(ANIME_IN, ANIME_MIN_MEMBERS, compactAnime, 'anime');
ok = writeOrCheck(ANIME_OUT, animeData, 'anime') && ok;

const mangaData = buildDataset(MANGA_IN, MANGA_MIN_MEMBERS, compactManga, 'manga');
ok = writeOrCheck(MANGA_OUT, mangaData, 'manga') && ok;

if (!ok) process.exit(1);
