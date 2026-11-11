export type TimeSortField = 'released_at' | 'created_at';

export const isTimeSortField = (field: string): field is TimeSortField =>
  field === 'released_at' || field === 'created_at';

interface CatalogTimes {
  created_at?: string;
  aired?: { from: string };
  published?: { from: string };
  year?: number;
}

const timestamp = (value: string | undefined): number | undefined => {
  if (!value) return undefined;
  // D1 datetime() values have no zone; they represent UTC, not local time.
  const normalized = value.replace(' ', 'T');
  const utc =
    /T\d{2}:\d{2}/.test(normalized) && !/(Z|[+-]\d{2}:\d{2})$/i.test(normalized)
      ? `${normalized}Z`
      : normalized;
  const parsed = Date.parse(utc);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const getCatalogTime = (item: CatalogTimes, field: TimeSortField): number | undefined => {
  if (field === 'created_at') return timestamp(item.created_at);
  const released = timestamp(item.aired?.from ?? item.published?.from);
  if (released !== undefined) return released;
  return item.year && Number.isInteger(item.year) && item.year > 0 && item.year <= 9999
    ? timestamp(`${String(item.year).padStart(4, '0')}-01-01`)
    : undefined;
};

const timestampSql = (column: string): string =>
  `CAST(ROUND((julianday(${column}) - 2440587.5) * 86400000) AS INTEGER)`;

export const ANIME_TIME_SORT_SQL: Record<TimeSortField, string> = {
  created_at: timestampSql('created_at'),
  released_at: `COALESCE(${timestampSql('aired_from')}, CASE WHEN year BETWEEN 1 AND 9999 THEN ${timestampSql("printf('%04d-01-01', year)")} END)`,
};
