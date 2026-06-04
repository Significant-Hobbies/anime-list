import { Suspense } from "react";
import FilterBuilder from "@/components/FilterBuilder";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ResultsGridSkeleton } from "@/components/ResultsGrid";
import { DEFAULT_ANIME_SEARCH_KEY } from "@/lib/animeSearchDefaults";
import { getInitialAnimeSearch } from "@/lib/animeInitialSearch";
import { SITE_NAME } from "@/lib/brand";

export const metadata = {
  title: `Search anime — ${SITE_NAME}`,
  description:
    "Filter anime by score, year, genre, theme, studio, and members. Combine operators and share your query as a URL.",
};

export default function SearchPage() {
  const initialSearchData = getInitialAnimeSearch();

  return (
    <Suspense fallback={<ResultsGridSkeleton />}>
      <ErrorBoundary>
        <FilterBuilder
          initialSearchData={initialSearchData}
          initialSearchKey={DEFAULT_ANIME_SEARCH_KEY}
        />
      </ErrorBoundary>
    </Suspense>
  );
}
