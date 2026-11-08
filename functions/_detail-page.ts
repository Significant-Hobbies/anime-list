import { rewriteShell, rewriteShellNoindex, type SeoEntry } from '../src/seoRewrite';
import { handleReadability } from './_readability';

export async function detailPage(
  context: Parameters<PagesFunction>[0],
  kind: 'anime' | 'manga',
  getEntry: (id: number, assets: Fetcher) => Promise<SeoEntry | null>
) {
  const { request, env, params } = context;
  const rawMalId = params.malId as string;
  if (kind === 'manga' && ['stats', 'watchlist'].includes(rawMalId)) return context.next();
  const wantsMarkdown = rawMalId.endsWith('.md');
  const idText = wantsMarkdown ? rawMalId.slice(0, -3) : rawMalId;
  const malId = /^\d+$/.test(idText) ? Number(idText) : Number.NaN;
  if (wantsMarkdown) {
    return (await handleReadability(request, env.ASSETS)) ?? new Response(null, { status: 404 });
  }

  let entry: SeoEntry | null;
  try {
    entry = await getEntry(malId, env.ASSETS);
  } catch {
    return new Response(
      request.method === 'HEAD'
        ? null
        : '<!doctype html><html lang="en"><head><meta name="robots" content="noindex"><title>Catalog temporarily unavailable — Anime List</title></head><body style="margin:0;background:#09090b;color:#fafafa;font:16px/1.7 system-ui,sans-serif;"><main style="max-width:48rem;margin:4rem auto;padding:1.5rem;"><h1>Catalog temporarily unavailable</h1><p>Please retry shortly. <a href="/catalog" style="color:#a5b4fc;">Browse the title catalog</a>.</p></main></body></html>',
      {
        status: 503,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
          'x-robots-tag': 'noindex',
          'retry-after': '60',
        },
      }
    );
  }

  // Fetch the SPA shell from ASSETS
  const shellResponse = await env.ASSETS.fetch(new URL('/', request.url));
  const shellHtml = await shellResponse.text();

  if (!entry || Number.isNaN(malId)) {
    // Unknown ID: serve shell with noindex
    const html = rewriteShellNoindex(shellHtml);
    return new Response(html, {
      status: 404,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'x-robots-tag': 'noindex',
        'cache-control': 'public, max-age=300, s-maxage=3600',
      },
    });
  }

  const origin = 'https://anime.significanthobbies.com';
  const html = rewriteShell(shellHtml, {
    origin,
    kind,
    entry,
  });

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=86400',
    },
  });
}
