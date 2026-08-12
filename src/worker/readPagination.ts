export const READ_PAGE_MAX = 50;

export interface ReadPage {
  limit: number;
  offset: number;
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, minimum), maximum) : fallback;
}

export function boundedReadPage(limit: string | undefined, offset: string | undefined): ReadPage {
  return {
    limit: boundedInteger(limit, READ_PAGE_MAX, 1, READ_PAGE_MAX),
    offset: boundedInteger(offset, 0, 0, 1_000_000),
  };
}

export function pageReadItems<T>(items: readonly T[], page: ReadPage) {
  const selected = items.slice(page.offset, page.offset + page.limit);
  const nextOffset =
    page.offset + selected.length < items.length ? page.offset + selected.length : null;
  return {
    items: selected,
    total: items.length,
    nextOffset,
    hasMore: nextOffset !== null,
  };
}

export function compareWatchlistIds(
  left: { id?: string | number; mal_id?: string | number },
  right: { id?: string | number; mal_id?: string | number }
) {
  const leftId = String(left.mal_id ?? left.id ?? '');
  const rightId = String(right.mal_id ?? right.id ?? '');
  const leftNumber = Number(leftId);
  const rightNumber = Number(rightId);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }
  return leftId.localeCompare(rightId);
}
