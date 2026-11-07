import { ResourceBoundary } from '@saas-maker/ui/blocks/resource-boundary';
import { EmptyState } from '@saas-maker/ui/components/empty-state';
import { ErrorState } from '@saas-maker/ui/components/error-state';
import { useResourceQuery as useQuery } from '@/lib/use-resource-query';
import StatsCharts from '@/components/StatsCharts';
import { getMangaStats } from '@/lib/api';
import { StatsGridSkeleton } from '@/components/ui/loading-state';

export default function MangaStatsPage() {
  const resource = useQuery({
    queryKey: ['manga', 'stats'],
    queryFn: ({ signal }) => getMangaStats(undefined, signal),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">manga statistics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          manga database distributions and percentiles
        </p>
      </div>

      <ResourceBoundary
        resource={resource}
        delay={0}
        skeleton={<StatsGridSkeleton label="loading manga statistics" />}
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
        {(stats) => <StatsCharts stats={stats} totalLabel="total manga" />}
      </ResourceBoundary>
    </div>
  );
}
