/**
 * Pages Function: /manga/:malId
 *
 * Rewrites the SPA shell with SEO metadata for popular manga.
 * Unknown/invalid IDs get the shell with noindex and a real 404 status.
 */

import { rewriteShell, rewriteShellNoindex } from '../../src/seoRewrite';
import { markdownResponse, renderDetailMarkdown } from '../../src/agentMarkdown';
import { getMangaEntry } from '../_seo-dataset';

export const onRequestGet: PagesFunction = async (context) => {
  const { request, env, params } = context;
  const rawMalId = params.malId as string;
  const wantsMarkdown = rawMalId.endsWith('.md');
  const idText = wantsMarkdown ? rawMalId.slice(0, -3) : rawMalId;
  const malId = /^\d+$/.test(idText) ? Number(idText) : Number.NaN;
  const entry = getMangaEntry(malId);

  if (wantsMarkdown) {
    return entry && !Number.isNaN(malId)
      ? markdownResponse(renderDetailMarkdown(entry, 'manga'))
      : markdownResponse('# Manga not found', 404);
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
