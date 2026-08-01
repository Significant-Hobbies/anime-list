import {
  ApiError,
  CATALOG_UNAVAILABLE_CODE,
  CATALOG_UNAVAILABLE_MESSAGE,
  catalogErrorMessage,
  isCatalogDatabaseError,
} from '../apiErrors';

describe('catalog API errors', () => {
  it('recognizes D1 errors without classifying unrelated failures', () => {
    expect(isCatalogDatabaseError(new Error('D1_ERROR: database unavailable'))).toBe(true);
    expect(isCatalogDatabaseError(new Error('D1_EXEC_ERROR: query failed'))).toBe(true);
    expect(isCatalogDatabaseError(new Error('database timed out'))).toBe(false);
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
