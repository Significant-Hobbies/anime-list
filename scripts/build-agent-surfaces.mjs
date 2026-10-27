#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceMarkdown } from './source-markdown.mjs';
import {
  buildAiTxt,
  buildMarkdownIndex,
  buildFullMarkdown,
} from '../lib/agent-readability/documents.mjs';
import { createAgentSurfaceManifest } from '../lib/agent-readability/manifest.mjs';
import { markdownPathFor } from '../lib/agent-readability/http.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..');
const publicDir = resolve(root, 'public');
const origin = 'https://anime.significanthobbies.com';
const apiOrigin = 'https://mal-api.sarthakagrawal927.workers.dev';
const surfaces = JSON.parse(
  readFileSync(resolve(root, 'src/data/public-surfaces.json'), 'utf8')
).filter((surface) => surface.path !== '/discover');
const anime = JSON.parse(readFileSync(resolve(root, 'src/data/seo-anime.json'), 'utf8'));
const manga = JSON.parse(readFileSync(resolve(root, 'src/data/seo-manga.json'), 'utf8'));

function writePublic(path, content) {
  const output = resolve(publicDir, path.startsWith('/') ? path.slice(1) : path);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, content.trimEnd() + '\n', 'utf8');
}

const pageFiles = {
  '/': 'HomePage',
  '/about': 'AboutPage',
  '/privacy': 'PrivacyPage',
  '/terms': 'TermsPage',
  '/changelog': 'ChangelogPage',
  '/mcp': 'McpPage',
  '/discover': 'DiscoverPage',
  '/manga': 'MangaSearchPage',
  '/stats': 'StatsPage',
  '/manga/stats': 'MangaStatsPage',
  '/catalog-updates': 'CatalogUpdatesPage',
};
const pages = {};
for (const surface of surfaces) {
  const component = pageFiles[surface.path];
  const copy = component
    ? sourceMarkdown(resolve(root, `src/pages/${component}.tsx`), component)
    : '';
  const body = copy || `# ${surface.title}\n\n${surface.markdown}\n`;
  pages[surface.path] = body.replace(
    /^(# [^\n]+)\n/m,
    `$1\n\nCanonical: ${origin}${surface.path}\n`
  );
  if (surface.path === '/discover')
    pages[surface.path] +=
      '\nPersonal queue, quiz answers, and generated taste results are excluded.\n';
  if (surface.path === '/mcp')
    pages[surface.path] += '\nPersonal tokens and account data are excluded.\n';
  writePublic(markdownPathFor(surface.path), pages[surface.path]);
  if (surface.markdownPath !== markdownPathFor(surface.path))
    writePublic(surface.markdownPath, pages[surface.path]);
}
const routes = [
  ...surfaces.map((surface) => ({
    path: surface.path,
    title: surface.title,
    description: surface.description,
    aliases: surface.markdownPath !== markdownPathFor(surface.path) ? [surface.markdownPath] : [],
  })),
  ...[
    ['anime', anime],
    ['manga', manga],
  ].flatMap(([kind, entries]) =>
    entries.map((entry) => ({
      path: `/${kind}/${entry.id}`,
      title: entry.title,
      description: `${entry.title} — ${kind} catalog detail`,
      full: false,
    }))
  ),
].map((route) => ({
  ...route,
  url: origin + route.path,
  md: origin + markdownPathFor(route.path),
}));
const identity = {
  name: 'Anime List',
  url: origin,
  summary: surfaces[0].description,
  sitemap: origin + '/sitemap.xml',
  openapi: origin + '/openapi.json',
  contact: 'https://github.com/Significant-Hobbies/anime-list',
  trainingAllowed: true,
  updatedAt: '2026-10-27',
  excludedPaths: [
    '/discover',
    '/alerts',
    '/collections',
    '/quiz',
    '/schedule',
    '/watchlist',
    '/manga/watchlist',
    '/api/auth',
    '/api/tokens',
    '/api/watchlist',
    'personal discovery queues and quiz results',
  ],
  notes: [
    `## Developer docs\n\n- [OpenAPI specification](${origin}/openapi.json)\n- [Agent catalog](${origin}/api/ai)\n\n## CLI\n\n\`\`\`bash\ncurl -s -H 'Accept: text/markdown' ${origin}/about\n\`\`\``,
    'Full export contains authored static page content only. Live catalog data, title enrichment, search results and statistics are available through the individual Markdown routes; personal data is excluded.',
    `MCP: ${origin}/api/mcp. Public catalog tools need no authentication; personal watchlist tools require a token.`,
  ],
};
const manifest = createAgentSurfaceManifest({
  ...identity,
  pages,
  surfaces: routes
    .filter((route) => surfaces.some((surface) => surface.path === route.path))
    .map((route) => ({
      id: route.path,
      url: route.url,
      md: route.md,
      kind: 'dynamic',
      description: route.description,
    })),
});
manifest.catalog.openapi = identity.openapi;
manifest.catalog.collections = [
  ['anime', anime.length],
  ['manga', manga.length],
].map(([kind, count]) => ({
  id: kind,
  count,
  urlTemplate: `${identity.url}/${kind}/{malId}`,
  mdTemplate: `${identity.url}/${kind}/{malId}.md`,
}));
manifest.catalog.markdownCatalog = identity.url + '/api/md/_catalog';
manifest.catalog.mcp = {
  url: origin + '/api/mcp',
  documentation: origin + '/mcp',
  authentication:
    'Public catalog tools are open; private watchlist tools require a personal access token.',
};
manifest.catalog.dataResources = [
  { id: 'anime-stats', kind: 'api', url: `${apiOrigin}/api/stats` },
  { id: 'anime-detail', kind: 'api-template', urlTemplate: `${apiOrigin}/api/anime/{malId}` },
  { id: 'manga-detail', kind: 'api-template', urlTemplate: `${apiOrigin}/api/manga/{malId}` },
  { id: 'catalog-updates', kind: 'api', url: `${apiOrigin}/api/changelog` },
  { id: 'mcp', kind: 'mcp', url: `${apiOrigin}/api/mcp` },
];
identity.catalog = manifest.catalog;
writeFileSync(resolve(root, 'src/data/public-markdown.json'), JSON.stringify(pages) + '\n');
writePublic('/api/md/_catalog', JSON.stringify(routes));
writePublic('/api-ai.json', JSON.stringify(manifest.catalog));
writePublic('/llms.txt', buildMarkdownIndex(manifest, routes));
writePublic(
  '/llms-full.txt',
  (await buildFullMarkdown(manifest, routes, (path) => pages[path])) +
    '\n' +
    identity.notes.find((note) => note.startsWith('Full export')) +
    '\n'
);
writePublic('/ai.txt', buildAiTxt(manifest, routes));
writeFileSync(resolve(root, 'src/data/agent-identity.json'), JSON.stringify(identity) + '\n');
const blocked = [
  '/discover',
  '/alerts',
  '/collections',
  '/quiz',
  '/schedule',
  '/watchlist',
  '/manga/watchlist',
  '/api/auth',
  '/api/tokens',
  '/api/watchlist',
];
const bots = [
  '*',
  'GPTBot',
  'ClaudeBot',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Bytespider',
  'OAI-SearchBot',
  'ChatGPT-User',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
];
writePublic(
  '/robots.txt',
  '# Keep in sync with ai.txt and llms.txt.\n\n' +
    bots
      .map(
        (bot) =>
          `User-agent: ${bot}\nAllow: /\n${blocked.map((path) => `Disallow: ${path}`).join('\n')}`
      )
      .join('\n\n') +
    `\n\nSitemap: ${origin}/sitemap.xml\n`
);
console.log(
  `Generated ${surfaces.length} authored pages and ${routes.length} public route entries.`
);
