import surfaces from '../src/data/public-surfaces.json';
import { rewriteStaticSeo } from '../src/staticSeo';

const publicSurfaces = new Map(surfaces.map((surface) => [surface.path, surface]));

export const onRequest: PagesFunction = async (context) => {
  const { request } = context;
  if (request.method !== 'GET') return context.next();

  const url = new URL(request.url);
  const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/$/, '') : '/';
  const surface = publicSurfaces.get(pathname);
  if (!surface) return context.next();

  const response = await context.next();
  const contentType = response.headers.get('content-type') ?? '';
  if (response.status !== 200 || !contentType.includes('text/html')) return response;

  const html = rewriteStaticSeo(await response.text(), surface, url.origin);
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'public, max-age=300, s-maxage=86400');
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
