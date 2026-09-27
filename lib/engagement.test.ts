import { afterEach, describe, expect, it, vi } from 'vitest';

const { trackEvent } = vi.hoisted(() => ({ trackEvent: vi.fn() }));

vi.mock('@/lib/analytics', () => ({ trackEvent }));
vi.mock('@/lib/flags', () => ({ homeVariant: () => 'control' }));

import { trackHomeSurfaceClick } from './engagement';

describe('homepage App Health events', () => {
  afterEach(() => {
    delete window.appHealth;
    vi.clearAllMocks();
  });

  it('tracks search, discover, and stats CTA choices without properties', () => {
    const track = vi.fn();
    window.appHealth = { track };

    trackHomeSurfaceClick('search', 'hero');
    trackHomeSurfaceClick('discover', 'hero');
    trackHomeSurfaceClick('stats', 'card');

    expect(track.mock.calls).toEqual([['cta_search'], ['cta_discover'], ['cta_stats']]);
  });

  it('keeps the analytics click working when App Health is unavailable', () => {
    expect(() => trackHomeSurfaceClick('quiz', 'hero')).not.toThrow();
    expect(trackEvent).toHaveBeenCalledOnce();
  });
});
