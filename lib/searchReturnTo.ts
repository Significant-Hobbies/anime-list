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
