export type StaticSeoSurface = {
  path: string;
  title: string;
  description: string;
  markdown: string;
};

const SEO_START = '<!-- seo:start -->';
const SEO_END = '<!-- seo:end -->';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function rewriteStaticSeo(html: string, surface: StaticSeoSurface, origin: string) {
  const canonical = `${origin}${surface.path === '/' ? '' : surface.path}`;
  const title = escapeHtml(surface.title);
  const description = escapeHtml(surface.description);
  const canonicalEscaped = escapeHtml(canonical);
  const image = `${origin}/apple-touch-icon.png`;
  const block = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${canonicalEscaped}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:url" content="${canonicalEscaped}" />`,
    '<meta property="og:site_name" content="Anime List" />',
    `<meta property="og:image" content="${image}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
  ].join('\n    ');

  const rewritten = html.replace(
    new RegExp(`${SEO_START}[\\s\\S]*?${SEO_END}`),
    () => `${SEO_START}\n    ${block}\n    ${SEO_END}`
  );
  if (rewritten === html) throw new Error('seo:start/end markers not found in shell HTML');
  // Keep the persistent homepage/LCP copy. Other static routes need their own
  // initial content; React replaces this bounded summary when the app mounts.
  if (surface.path === '/') return rewritten;

  const summary = [
    '<article data-ssr aria-label="Page summary">',
    `  <h1>${title}</h1>`,
    `  <p>${description}</p>`,
    ...surface.markdown.split(/\n\n+/).map((paragraph) => `  <p>${escapeHtml(paragraph)}</p>`),
    '</article>',
  ].join('\n      ');
  const withSummary = rewritten.replace(
    /<!-- ssr:start -->[\s\S]*?<!-- ssr:end -->/,
    () => `<!-- ssr:start -->\n      ${summary}\n      <!-- ssr:end -->`
  );
  if (withSummary === rewritten) throw new Error('ssr:start/end markers not found in shell HTML');

  // The hidden homepage hero is still in the shared shell. Only the actual
  // route's summary should be a primary heading before JavaScript loads.
  return withSummary.replace(
    /<h1 id="lcp-shell-title"([^>]*)>([\s\S]*?)<\/h1>/,
    '<p id="lcp-shell-title"$1>$2</p>'
  );
}
