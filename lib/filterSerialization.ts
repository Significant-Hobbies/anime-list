import type { SearchFilter } from './types';

export function serializeFilters(value: SearchFilter[]): string {
  return JSON.stringify({ f: value });
}
