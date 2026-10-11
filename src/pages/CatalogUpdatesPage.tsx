import { ResourceBoundary } from '@saas-maker/ui/blocks/resource-boundary';
import { ErrorState } from '@saas-maker/ui/components/error-state';
import { EmptyState } from '@saas-maker/ui/components/empty-state';
import { Link } from '@tanstack/react-router';
import { useResourceQuery as useQuery } from '@/lib/use-resource-query';
import { getChangelog } from '@/lib/api';
import type { ChangelogEntry } from '@/lib/api';
import { ListSkeleton, RefreshIndicator } from '@/components/ui/loading-state';

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
  const resource = useQuery({
    queryKey: ['changelog'],
    queryFn: ({ signal }) => getChangelog(200, signal),
    placeholderData: (previous) => previous,
  });
  const { data, isLoading, isError, refetch, isFetching } = resource;

  const grouped = data ? groupByDate(data.changes) : {};
  const dates = Object.keys(grouped);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Catalog updates</h1>
        <p className="text-sm text-muted-foreground mt-1">Recently added anime to the database</p>
      </div>

      <RefreshIndicator active={isFetching && !!data} label="Updating catalog history" />

      <ResourceBoundary
        resource={resource}
        delay={0}
        skeleton={<ListSkeleton label="loading catalog history" rows={4} />}
        error={
          <ErrorState
            title="could not load the changelog"
            onRetry={() => {
              void refetch();
            }}
          />
        }
      >
        {isLoading ? (
          <ListSkeleton label="Loading catalog history" rows={4} />
        ) : isError && !data ? (
          <ErrorState
            title="could not load the changelog"
            onRetry={() => {
              void refetch();
            }}
          />
        ) : dates.length === 0 ? (
          <EmptyState title="no changes recorded yet" />
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
      </ResourceBoundary>
    </div>
  );
}
