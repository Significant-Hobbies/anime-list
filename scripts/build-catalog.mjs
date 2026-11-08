#!/usr/bin/env node
// Build real paginated HTML links from exactly the admitted title inventory.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOG_PAGE_SIZE } from './lib/catalog-pages.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => JSON.parse(readFileSync(resolve(root, file), 'utf8'));
const collections = {
  anime: read('src/data/seo-anime.json'),
  manga: read('src/data/seo-manga.json'),
};
const pages = read('src/data/catalog-pages.json');
const origin = 'https://anime.significanthobbies.com';
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
  );
const link = (path, title) => `<a href="${escape(path)}">${escape(title)}</a>`;
for (const page of pages) {
  const entries = collections[page.kind];
  const siblings = pages.filter((item) => item.kind === page.kind);
  const body = page.kind
    ? `<p>${entries.length.toLocaleString('en-US')} ${page.kind} titles. Page ${page.page} of ${siblings.length}.</p><ol start="${(page.page - 1) * CATALOG_PAGE_SIZE + 1}">${entries
        .slice((page.page - 1) * CATALOG_PAGE_SIZE, page.page * CATALOG_PAGE_SIZE)
        .map(
          (entry) =>
            `<li>${link(`/${page.kind}/${entry.id}`, entry.title)}<span>${escape(entry.type)} · ${entry.year} · ${escape(entry.genres.join(', '))}</span></li>`
        )
        .join('')}</ol><nav aria-label="Pagination">${siblings
        .filter((item) => Math.abs(item.page - page.page) === 1)
        .map((item) => link(item.path, item.page < page.page ? 'Previous page' : 'Next page'))
        .join(' · ')}</nav>`
    : `<p>Browse ${collections.anime.length.toLocaleString('en-US')} anime and ${collections.manga.length.toLocaleString('en-US')} manga by title, format, release year and genre. Open a title for its synopsis and MyAnimeList details.</p>${[
        'anime',
        'manga',
      ]
        .map(
          (kind) =>
            `<h2>${kind === 'anime' ? 'Anime' : 'Manga'}</h2><div class="pages">${pages
              .filter((item) => item.kind === kind)
              .map((item) => link(item.path, `Page ${item.page}`))
              .join('')}</div>`
        )
        .join('')}`;
  const html = `<!doctype html><html lang="en" class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(page.title)} — Anime List</title><meta name="description" content="Browse source-backed anime and manga titles, with factual detail pages and MyAnimeList provenance."><link rel="canonical" href="${origin}${page.path}"><link rel="alternate" type="text/markdown" href="${origin}${page.path}.md"><link rel="icon" href="/icon.svg" type="image/svg+xml"><meta name="theme-color" content="#09090b"><style>body{margin:0;background:#09090b;color:#fafafa;font:16px/1.7 system-ui,sans-serif}main,header{max-width:72rem;margin:auto;padding:1.5rem}header{border-bottom:1px solid #27272a}a{color:#a5b4fc;text-underline-offset:4px}h1,h2{line-height:1.25;letter-spacing:-.025em}h1{font-size:clamp(1.8rem,4vw,2.75rem)}p,span{color:#a1a1aa}ol{padding-left:1.5rem;columns:2;column-gap:3rem}li{break-inside:avoid;padding:.5rem 0;overflow-wrap:anywhere}li span{display:block;font-size:.875rem}.pages{display:flex;flex-wrap:wrap;gap:.5rem 1.5rem}.pages a{min-width:4rem;padding:.25rem 0}nav{padding:1rem 0}footer{margin-top:3rem;border-top:1px solid #27272a;padding-top:1rem;font-size:.875rem}@media(max-width:639px){ol{columns:1}main,header{padding:1rem}}</style></head><body><header>${link('/', 'Anime List')} · ${link('/search', 'Search anime')} · ${link('/manga', 'Search manga')}</header><main><nav aria-label="Breadcrumb">${link('/catalog', 'Title catalog')}${page.kind ? ' / ' + escape(page.kind) : ''}</nav><h1>${escape(page.title)}</h1>${body}<footer>Source: public MyAnimeList catalog snapshot committed 12 February 2026. Scores and availability may have changed. Open MyAnimeList from each title for its current scores and publication status. ${link('/about', 'About Anime List')} · ${link(page.path + '.md', 'Read as Markdown')}</footer></main></body></html>`;
  const output = resolve(root, 'dist', page.path.slice(1) + '.html');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, html + '\n');
}
console.log(
  `Generated ${pages.length} HTML catalog pages linking ${collections.anime.length + collections.manga.length} qualified titles.`
);
