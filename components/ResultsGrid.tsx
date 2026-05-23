"use client";

import type { SearchResponse } from "@/lib/types";
import AnimeCard from "./AnimeCard";

function CardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[2/3] rounded-sm bg-surface-container-high" />
      <div className="mt-3 space-y-2">
        <div className="h-4 bg-white/10 rounded-sm w-3/4" />
        <div className="h-3 bg-white/5 rounded-sm w-1/2" />
      </div>
    </div>
  );
}

export function ResultsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-10">
      {Array.from({ length: 12 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export default function ResultsGrid({ results }: { results: SearchResponse }) {
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
          {results.filteredList.map((anime, index) => (
            <AnimeCard key={anime.id} anime={anime} priority={index < 4} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-32 text-center bg-surface-container-low border border-outline/10 rounded-sm">
          <div className="h-16 w-16 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
            <span className="text-primary text-2xl font-black italic">!</span>
          </div>
          <h3 className="text-xl font-display font-black uppercase italic text-white mb-2 tracking-tight">
            Signal Lost
          </h3>
          <p className="text-[10px] font-bold tracking-[0.2em] text-white/30 uppercase max-w-xs leading-loose">
            No entries matching your frequency. Adjust filters to re-establish connection.
          </p>
        </div>
      )}
    </div>
  );
}