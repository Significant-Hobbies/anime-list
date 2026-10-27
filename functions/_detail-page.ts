import { rewriteShell, rewriteShellNoindex, type SeoEntry } from '../src/seoRewrite';
import { handleReadability } from './_readability';

export async function detailPage(
  context: Parameters<PagesFunction>[0],
  kind: 'anime' | 'manga',
  getEntry: (id: number) => SeoEntry | null
) {
  const { request, env, params } = context;
  const rawMalId = params.malId as string;
  if (kind === 'manga' && ['stats', 'watchlist'].includes(rawMalId)) return context.next();
  const wantsMarkdown = rawMalId.endsWith('.md');
  const idText = wantsMarkdown ? rawMalId.slice(0, -3) : rawMalId;
  const malId = /^\d+$/.test(idText) ? Number(idText) : Number.NaN;
  const entry = getEntry(malId);

  if (wantsMarkdown) {
    return (await handleReadability(request, env.ASSETS)) ?? new Response(null, { status: 404 });
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
