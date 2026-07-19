/**
 * Pure function: rewrite an SPA shell's HTML for a detail page.
 *
 * Used by Pages Functions to serve crawlable HTML for /anime/:id and
 * /manga/:id routes. Replaces the <!-- seo:start/end --> head block,
 * inserts JSON-LD, and injects a hidden SSR summary after <div id="root">.
 *
 * Escaping: all interpolated values are HTML-escaped. The JSON-LD block
 * is JSON.stringify'd (which escapes </script> as <\/script> in JSON
 * strings — but we also replace bare </script> in the serialized JSON
 * to be safe).
 */

export interface SeoEntry {
  id: number;
  title: string;
  titleEnglish?: string | null;
  type?: string | null;
  synopsis: string;
  score?: number | null;
  scoredBy?: number | null;
  genres: string[];
  year?: number | null;
  episodes?: number | null;
  chapters?: number | null;
  volumes?: number | null;
  image?: string | null;
}

export type SeoKind = 'anime' | 'manga';

export interface RewriteOptions {
  origin: string;
  kind: SeoKind;
  entry: SeoEntry;
}

// ── HTML escaping ───────────────────────────────────────────────────────

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeJsonLd(s: string): string {
  // JSON.stringify handles most escaping; just neutralize </script> sequences
  return s.replace(/<\/script/gi, '<\\/script');
}

// ── JSON-LD ─────────────────────────────────────────────────────────────

export function buildJsonLd(entry: SeoEntry, kind: SeoKind, canonicalUrl: string): object {
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    name: entry.title,
    alternateName: entry.titleEnglish || undefined,
    description: entry.synopsis,
    url: canonicalUrl,
    genre: entry.genres,
  };

  if (entry.image) base.image = entry.image;
  if (entry.year) base.dateCreated = String(entry.year);

  if (entry.score != null && entry.score > 0) {
    base.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: entry.score,
      bestRating: 10,
      ...(entry.scoredBy ? { ratingCount: entry.scoredBy } : {}),
    };
  }

  if (kind === 'anime') {
    if (entry.type === 'Movie') {
      base['@type'] = 'Movie';
    } else {
      base['@type'] = 'TVSeries';
      if (entry.episodes != null) base.numberOfEpisodes = entry.episodes;
    }
  } else {
    base['@type'] = 'Book';
    base.bookFormat = 'https://schema.org/GraphicNovel';
    if (entry.chapters != null) base.numberOfPages = entry.chapters;
  }

  // Remove undefined values
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(base)) {
    if (v !== undefined && v !== null) clean[k] = v;
  }
  return clean;
}

// ── Head block ──────────────────────────────────────────────────────────

export function buildHeadBlock(entry: SeoEntry, kind: SeoKind, canonicalUrl: string): string {
  const titleEsc = escapeHtml(entry.title);
  const kindLabel = kind === 'anime' ? 'anime' : 'manga';
  const desc =
    entry.synopsis ||
    `Discover ${entry.title} — ${kindLabel} details, score, genres, and more on Shelf.`;
  const descEsc = escapeHtml(desc);
  const titleFull = `${titleEsc} — Shelf`;

  const ogImage = entry.image || '/og.png';

  const jsonLd = buildJsonLd(entry, kind, canonicalUrl);
  const jsonLdStr = escapeJsonLd(JSON.stringify(jsonLd));

  return [
    `<title>${titleFull}</title>`,
    `<meta name="description" content="${descEsc}" />`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:title" content="${titleFull}" />`,
    `<meta property="og:description" content="${descEsc}" />`,
    `<meta property="og:type" content="${kind === 'anime' ? 'video.episode' : 'book'}" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:site_name" content="Shelf" />`,
    `<meta property="og:image" content="${escapeHtml(ogImage)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${titleFull}" />`,
    `<meta name="twitter:description" content="${descEsc}" />`,
    `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />`,
    `<script type="application/ld+json">${jsonLdStr}</script>`,
  ].join('\n    ');
}

// ── SSR summary ─────────────────────────────────────────────────────────

export function buildSsrSummary(entry: SeoEntry, kind: SeoKind): string {
  const titleEsc = escapeHtml(entry.title);
  const synopsisEsc = escapeHtml(entry.synopsis || '');
  const kindLabel = kind === 'anime' ? 'Anime' : 'Manga';

  const facts: string[] = [];
  if (entry.type) facts.push(`<dt>Type</dt><dd>${escapeHtml(entry.type)}</dd>`);
  if (entry.score != null && entry.score > 0)
    facts.push(
      `<dt>Score</dt><dd>${entry.score} / 10${entry.scoredBy ? ` (${entry.scoredBy.toLocaleString()} votes)` : ''}</dd>`
    );
  if (entry.genres.length)
    facts.push(`<dt>Genres</dt><dd>${entry.genres.map(escapeHtml).join(', ')}</dd>`);
  if (entry.year) facts.push(`<dt>Year</dt><dd>${entry.year}</dd>`);
  if (kind === 'anime' && entry.episodes != null)
    facts.push(`<dt>Episodes</dt><dd>${entry.episodes}</dd>`);
  if (kind === 'manga' && entry.chapters != null)
    facts.push(`<dt>Chapters</dt><dd>${entry.chapters}</dd>`);

  return [
    '<div hidden data-ssr style="display:none">',
    `  <h1>${titleEsc}</h1>`,
    `  <p><strong>${kindLabel}</strong> — discover, filter, and track on Shelf.</p>`,
    `  <p>${synopsisEsc}</p>`,
    facts.length ? `  <dl>${facts.join('')}</dl>` : '',
    '</div>',
  ]
    .filter(Boolean)
    .join('\n      ');
}

// ── Noindex head ────────────────────────────────────────────────────────

function buildNoindexHead(): string {
  return '<meta name="robots" content="noindex" />';
}

// ── Main rewrite ────────────────────────────────────────────────────────

const SEO_START = '<!-- seo:start -->';
const SEO_END = '<!-- seo:end -->';
const SSR_START = '<!-- ssr:start -->';
const SSR_END = '<!-- ssr:end -->';

export function rewriteShell(html: string, opts: RewriteOptions): string {
  const { origin, kind, entry } = opts;
  const canonicalUrl = `${origin}/${kind}/${entry.id}`;

  // Replace head block between seo markers
  const headBlock = buildHeadBlock(entry, kind, canonicalUrl);
  const headResult = html.replace(
    new RegExp(`${SEO_START}[\\s\\S]*?${SEO_END}`),
    `${SEO_START}\n    ${headBlock}\n    ${SEO_END}`
  );

  if (headResult === html) {
    throw new Error('seo:start/end markers not found in shell HTML');
  }

  // Replace SSR block between ssr markers
  const ssrBlock = buildSsrSummary(entry, kind);
  const ssrResult = headResult.replace(
    new RegExp(`${SSR_START}[\\s\\S]*?${SSR_END}`),
    `${SSR_START}\n      ${ssrBlock}\n      ${SSR_END}`
  );

  if (ssrResult === headResult) {
    throw new Error('ssr:start/end markers not found in shell HTML');
  }

  return ssrResult;
}

export function rewriteShellNoindex(html: string): string {
  // Insert noindex meta into the seo block (replacing canonical)
  const noindex = buildNoindexHead();
  const result = html.replace(
    new RegExp(`${SEO_START}[\\s\\S]*?${SEO_END}`),
    `${SEO_START}\n    ${noindex}\n    ${SEO_END}`
  );

  if (result === html) {
    throw new Error('seo:start/end markers not found in shell HTML');
  }

  return result;
}
