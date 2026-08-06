import { describe, expect, it } from 'vitest';
import { assertCatalogRowsFetched } from './api';

describe('assertCatalogRowsFetched', () => {
  it('rejects an empty anime refresh', () => {
    expect(() => assertCatalogRowsFetched('anime', 0)).toThrow(
      'Jikan returned no usable anime rows'
    );
  });

  it('rejects an empty manga refresh', () => {
    expect(() => assertCatalogRowsFetched('manga', 0)).toThrow(
      'Jikan returned no usable manga rows'
    );
  });

  it('accepts a non-empty refresh', () => {
    expect(() => assertCatalogRowsFetched('anime', 1)).not.toThrow();
  });
});
