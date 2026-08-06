import { useQuery } from '@tanstack/react-query';
import StatsCharts from '@/components/StatsCharts';
import { getMangaStats } from '@/lib/api';
import { RefreshIndicator, StatsGridSkeleton } from '@/components/ui/loading-state';

export default function MangaStatsPage() {
  const {
    data: stats,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['manga', 'stats'],
    queryFn: () => getMangaStats(),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Manga Statistics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manga database distributions and percentiles
        </p>
      </div>

      <RefreshIndicator active={isFetching && !!stats} label="Updating manga statistics" />

      {isLoading ? (
        <StatsGridSkeleton label="Loading manga statistics" />
      ) : error ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-destructive text-sm">
            We couldn&apos;t load manga statistics. Run{' '}
            <code className="text-xs">pnpm db:seed:manga</code> if the catalog is empty.
          </p>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-3 py-1.5 text-sm rounded border hover:opacity-80 disabled:opacity-50"
          >
            {isFetching ? 'Retrying…' : 'Try again'}
          </button>
        </div>
      ) : stats ? (
        <StatsCharts stats={stats} totalLabel="Total manga" />
      ) : (
        <p className="text-muted-foreground">Unable to load manga statistics.</p>
      )}
    </div>
  );
}
