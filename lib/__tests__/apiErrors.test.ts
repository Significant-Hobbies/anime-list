import {
  ApiError,
  CATALOG_UNAVAILABLE_CODE,
  CATALOG_UNAVAILABLE_MESSAGE,
  catalogErrorMessage,
  isCatalogReadBlockedError,
} from '../apiErrors';

describe('catalog API errors', () => {
  it('recognizes the Turso read-block response without classifying unrelated failures', () => {
    expect(
      isCatalogReadBlockedError(
        new Error(
          'BLOCKED: Operation was blocked: SQL read operations are forbidden (reads are blocked, do you need to upgrade your plan?)'
        )
      )
    ).toBe(true);
    expect(isCatalogReadBlockedError(new Error('database timed out'))).toBe(false);
  });

  it('shows the curated catalog message only for the known error code', () => {
    expect(
      catalogErrorMessage(
        new ApiError(CATALOG_UNAVAILABLE_MESSAGE, 503, CATALOG_UNAVAILABLE_CODE),
        'fallback'
      )
    ).toBe(CATALOG_UNAVAILABLE_MESSAGE);
    expect(catalogErrorMessage(new ApiError('other', 500), 'fallback')).toBe('fallback');
  });
});
