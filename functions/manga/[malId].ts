/**
 * Pages Function: /manga/:malId
 *
 * Rewrites the SPA shell with SEO metadata for popular manga.
 * Unknown/invalid IDs get the shell with noindex.
 */

import { rewriteShell, rewriteShellNoindex } from '../../src/seoRewrite';
import { getMangaEntry } from '../_seo-dataset';

export const onRequestGet: PagesFunction = async (context) => {
  const { request, env, params } = context;
  const malId = parseInt(params.malId as string, 10);

  // Fetch the SPA shell from ASSETS
  const shellResponse = await env.ASSETS.fetch(new URL('/', request.url));
  const shellHtml = await shellResponse.text();

  const entry = getMangaEntry(malId);
  if (!entry || Number.isNaN(malId)) {
    // Unknown ID: serve shell with noindex
    const html = rewriteShellNoindex(shellHtml);
    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300, s-maxage=3600',
      },
    });
  }

  const origin = `https://${new URL(request.url).host}`;
  const html = rewriteShell(shellHtml, {
    origin,
    kind: 'manga',
    entry,
  });

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=86400',
    },
  });
};
