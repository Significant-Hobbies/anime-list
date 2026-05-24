"use client";

import type { SearchResponse } from "@/lib/types";
import AnimeCard from "./AnimeCard";

function CardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-surface-container-high via-surface-container to-surface-container-low">
        <div className="absolute left-3 top-3 h-6 w-10 rounded-md bg-white/10" />
        <div className="absolute inset-x-3 bottom-3 space-y-2">
          <div className="h-2 rounded-full bg-white/10" />
          <div className="h-2 w-2/3 rounded-full bg-white/5" />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-4 bg-white/10 rounded-sm w-3/4" />
        <div className="h-3 bg-white/5 rounded-sm w-1/2" />
      </div>
    </div>
  );
}

export function ResultsGridSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card/45 p-4 md:p-5">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Building your shelf</p>
          <h2 className="mt-1 text-xl font-semibold text-foreground">Finding strong matches</h2>
        </div>
        <p className="max-w-sm text-sm text-muted-foreground">
          Loading posters, scores, genres, and popularity signals.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
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
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/20 py-24 text-center">
          <p className="text-lg font-medium text-foreground">No titles match</p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Try clearing a filter, lowering the popularity threshold, or searching with a different title.
          </p>
        </div>
      )}
    </div>
  );
}
