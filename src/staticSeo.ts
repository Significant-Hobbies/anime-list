export type StaticSeoSurface = {
  path: string;
  title: string;
  description: string;
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
    '<meta property="og:site_name" content="Shelf" />',
    `<meta property="og:image" content="${image}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
  ].join('\n    ');

  const rewritten = html.replace(
    new RegExp(`${SEO_START}[\\s\\S]*?${SEO_END}`),
    `${SEO_START}\n    ${block}\n    ${SEO_END}`
  );
  if (rewritten === html) throw new Error('seo:start/end markers not found in shell HTML');
  return rewritten;
}
