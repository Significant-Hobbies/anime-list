"use client";

import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getDiscoveryQueue,
  dismissDiscoveryItems,
  addToWatchlist,
  addToMangaWatchlist,
  getWatchlistTags,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { DiscoveryQueueResponse } from "@/lib/types";
import GoogleSignInButton from "./GoogleSignInButton";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

type DiscoveryItem = DiscoveryQueueResponse["results"][number];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function MediaBadge({ mediaType }: { mediaType?: "anime" | "manga" }) {
  if (!mediaType) return null;
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${
      mediaType === "manga"
        ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
        : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
    }`}>
      {mediaType}
    </span>
  );
}

interface DiscoveryCardProps {
  item: DiscoveryItem;
  onDismiss: (malId: number, mediaType?: "anime" | "manga") => void;
  onAdd: (malId: number, status: string, mediaType?: "anime" | "manga") => void;
  onSkip: () => void;
  isPending: boolean;
}

function DiscoveryCard({ item, onDismiss, onAdd, onSkip, isPending }: DiscoveryCardProps) {
  const [selectedStatus, setSelectedStatus] = useState("Watching");
  const { data: tagsData } = useQuery({
    queryKey: ["watchlist", "tags"],
    queryFn: getWatchlistTags,
  });

  const availableTags = useMemo(
    () => tagsData?.tags?.map(t => t.tag) || ["Watching", "Completed", "Deferred", "Avoiding", "BRR"],
    [tagsData],
  );

  const isManga = item.mediaType === "manga";
  const detailHref = isManga ? `/manga/${item.mal_id}` : `/anime/${item.mal_id}`;
  const displayTitle = item.title_english || item.title;
  const hasReasons = item.reasons && item.reasons.length > 0;
  const statusLabel = item.status ? capitalize(item.status) : null;

  return (
    <div className="max-w-sm mx-auto bg-card border border-border rounded-xl shadow-lg overflow-hidden md:max-w-2xl animate-in fade-in">
      <div className="md:flex">
        <div className="md:shrink-0 relative">
          {item.image ? (
            <img
              className="h-72 w-full object-cover md:h-full md:w-48"
              src={item.image}
              alt={displayTitle}
            />
          ) : (
            <div className="h-72 w-full md:h-full md:w-48 bg-muted flex items-center justify-center text-muted-foreground text-sm">
              No image
            </div>
          )}
        </div>
        <div className="p-6 flex flex-col gap-3 flex-1">
          {/* Header row */}
          <div className="flex items-center gap-2 flex-wrap">
            <MediaBadge mediaType={item.mediaType} />
            <span className="text-xs text-primary font-medium uppercase tracking-wide">
              {[item.year, item.season ? capitalize(item.season) : null].filter(Boolean).join(" ")}
            </span>
            {statusLabel && (
              <span className="text-xs text-muted-foreground">· {statusLabel}</span>
            )}
            {item.score != null && (
              <span className="ml-auto text-xs font-semibold text-muted-foreground tabular-nums">
                ★ {item.score.toFixed(1)}
              </span>
            )}
          </div>

          {/* Title */}
          <a
            href={detailHref}
            className="text-lg leading-tight font-semibold text-foreground hover:underline line-clamp-2"
          >
            {displayTitle}
          </a>

          {/* Synopsis */}
          {item.synopsis && (
            <p className="text-muted-foreground text-sm line-clamp-3">{item.synopsis}</p>
          )}

          {/* Genres */}
          <div className="flex flex-wrap gap-1.5">
            {item.genres.slice(0, 4).map(genre => (
              <span key={genre} className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full">
                {genre}
              </span>
            ))}
          </div>

          {/* Taste match reasons */}
          {hasReasons && (
            <p className="text-xs text-green-600 dark:text-green-400">
              Matches your taste · {item.reasons!.join(", ")}
            </p>
          )}

          {/* Actions */}
          <div className="mt-auto space-y-2 pt-1">
            <div className="flex gap-2">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="flex-1 min-w-0">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {availableTags.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => onAdd(item.mal_id, selectedStatus, item.mediaType)}
                disabled={isPending}
              >
                Add to List
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onDismiss(item.mal_id, item.mediaType)}
                className="flex-1"
                disabled={isPending}
              >
                Dismiss
              </Button>
              <Button variant="ghost" onClick={onSkip} className="flex-1">
                Skip
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DiscoveryQueue() {
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["discoveryQueue"],
    queryFn: () => getDiscoveryQueue(50),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const nextItem = () => {
    if (data && currentIndex < data.results.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      refetch();
      setCurrentIndex(0);
    }
  };

  const dismissMutation = useMutation({
    mutationFn: ({ malId, mediaType }: { malId: number; mediaType?: "anime" | "manga" }) => {
      // Manga dismissals are not persisted; just advance in the client queue
      if (mediaType === "manga") return Promise.resolve({ success: true, message: "skipped" });
      return dismissDiscoveryItems([malId]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discoveryQueue"] });
      nextItem();
    },
  });

  const addMutation = useMutation({
    mutationFn: ({ malId, status, mediaType }: { malId: number; status: string; mediaType?: "anime" | "manga" }) =>
      mediaType === "manga"
        ? addToMangaWatchlist([malId], status)
        : addToWatchlist([malId], status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["discoveryQueue"] });
      if (variables.mediaType !== "manga") {
        queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["manga", "watchlist"] });
        queryClient.invalidateQueries({ queryKey: ["manga", "watchlist", "enriched"] });
      }
      nextItem();
    },
  });

  const handleDismiss = (malId: number, mediaType?: "anime" | "manga") => {
    dismissMutation.mutate({ malId, mediaType });
  };

  const handleAdd = (malId: number, status: string, mediaType?: "anime" | "manga") => {
    addMutation.mutate({ malId, status, mediaType });
  };

  const isPending = dismissMutation.isPending || addMutation.isPending;

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <div className="mx-auto flex max-w-lg flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-12 text-center shadow-sm">
          <h1 className="text-3xl font-bold">Weekly Discovery</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Sign in to get a seasonal anime and manga queue ranked against your
            watchlist. Search stays public; discovery needs your taste history.
          </p>
          <div className="mt-6">
            <GoogleSignInButton />
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold text-center mb-8">Weekly Discovery</h1>
        <div className="text-center p-8 text-muted-foreground">Finding shows for you…</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold text-center mb-8">Weekly Discovery</h1>
        <div className="text-center p-8 text-destructive">
          Could not load the discovery queue. Please try again later.
        </div>
      </div>
    );
  }

  const results = data?.results ?? [];
  const meta = data?.meta;
  const currentItem = results[currentIndex];

  const seasonLabel = meta
    ? `${capitalize(meta.currentSeason)} ${meta.currentYear}`
    : null;

  const animeCount = results.filter(r => r.mediaType === "anime" || !r.mediaType).length;
  const mangaCount = results.filter(r => r.mediaType === "manga").length;

  if (results.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold text-center mb-8">Weekly Discovery</h1>
        <div className="text-center p-8 text-muted-foreground">
          Nothing new to show right now — check back later!
        </div>
      </div>
    );
  }

  if (!currentItem) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold text-center mb-8">Weekly Discovery</h1>
        <div className="text-center p-8 text-muted-foreground">
          You've worked through this batch.{" "}
          <button
            onClick={() => { refetch(); setCurrentIndex(0); }}
            className="underline text-primary"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold">Weekly Discovery</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {seasonLabel && <span>{seasonLabel} · </span>}
          {animeCount} anime · {mangaCount} manga · item {currentIndex + 1} of {results.length}
        </p>
      </div>
      <DiscoveryCard
        item={currentItem}
        onDismiss={handleDismiss}
        onAdd={handleAdd}
        onSkip={nextItem}
        isPending={isPending}
      />
    </div>
  );
}
