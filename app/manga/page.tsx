import { Suspense } from "react";
import MangaFilterBuilder from "@/components/MangaFilterBuilder";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MangaResultsGridSkeleton } from "@/components/MangaResultsGrid";

export default function MangaSearchPage() {
  return (
    <Suspense fallback={<MangaResultsGridSkeleton />}>
      <ErrorBoundary>
        <MangaFilterBuilder />
      </ErrorBoundary>
    </Suspense>
  );
}
