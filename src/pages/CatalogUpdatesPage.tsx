import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getChangelog } from '@/lib/api';
import type { ChangelogEntry } from '@/lib/api';

const TYPE_COLORS: Record<string, string> = {
  TV: 'bg-blue-500/15 text-blue-400',
  Movie: 'bg-purple-500/15 text-purple-400',
  OVA: 'bg-amber-500/15 text-amber-400',
  ONA: 'bg-emerald-500/15 text-emerald-400',
  Special: 'bg-pink-500/15 text-pink-400',
  Music: 'bg-cyan-500/15 text-cyan-400',
};

function groupByDate(changes: ChangelogEntry[]): Record<string, ChangelogEntry[]> {
  const grouped: Record<string, ChangelogEntry[]> = {};
  for (const entry of changes) {
    if (!grouped[entry.date]) grouped[entry.date] = [];
    grouped[entry.date].push(entry);
  }
  return grouped;
}

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function CatalogUpdatesPage() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['changelog'],
    queryFn: () => getChangelog(200),
  });

  const grouped = data ? groupByDate(data.changes) : {};
  const dates = Object.keys(grouped);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Catalog updates</h1>
        <p className="text-sm text-muted-foreground mt-1">Recently added anime to the database</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card/50 p-4 space-y-3 animate-pulse"
            >
              <div className="h-4 w-40 bg-muted rounded" />
              <div className="space-y-2">
                <div className="h-3 w-full bg-muted rounded" />
                <div className="h-3 w-3/4 bg-muted rounded" />
                <div className="h-3 w-1/2 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load the changelog. Please try again.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-sm font-medium text-primary hover:underline disabled:opacity-60"
          >
            {isFetching ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      ) : dates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
      ) : (
        <div className="space-y-4">
          {dates.map((date) => (
            <div key={date} className="rounded-xl border border-border bg-card/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">{formatDate(date)}</h2>
                <span className="text-xs text-muted-foreground">
                  {grouped[date].length} title{grouped[date].length !== 1 ? 's' : ''}
                </span>
              </div>
              <ul className="space-y-1.5">
                {grouped[date].map((entry) => (
                  <li key={entry.mal_id} className="flex items-center gap-2 text-sm">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                      Added
                    </span>
                    {entry.type && (
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${TYPE_COLORS[entry.type] || 'bg-muted text-muted-foreground'}`}
                      >
                        {entry.type}
                      </span>
                    )}
                    <Link
                      to="/anime/$malId"
                      params={{ malId: String(entry.mal_id) }}
                      className="text-foreground hover:text-primary transition-colors truncate"
                    >
                      {entry.title_english || entry.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
