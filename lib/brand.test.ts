import { describe, expect, it } from 'vitest';
import { PRODUCT_NAME, PUBLISHER_NAME, SITE_ATTRIBUTION, SITE_NAME } from './brand';

describe('brand', () => {
  it('exposes a full name and separate parts for typographic hierarchy', () => {
    expect(PRODUCT_NAME).toBe('Anime List');
    expect(PUBLISHER_NAME).toBe('Significant Hobbies');
    expect(SITE_NAME).toBe('Anime List');
    expect(SITE_ATTRIBUTION).toBe('A Significant Hobbies project');
  });
});
