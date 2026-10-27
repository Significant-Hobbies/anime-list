import surfaces from '../src/data/public-surfaces.json';
import anime from '../src/data/seo-anime.json';
import manga from '../src/data/seo-manga.json';
import identity from '../src/data/agent-identity.json';
import { renderPublicMarkdown } from '../src/publicMarkdown';
import { createAgentSurfaceManifest } from '../lib/agent-readability/manifest.mjs';
import {
  createAgentSurfaceHandler,
  discoveryLinkHeader,
} from '../lib/agent-readability/handler.mjs';
import { markdownPathFor, markdownResponse } from '../lib/agent-readability/http.mjs';

export const publicRoutes = [
  ...surfaces
    .filter((surface) => surface.path !== '/discover')
    .map((surface) => ({
      path: surface.path,
      title: surface.title,
      description: surface.description,
      aliases: surface.markdownPath !== markdownPathFor(surface.path) ? [surface.markdownPath] : [],
    })),
  ...(
    [
      ['anime', anime],
      ['manga', manga],
    ] as const
  ).flatMap(([kind, entries]) =>
    entries.map((entry) => ({
      path: `/${kind}/${entry.id}`,
      title: entry.title,
      description: `${entry.title} — ${kind} catalog detail`,
      full: false,
    }))
  ),
].map((route) => ({
  ...route,
  url: identity.url + route.path,
  md: identity.url + markdownPathFor(route.path),
}));
const manifest = createAgentSurfaceManifest(identity);
manifest.catalog = identity.catalog;

function publicRoute(path: string) {
  return publicRoutes.find((route) => route.path === (path.replace(/\/+$/, '') || '/'));
}

export function readableHtml(response: Response, path: string) {
  if (response.status !== 200 || !response.headers.get('Content-Type')?.includes('text/html'))
    return response;
  const route = publicRoute(path);
  if (!route) return response;
  const headers = new Headers(response.headers);
  headers.append(
    'Link',
    `<${identity.url}/api/mcp>; rel="mcp-server", ` +
      discoveryLinkHeader(identity.url) +
      `, <${route.md}>; rel="alternate"; type="text/markdown"`
  );
  const vary = headers.get('Vary');
  if (vary !== '*' && !vary?.split(',').some((part) => part.trim().toLowerCase() === 'accept'))
    headers.set('Vary', vary ? vary + ', Accept' : 'Accept');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, headers });
}

export async function handleReadability(request: Request, assets: Fetcher) {
  const path = new URL(request.url).pathname;
  if (/^\/(?:assets|fonts|images)\//.test(path)) return null;
  const handler = createAgentSurfaceHandler({
    manifest,
    listMarkdownRoutes: () => publicRoutes,
    loadMarkdown: renderPublicMarkdown,
    loadFullMarkdown: async () => {
      const response = await assets.fetch(new Request(identity.url + '/llms-full.txt'));
      if (!response.ok || !response.headers.get('Content-Type')?.includes('text/plain'))
        throw new Error('Full export unavailable');
      const body = await response.text();
      if (!body.startsWith('# Anime List') || body.length > 500000)
        throw new Error('Invalid full export');
      return body;
    },
  });
  try {
    return await handler(request);
  } catch (error) {
    console.warn(
      'Public Markdown unavailable:',
      error instanceof Error ? error.message : 'unknown error'
    );
    const response = markdownResponse(
      '# Temporarily unavailable\n\nThe public catalog could not be loaded. Please retry later.\n',
      request,
      {
        'Cache-Control': 'no-store',
        'CDN-Cache-Control': 'no-store',
        'Cloudflare-CDN-Cache-Control': 'no-store',
        'Retry-After': '60',
      }
    );
    return new Response(response.body, { status: 503, headers: response.headers });
  }
}
