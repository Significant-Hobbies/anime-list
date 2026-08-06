import { describe, expect, it, vi } from 'vitest';
import { proxyApiRequest } from './_apiProxy';

describe('proxyApiRequest', () => {
  it('forwards API method, query, body, auth, and the original host', async () => {
    let forwarded: Request | undefined;
    const fetcher = vi.fn(async (request: Request) => {
      forwarded = request;
      return new Response('{"ok":true}', {
        status: 201,
        headers: {
          'content-type': 'application/json',
          'server-timing': 'app;dur=12',
          'set-cookie': 'mal_auth_token=test; HttpOnly; Secure; SameSite=None',
        },
      });
    });
    const request = new Request('https://anime.significanthobbies.com/api/search?from=test', {
      method: 'POST',
      headers: {
        authorization: 'Bearer token',
        cookie: 'mal_auth_token=existing',
        'content-type': 'application/json',
      },
      body: '{"filters":[]}',
    });

    const response = await proxyApiRequest(request, fetcher);

    expect(fetcher).toHaveBeenCalledOnce();
    expect(forwarded?.url).toBe(
      'https://mal-api.sarthakagrawal927.workers.dev/api/search?from=test'
    );
    expect(forwarded?.method).toBe('POST');
    expect(forwarded?.headers.get('authorization')).toBe('Bearer token');
    expect(forwarded?.headers.get('cookie')).toBe('mal_auth_token=existing');
    expect(forwarded?.headers.get('x-forwarded-host')).toBe('anime.significanthobbies.com');
    expect(await forwarded?.text()).toBe('{"filters":[]}');
    expect(response.status).toBe(201);
    expect(response.headers.get('set-cookie')).toContain('mal_auth_token=test');
    expect(response.headers.get('server-timing')).toContain('app;dur=12');
    expect(response.headers.get('server-timing')).toContain('edge-proxy;dur=');
  });

  it('forwards GET requests without a body', async () => {
    const fetcher = vi.fn(async () => new Response('ok'));

    await proxyApiRequest(
      new Request('https://anime.significanthobbies.com/api/last-updated'),
      fetcher
    );

    expect(fetcher.mock.calls[0][0].method).toBe('GET');
    expect(await fetcher.mock.calls[0][0].text()).toBe('');
  });
});
