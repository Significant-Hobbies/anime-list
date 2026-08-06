import { afterEach, describe, expect, it, vi } from 'vitest';
import { getApiUrl, LOCAL_API_URL, PRODUCTION_API_URL, SAME_ORIGIN_API_URL } from '../apiConfig';

describe('getApiUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses configured deployment API URL when present', () => {
    vi.stubEnv('VITE_API_URL', `${PRODUCTION_API_URL}/`);

    expect(getApiUrl('anime-list-9lk.pages.dev')).toBe(PRODUCTION_API_URL);
  });

  it('uses the same origin on deployed hosts', () => {
    vi.stubEnv('VITE_API_URL', '');

    expect(getApiUrl('anime-list-9lk.pages.dev')).toBe(SAME_ORIGIN_API_URL);
  });

  it('uses localhost only for local browser development', () => {
    vi.stubEnv('VITE_API_URL', '');
    vi.stubEnv('DEV', true);
    vi.stubEnv('PROD', false);

    expect(getApiUrl('localhost')).toBe(LOCAL_API_URL);
  });

  it('uses the same origin for a production build served locally', () => {
    vi.stubEnv('VITE_API_URL', '');
    vi.stubEnv('DEV', false);
    vi.stubEnv('PROD', true);

    expect(getApiUrl('localhost')).toBe(SAME_ORIGIN_API_URL);
  });
});
