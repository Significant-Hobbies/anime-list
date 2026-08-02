export const CATALOG_UNAVAILABLE_CODE = 'catalog_unavailable';
export const CATALOG_UNAVAILABLE_MESSAGE =
  'The catalog is temporarily unavailable while data access recovers.';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isCatalogDatabaseError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /^D1_(?:ERROR|EXEC_ERROR|TYPE_ERROR|COLUMN_NOTFOUND):/.test(error.message)
  );
}

export function catalogErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.code === CATALOG_UNAVAILABLE_CODE
    ? CATALOG_UNAVAILABLE_MESSAGE
    : fallback;
}
