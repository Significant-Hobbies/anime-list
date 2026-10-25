import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackDiscoveryEvent } from './analytics';

describe('discovery measurement events', () => {
  afterEach(() => {
    delete window.appHealth;
  });

  it.each([
    'discovery.list_filter_changed',
    'discovery.choice_selected',
    'discovery.back',
  ] as const)('sends only the fixed %s event name to App Health', (event) => {
    const track = vi.fn();
    window.appHealth = { track };

    trackDiscoveryEvent(event);

    expect(track.mock.calls).toEqual([[event]]);
  });

  it('keeps the product flow working when App Health is absent or throws', () => {
    expect(() => trackDiscoveryEvent('discovery.back')).not.toThrow();
    window.appHealth = {
      track: () => {
        throw new Error('tracker unavailable');
      },
    };
    expect(() => trackDiscoveryEvent('discovery.back')).not.toThrow();
  });
});
