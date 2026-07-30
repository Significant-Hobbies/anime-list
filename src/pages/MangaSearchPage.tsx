import { Suspense } from 'react';
import MangaFilterBuilder from '@/components/MangaFilterBuilder';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MangaResultsGridSkeleton } from '@/components/MangaResultsGrid';

export default function MangaSearchPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Browse manga</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Filter the manga catalog by title, genre, popularity, and format.
        </p>
      </header>
      <Suspense fallback={<MangaResultsGridSkeleton />}>
        <ErrorBoundary>
          <MangaFilterBuilder />
        </ErrorBoundary>
      </Suspense>
    </div>
  );
}
