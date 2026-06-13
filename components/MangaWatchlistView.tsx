"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import type { EnrichedMangaWatchlistItem } from "@/lib/types";
import {
  addToMangaWatchlist,
  getEnrichedMangaWatchlist,
  getWatchlistTags,
  removeFromMangaWatchlist,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, getMangaDetailHref } from "@/lib/utils";
import { resolveTagColor, toRgba } from "@/lib/watchStatus";

function WatchlistSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-24 rounded-full bg-muted animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export default function MangaWatchlistView() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["manga", "watchlist", "enriched"],
    queryFn: () => getEnrichedMangaWatchlist(),
    enabled: !!user,
  });

  const { data: tagsData } = useQuery({
    queryKey: ["watchlist", "tags"],
    queryFn: () => getWatchlistTags(),
    enabled: !!user,
  });

  const statusMutation = useMutation({
    mutationFn: ({ malId, status, tagColor }: { malId: string; status: string; tagColor?: string }) =>
      addToMangaWatchlist([Number(malId)], status, tagColor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manga", "watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["manga", "watchlist", "enriched"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (malId: string) => removeFromMangaWatchlist([Number(malId)]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manga", "watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["manga", "watchlist", "enriched"] });
    },
  });

  const items: EnrichedMangaWatchlistItem[] = data?.items ?? [];
  const tags = tagsData?.tags ?? [];
  const tagColorMap = useMemo(
    () => new Map(tags.map((tag) => [tag.tag, resolveTagColor(tag.tag, tag.color)])),
    [tags],
  );

  useEffect(() => {
    if (!tags.length) {
      setActiveTab("");
      return;
    }
    if (!activeTab || !tags.some((tag) => tag.tag === activeTab)) {
      setActiveTab(tags[0].tag);
    }
  }, [tags, activeTab]);

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h3 className="text-lg font-medium text-foreground mb-1">Sign in to view your manga list</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Your reading list is personal and synced across devices
        </p>
      </div>
    );
  }

  if (isLoading) return <WatchlistSkeleton />;
  if (error) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-destructive text-sm">
          We couldn&apos;t load your manga list. Check your connection and try again.
        </p>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="px-3 py-1.5 text-sm rounded border hover:opacity-80 disabled:opacity-50"
        >
          {isFetching ? "Retrying…" : "Try again"}
        </button>
      </div>
    );
  }

  const filtered = activeTab
    ? items.filter((item) => item.watchStatus === activeTab)
    : items;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Manga Watchlist</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track what you&apos;re reading across {items.length.toLocaleString()} saved titles
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tags.map((tag) => {
          const isActive = activeTab === tag.tag;
          const color = resolveTagColor(tag.tag, tag.color);
          return (
            <button
              key={tag.id}
              onClick={() => setActiveTab(tag.tag)}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-200",
                isActive ? "" : "text-muted-foreground hover:text-foreground",
              )}
              style={
                isActive
                  ? {
                      color,
                      borderColor: toRgba(color, 0.45),
                      backgroundColor: toRgba(color, 0.15),
                    }
                  : {
                      color,
                      borderColor: toRgba(color, 0.3),
                    }
              }
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              {tag.tag}
            </button>
          );
        })}
        {tags.length === 0 && (
          <span className="text-sm text-muted-foreground">Add manga from Discover to build your list</span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {activeTab ? `No manga with tag "${activeTab}"` : "No manga in your list yet"}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((item) => (
            <Card key={item.mal_id} className="overflow-hidden flex flex-row p-0 hover:border-primary/30 transition-colors">
              {item.image ? (
                <Link
                  href={getMangaDetailHref(item.mal_id)}
                  className="relative block w-[85px] min-h-[120px] shrink-0"
                >
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="85px"
                  />
                </Link>
              ) : (
                <div className="w-[85px] min-h-[120px] shrink-0 bg-muted" />
              )}

              <div className="flex-1 p-3 space-y-2 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={getMangaDetailHref(item.mal_id)}
                    className="font-medium text-foreground hover:text-primary truncate"
                  >
                    {item.title}
                  </Link>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary shrink-0"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {item.score ? <span>{item.score.toFixed(2)}</span> : null}
                  {item.year ? <span>{item.year}</span> : null}
                  {item.type ? <span>{item.type}</span> : null}
                  {item.chapters ? <span>{item.chapters} ch</span> : null}
                </div>

                <div className="flex flex-wrap gap-1">
                  {item.genres.slice(0, 3).map((genre) => (
                    <Badge key={genre} variant="secondary" className="text-[10px] font-normal">
                      {genre}
                    </Badge>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge
                    variant="outline"
                    style={{
                      borderColor: tagColorMap.get(item.watchStatus),
                      color: tagColorMap.get(item.watchStatus),
                    }}
                  >
                    {item.watchStatus}
                  </Badge>
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() =>
                        statusMutation.mutate({
                          malId: item.mal_id,
                          status: tag.tag,
                          tagColor: tag.color,
                        })
                      }
                      disabled={statusMutation.isPending || item.watchStatus === tag.tag}
                      className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary disabled:opacity-40"
                    >
                      {tag.tag}
                    </button>
                  ))}
                  <button
                    onClick={() => removeMutation.mutate(item.mal_id)}
                    disabled={removeMutation.isPending}
                    className="text-[10px] uppercase tracking-wider text-destructive hover:underline disabled:opacity-40 ml-auto"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
