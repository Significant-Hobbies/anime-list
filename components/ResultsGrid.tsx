'use client';

import { EmptyState } from '@saas-maker/ui/components/empty-state';

import type { SearchResponse } from '@/lib/types';
import AnimeCard from './AnimeCard';
import { CatalogGridSkeleton } from './ui/loading-state';

export function ResultsGridSkeleton() {
  return <CatalogGridSkeleton label="Loading anime results" />;
}

export default function ResultsGrid({ results }: { results: SearchResponse }) {
  return (
    <div className="space-y-6">
      {results.filteredList.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-10">
          {results.filteredList.map((anime, index) => (
            <AnimeCard key={anime.id} anime={anime} priority={index < 4} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="no titles match"
          description="try clearing a filter, lowering the popularity threshold, or searching with a different title."
          className="rounded-xl border border-border bg-muted/20 py-24"
        />
      )}
    </div>
  );
}
