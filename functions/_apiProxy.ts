import { PRODUCTION_API_URL } from '../lib/apiConfig';

type Fetcher = (request: Request) => Promise<Response>;

export async function proxyApiRequest(
  request: Request,
  fetcher: Fetcher = (upstreamRequest) => fetch(upstreamRequest)
): Promise<Response> {
  const startedAt = performance.now();
  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, PRODUCTION_API_URL);
  const headers = new Headers(request.headers);

  // Let fetch set the upstream Host while preserving the original application
  // host for diagnostics. Cookie, Authorization, Origin, and Content-Type are
  // deliberately forwarded.
  headers.delete('host');
  headers.set('x-forwarded-host', incomingUrl.host);
  headers.set('x-forwarded-proto', incomingUrl.protocol.replace(':', ''));

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const upstreamRequest = new Request(upstreamUrl, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    redirect: 'manual',
  });
  const upstreamResponse = await fetcher(upstreamRequest);
  const responseHeaders = new Headers(upstreamResponse.headers);
  const proxyTiming = `edge-proxy;dur=${Math.round(performance.now() - startedAt)}`;
  const upstreamTiming = responseHeaders.get('server-timing');
  responseHeaders.set(
    'server-timing',
    upstreamTiming ? `${upstreamTiming}, ${proxyTiming}` : proxyTiming
  );

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}
