import { useResource } from '@saas-maker/ui/lib/use-resource';
import { ResourceBoundary } from '@saas-maker/ui/blocks/resource-boundary';
import { EmptyState } from '@saas-maker/ui/components/empty-state';
import { ErrorState } from '@saas-maker/ui/components/error-state';
import { useEffect, useId } from 'react';
import { getRandomAnimePick } from '@/lib/api';
import { CatalogGridSkeleton } from './ui/loading-state';

export default function RandomAnimeRedirect({ genre }: { genre?: string }) {
  // A new visit means a new random pick, while concurrent reads still dedupe.
  const visit = useId();
  const resource = useResource(
    `random:${genre ?? 'all'}:${visit}`,
    (signal) => getRandomAnimePick({ genre, limit: 1 }, signal),
    {
      isEmpty: (data) => data.results.length === 0,
    }
  );
  const pick = resource.data?.results[0];
  const id = pick?.mal_id ?? pick?.id;
  useEffect(() => {
    if (id != null) window.location.replace(`/anime/${id}`);
  }, [id]);
  return (
    <ResourceBoundary
      resource={resource}
      delay={0}
      skeleton={<CatalogGridSkeleton label="picking a random anime" />}
      empty={
        <EmptyState
          title={
            genre
              ? `no anime found in ${decodeURIComponent(genre)}.`
              : 'no anime available right now.'
          }
        />
      }
      error={
        <ErrorState
          title="could not reach the catalog"
          onRetry={() => {
            void resource.retry();
          }}
        />
      }
    >
      <CatalogGridSkeleton label="opening anime details" />
    </ResourceBoundary>
  );
}
