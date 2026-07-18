#!/usr/bin/env node
/**
 * check-docs.mjs — validate internal Markdown links in this repo's docs.
 *
 * Scans a fixed set of root docs (AGENTS.md, STATUS.md, README.md,
 * PROJECT_STATUS.md) plus every .md under docs/, and verifies that:
 *   - relative file links (./foo, ../foo, foo.md, dir/foo) resolve to a
 *     real file on disk;
 *   - in-page anchors (#section) point at a heading that exists in the
 *     target file (best-effort, lowercased slug);
 *   - no markdown file under docs/ is orphaned from the index (warned, not
 *     fatal — archive entries are intentionally not all linked).
 *
 * External http(s) links are NOT checked here — use `blume validate --external`
 * for that. Code references in backticks are ignored.
 *
 * Usage:
 *   node scripts/check-docs.mjs            # check + fail on broken links
 *   node scripts/check-docs.mjs --quiet    # only print failures
 *
 * Exit code is non-zero if any broken internal link is found.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, normalize, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DOCS = join(ROOT, 'docs');

const ROOT_FILES = ['AGENTS.md', 'STATUS.md', 'README.md', 'PROJECT_STATUS.md', 'CLAUDE.md']
  .map((f) => join(ROOT, f))
  .filter(existsSync);

function walkMd(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      // skip generated blume runtimes if present inside docs (defensive)
      if (entry === '.blume' || entry === '.blume-verify') continue;
      walkMd(full, out);
    } else if (extname(entry) === '.md') {
      out.push(full);
    }
  }
  return out;
}

const DOC_FILES = walkMd(DOCS);
const ALL_FILES = [...ROOT_FILES, ...DOC_FILES];

// Markdown link regex: [text](target)  (ignore images ![..](..) and code spans)
const LINK_RE = /(?<!!)\[(?:[^\]\[]|\[[^\]\[]*\])*\]\(([^)]+)\)/g;

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function headingsIn(file) {
  const text = readFileSync(file, 'utf8');
  const heads = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (m) heads.push(slugify(m[2]));
  }
  return heads;
}

function stripAnchor(target) {
  const idx = target.indexOf('#');
  if (idx === -1) return { path: target, anchor: null };
  return { path: target.slice(0, idx), anchor: target.slice(idx + 1) };
}

const failures = [];
const warnings = [];

for (const file of ALL_FILES) {
  const text = readFileSync(file, 'utf8');
  let m;
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(text)) !== null) {
    let raw = m[1].trim();
    // strip optional title in quotes: (path "title")
    const titleMatch = raw.match(/^(\S+)(?:\s+"[^"]*")?$/);
    if (titleMatch) raw = titleMatch[1];
    // ignore external, mailto, and absolute-url "fake" anchors
    if (/^(https?:|mailto:|tel:)/i.test(raw)) continue;
    if (raw.startsWith('#')) {
      // in-page anchor
      const anchor = raw.slice(1);
      const heads = headingsIn(file);
      if (anchor && !heads.includes(slugify(decodeURIComponent(anchor)))) {
        failures.push(`${relative(ROOT, file)}: broken in-page anchor #${anchor}`);
      }
      continue;
    }
    const { path: linkPath, anchor } = stripAnchor(raw);
    if (!linkPath) continue; // pure anchor handled above
    const target = normalize(join(dirname(file), linkPath));
    if (!existsSync(target)) {
      failures.push(`${relative(ROOT, file)}: broken link -> ${linkPath}`);
      continue;
    }
    if (anchor) {
      const heads = headingsIn(target);
      if (!heads.includes(slugify(decodeURIComponent(anchor)))) {
        failures.push(`${relative(ROOT, file)}: broken anchor ${raw} (target has no such heading)`);
      }
    }
  }
}

// Orphan check: every docs/*.md (except archive) should be reachable from
// docs/index.md — either directly, or via a link to an ancestor directory
// (the index links to directories like `product/`, `architecture/decisions/`).
const indexFile = join(DOCS, 'index.md');
if (existsSync(indexFile)) {
  const indexText = readFileSync(indexFile, 'utf8');
  for (const f of DOC_FILES) {
    if (f.includes(join('docs', 'archive'))) continue; // archive intentionally not all linked
    if (f === indexFile) continue;
    const rel = relative(DOCS, f).replace(/\\/g, '/');
    // direct link to the file?
    const fileRe = new RegExp(`\\]\\([^)]*${rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^)]*\\)`);
    if (fileRe.test(indexText)) continue;
    // link to any ancestor directory (e.g. `product/`, `architecture/decisions/`)?
    const parts = rel.split('/');
    let reached = false;
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join('/') + '/';
      const dirRe = new RegExp(`\\]\\([^)]*${dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^)]*\\)`);
      if (dirRe.test(indexText)) {
        reached = true;
        break;
      }
    }
    if (!reached) warnings.push(`${relative(ROOT, f)}: not linked from docs/index.md`);
  }
}

const quiet = process.argv.includes('--quiet');

if (!quiet) {
  for (const w of warnings) console.log('WARN ' + w);
}
for (const f of failures) console.error('FAIL ' + f);

if (failures.length) {
  console.error(`\n${failures.length} broken internal link(s) found.`);
  process.exit(1);
}
if (!quiet)
  console.log(`\nOK: ${ALL_FILES.length} markdown files checked, 0 broken internal links.`);
process.exit(0);
