const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isWriteFrozenRequest(method: string, writeFreeze?: string): boolean {
  return writeFreeze === 'true' && !SAFE_METHODS.has(method.toUpperCase());
}
