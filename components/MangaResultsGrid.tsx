"use client";

import type { SearchResponse } from "@/lib/types";
import MangaCard from "./MangaCard";

export function MangaResultsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-10">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="animate-pulse aspect-[2/3] rounded-sm bg-surface-container-high" />
      ))}
    </div>
  );
}

export default function MangaResultsGrid({ results }: { results: SearchResponse }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <h2 className="font-semibold text-xl text-foreground">Results</h2>
        <p className="text-sm text-muted-foreground">
          {results.totalFiltered.toLocaleString()} titles
        </p>
      </div>

      {results.filteredList.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-10">
          {results.filteredList.map((item, index) => (
            <MangaCard key={item.id} manga={item} priority={index < 4} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-32 text-center bg-surface-container-low border border-outline/10 rounded-sm">
          <p className="text-sm text-muted-foreground">No manga matched your filters.</p>
        </div>
      )}
    </div>
  );
}
