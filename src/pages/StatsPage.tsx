import { ResourceBoundary } from '@saas-maker/ui/blocks/resource-boundary';
import { EmptyState } from '@saas-maker/ui/components/empty-state';
import { ErrorState } from '@saas-maker/ui/components/error-state';
import { useState } from 'react';
import { useResourceQuery as useQuery } from '@/lib/use-resource-query';
import StatsCharts from '@/components/StatsCharts';
import { getStats, getWatchlistTags } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { resolveTagColor, toRgba } from '@/lib/watchStatus';
import { StatsGridSkeleton } from '@/components/ui/loading-state';

export default function StatsPage() {
  const { user, loading: authLoading } = useAuth();
  const [includeStatuses, setIncludeStatuses] = useState<string[]>([]);

  const { data: tagsData } = useQuery({
    queryKey: ['watchlist', 'tags'],
    queryFn: ({ signal }) => getWatchlistTags(signal),
    enabled: !!user,
  });

  const availableTags = tagsData?.tags ?? [];

  const resource = useQuery({
    queryKey: ['stats', includeStatuses],
    queryFn: ({ signal }) =>
      getStats(
        {
          includeWatched: includeStatuses,
        },
        signal
      ),
    placeholderData: (previous) => previous,
  });

  const toggleIncludeStatus = (status: string) => {
    setIncludeStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">statistics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          anime database distributions and percentiles
        </p>
      </div>

      {!authLoading && user && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Include only from:</span>
          {availableTags.map((tag) => {
            const active = includeStatuses.includes(tag.tag);
            const color = resolveTagColor(tag.tag, tag.color);
            return (
              <button
                key={tag.tag}
                onClick={() => toggleIncludeStatus(tag.tag)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-full border transition-all duration-200',
                  active ? '' : 'text-muted-foreground hover:text-foreground'
                )}
                style={
                  active
                    ? {
                        color,
                        borderColor: toRgba(color, 0.45),
                        backgroundColor: toRgba(color, 0.15),
                      }
                    : {
                        color,
                        borderColor: toRgba(color, 0.3),
                      }
                }
              >
                {tag.tag}
              </button>
            );
          })}
          {availableTags.length === 0 && (
            <span className="text-xs text-muted-foreground">No tags yet</span>
          )}
          {includeStatuses.length > 0 && (
            <button
              onClick={() => setIncludeStatuses([])}
              className="text-xs px-2.5 py-1 rounded-full text-muted-foreground hover:text-destructive transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <ResourceBoundary
        resource={resource}
        delay={0}
        skeleton={<StatsGridSkeleton label="loading anime statistics" />}
        error={
          <ErrorState
            title="could not load statistics"
            description="check your connection and try again."
            onRetry={() => {
              void resource.retry();
            }}
          />
        }
        empty={<EmptyState title="no statistics available" />}
      >
        {(stats) => <StatsCharts stats={stats} totalLabel="total anime" />}
      </ResourceBoundary>
    </div>
  );
}
