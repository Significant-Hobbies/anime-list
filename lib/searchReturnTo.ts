import { defaultParseSearch, type HistoryState } from '@tanstack/react-router';

const SEARCH_PATH = '/search';
const INTERNAL_ORIGIN = 'https://anime-list.invalid';

export function getAnimeSearchReturnTo(state: unknown): string {
  if (!state || typeof state !== 'object' || !('returnToSearch' in state)) {
    return SEARCH_PATH;
  }

  const candidate = (state as { returnToSearch?: unknown }).returnToSearch;
  if (
    typeof candidate !== 'string' ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('#')
  ) {
    return SEARCH_PATH;
  }

  try {
    const destination = new URL(candidate, INTERNAL_ORIGIN);
    if (destination.origin !== INTERNAL_ORIGIN || destination.pathname !== SEARCH_PATH) {
      return SEARCH_PATH;
    }
    return `${destination.pathname}${destination.search}`;
  } catch {
    return SEARCH_PATH;
  }
}

export function getAnimeSearchReturnToLocation(returnToSearch?: string) {
  const destination = new URL(getAnimeSearchReturnTo({ returnToSearch }), INTERNAL_ORIGIN);
  return {
    to: SEARCH_PATH,
    search: defaultParseSearch(destination.search),
  };
}

export function getAnimeDetailLinkState(previous: object, returnToSearch?: string): HistoryState {
  const { returnToSearch: _previousReturnToSearch, ...state } = previous as Record<string, unknown>;
  return (returnToSearch ? { ...state, returnToSearch } : state) as HistoryState;
}
