#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..');
const publicDir = resolve(root, 'public');
const origin = 'https://anime.significanthobbies.com';
const apiOrigin = 'https://mal-api.sarthakagrawal927.workers.dev';
const surfaces = JSON.parse(readFileSync(resolve(root, 'src/data/public-surfaces.json'), 'utf8'));
const anime = JSON.parse(readFileSync(resolve(root, 'src/data/seo-anime.json'), 'utf8'));
const manga = JSON.parse(readFileSync(resolve(root, 'src/data/seo-manga.json'), 'utf8'));

function writePublic(path, content) {
  const output = resolve(publicDir, path.replace(/^\//, ''));
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, content.trimEnd() + '\n', 'utf8');
}

for (const surface of surfaces) {
  writePublic(
    surface.markdownPath,
    `# ${surface.title}

${surface.markdown}

## Links

- [HTML page](${origin}${surface.path === '/' ? '/' : surface.path})
- [Agent catalog](${origin}/api/ai)
- [Anime List home](${origin}/)`
  );
}

const catalog = {
  name: 'Anime List',
  version: '2',
  url: origin,
  llms: `${origin}/llms.txt`,
  llmsFull: `${origin}/llms-full.txt`,
  sitemap: `${origin}/sitemap.xml`,
  robots: `${origin}/robots.txt`,
  markdown: { suffix: '.md', negotiation: true },
  openapi: `${origin}/openapi.json`,
  surfaces: surfaces.map((surface) => ({
    id: surface.id,
    url: `${origin}${surface.path}`,
    md: `${origin}${surface.markdownPath}`,
    kind: 'static',
    description: surface.description,
  })),
  collections: [
    {
      id: 'anime',
      count: anime.length,
      urlTemplate: `${origin}/anime/{malId}`,
      mdTemplate: `${origin}/anime/{malId}.md`,
      source: 'MyAnimeList catalog via the checked-in Anime List SEO dataset',
    },
    {
      id: 'manga',
      count: manga.length,
      urlTemplate: `${origin}/manga/{malId}`,
      mdTemplate: `${origin}/manga/{malId}.md`,
      source: 'MyAnimeList catalog via the checked-in Anime List SEO dataset',
    },
  ],
  dataResources: [
    { id: 'anime-stats', kind: 'api', url: `${apiOrigin}/api/stats` },
    { id: 'anime-detail', kind: 'api-template', urlTemplate: `${apiOrigin}/api/anime/{malId}` },
    { id: 'manga-detail', kind: 'api-template', urlTemplate: `${apiOrigin}/api/manga/{malId}` },
    { id: 'catalog-updates', kind: 'api', url: `${apiOrigin}/api/changelog` },
    { id: 'mcp', kind: 'mcp', url: `${apiOrigin}/api/mcp` },
  ],
  auth: {
    public: true,
    notes:
      'Catalog discovery is public. Watchlists, schedules, MCP watchlist tools, and personal access tokens require authentication and are excluded.',
  },
};

writePublic('/api-ai.json', JSON.stringify(catalog, null, 2));
writePublic(
  '/llms.txt',
  `# Anime List

> Anime and manga discovery with advanced filtering, statistics, and optional personal tracking.

## Public pages

${surfaces.map((surface) => `- [${surface.title}](${origin}${surface.path})`).join('\n')}

## Catalog collections

- Anime detail: ${origin}/anime/{malId} and ${origin}/anime/{malId}.md
- Manga detail: ${origin}/manga/{malId} and ${origin}/manga/{malId}.md

## Machine surfaces

- [Agent catalog](${origin}/api/ai)
- [OpenAPI spec](${origin}/openapi.json): OpenAPI 3.1 specification
- [Sitemap](${origin}/sitemap.xml)
- [Homepage Markdown](${origin}/index.md)

## Developer docs

- [OpenAPI specification](${origin}/openapi.json): Full API surface description (OpenAPI 3.1)
- [Agent catalog](${origin}/api/ai): JSON inventory of public agent surfaces

## CLI

\`\`\`bash
# Fetch the agent catalog
curl -s ${origin}/api/ai | jq .

# Get the OpenAPI spec
curl -s ${origin}/openapi.json | jq .

# Fetch the homepage as markdown
curl -s -H 'Accept: text/markdown' ${origin}/
\`\`\``
);
writePublic(
  '/llms-full.txt',
  `# Anime List — full agent brief

Anime List indexes ${anime.length.toLocaleString()} popular anime and ${manga.length.toLocaleString()} popular manga for crawlable public discovery.

${surfaces.map((surface) => `## ${surface.title}\n\n${surface.markdown}`).join('\n\n')}

## Authentication boundary

Public catalog pages and detail Markdown require no account. Personal watchlists, schedules, token management, and authenticated MCP tools are not public indexing surfaces.`
);

process.stdout.write(
  `Generated ${surfaces.length} static Markdown surfaces, ${anime.length} anime and ${manga.length} manga collection entries.\n`
);
