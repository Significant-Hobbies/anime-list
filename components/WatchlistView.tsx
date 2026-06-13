"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import type { EnrichedWatchlistItem } from "@/lib/types";
import {
  addToWatchlist,
  deleteWatchlistTag,
  applyWatchlistImport,
  exportAniListWatchlist,
  getEnrichedWatchlist,
  getTasteRecommendations,
  getWatchlistTags,
  previewWatchlistImport,
  removeFromWatchlist,
  saveWatchlistTag,
  updateWatchlistTag,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, getAnimeDetailHref } from "@/lib/utils";
import { getDefaultTagColor, resolveTagColor, toRgba } from "@/lib/watchStatus";

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

export default function WatchlistView() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("");
  const [showListSettings, setShowListSettings] = useState(false);
  const [showSyncTools, setShowSyncTools] = useState(false);
  const [syncSource, setSyncSource] = useState<"mal" | "anilist">("mal");
  const [syncPayload, setSyncPayload] = useState("");
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#10b981");
  const [tagDrafts, setTagDrafts] = useState<Record<string, { tag: string; color: string }>>({});
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["watchlist", "enriched"],
    queryFn: () => getEnrichedWatchlist(),
    enabled: !!user,
  });

  const { data: tagsData } = useQuery({
    queryKey: ["watchlist", "tags"],
    queryFn: () => getWatchlistTags(),
    enabled: !!user,
  });

  const { data: recommendationsData } = useQuery({
    queryKey: ["watchlist", "recommendations"],
    queryFn: () => getTasteRecommendations(),
    enabled: !!user,
  });

  const statusMutation = useMutation({
    mutationFn: ({ malId, status, tagColor }: { malId: string; status: string; tagColor?: string }) =>
      addToWatchlist([Number(malId)], status, tagColor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist", "tags"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist", "recommendations"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (malId: string) =>
      removeFromWatchlist([Number(malId)]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist", "tags"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist", "recommendations"] });
    },
  });

  const createTagMutation = useMutation({
    mutationFn: ({ tag, color }: { tag: string; color?: string }) =>
      saveWatchlistTag(tag, color),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist", "tags"] });
    },
  });

  const updateTagMutation = useMutation({
    mutationFn: ({ tagId, tag, color }: { tagId: string; tag?: string; color?: string }) =>
      updateWatchlistTag(tagId, { tag, color }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist", "tags"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist", "recommendations"] });
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: ({ tagId }: { tagId: string }) =>
      deleteWatchlistTag(tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist", "tags"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist", "recommendations"] });
    },
  });

  const previewImportMutation = useMutation({
    mutationFn: () => previewWatchlistImport(syncSource, syncPayload),
    onSuccess: (result) => {
      setSyncResult(
        `Preview: ${result.entries.length} importable, ${result.skipped} skipped. ${Object.entries(result.statusCounts)
          .map(([status, count]) => `${status}: ${count}`)
          .join(" · ")}`,
      );
    },
  });

  const applyImportMutation = useMutation({
    mutationFn: () => applyWatchlistImport(syncSource, syncPayload),
    onSuccess: (result) => {
      setSyncResult(`Imported ${result.imported ?? result.entries.length} items from ${result.source}.`);
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist", "tags"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist", "recommendations"] });
    },
  });

  const exportMutation = useMutation({
    mutationFn: () => exportAniListWatchlist(),
    onSuccess: async (result) => {
      const text = JSON.stringify(result.entries, null, 2);
      await navigator.clipboard?.writeText(text);
      setSyncResult(`Copied ${result.entries.length} AniList export rows to clipboard.`);
    },
  });

  const items: EnrichedWatchlistItem[] = data?.items ?? [];
  const tags = tagsData?.tags ?? [];
  const tasteProfile = recommendationsData?.profile;
  const recommendations = recommendationsData?.recommendations ?? [];
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

  useEffect(() => {
    if (!tags.length) return;
    setTagDrafts((prev) => {
      const next: Record<string, { tag: string; color: string }> = { ...prev };
      for (const tag of tags) {
        if (!next[tag.id]) {
          next[tag.id] = {
            tag: tag.tag,
            color: resolveTagColor(tag.tag, tag.color),
          };
        }
      }
      for (const id of Object.keys(next)) {
        if (!tags.some((tag) => tag.id === id)) {
          delete next[id];
        }
      }
      return next;
    });
  }, [tags]);

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">Sign in to view your watchlist</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Your watchlist is personal and synced across devices
        </p>
      </div>
    );
  }

  if (isLoading) return <WatchlistSkeleton />;
  if (error)
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-destructive text-sm">
          We couldn&apos;t load your watchlist. Check your connection and try
          again.
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

  const filtered = activeTab
    ? items.filter((item) => item.watchStatus === activeTab)
    : items;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
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
                  isActive ? "" : "text-muted-foreground hover:text-foreground"
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
                <span className="text-xs opacity-60">({tag.count})</span>
              </button>
            );
          })}
          {tags.length === 0 && (
            <span className="text-sm text-muted-foreground">No tags yet</span>
          )}
        </div>
        <button
          onClick={() => setShowListSettings((prev) => !prev)}
          className="h-8 rounded-md px-3 text-xs border border-border hover:bg-accent"
        >
          {showListSettings ? "Close Settings" : "List Settings"}
        </button>
        <button
          onClick={() => setShowSyncTools((prev) => !prev)}
          className="h-8 rounded-md px-3 text-xs border border-border hover:bg-accent"
        >
          {showSyncTools ? "Close Sync" : "Import / Export"}
        </button>
      </div>

      {showSyncTools && (
        <Card className="space-y-3 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-sm font-medium text-foreground">MAL / AniList Sync</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Paste a MyAnimeList XML export or AniList MediaList JSON to preview and import.
              </p>
            </div>
            <select
              value={syncSource}
              onChange={(event) => setSyncSource(event.target.value as "mal" | "anilist")}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="mal">MyAnimeList XML</option>
              <option value="anilist">AniList JSON</option>
            </select>
          </div>
          <textarea
            value={syncPayload}
            onChange={(event) => setSyncPayload(event.target.value)}
            placeholder={syncSource === "mal" ? "<myanimelist>...</myanimelist>" : "{\"lists\":[...]}"}
            className="min-h-36 w-full rounded-md border border-input bg-background p-3 font-mono text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => previewImportMutation.mutate()}
              disabled={previewImportMutation.isPending || !syncPayload.trim()}
              className="h-8 rounded-md px-3 text-xs border border-border hover:bg-accent disabled:opacity-60"
            >
              Preview Import
            </button>
            <button
              onClick={() => applyImportMutation.mutate()}
              disabled={applyImportMutation.isPending || !syncPayload.trim()}
              className="h-8 rounded-md bg-primary px-3 text-xs text-primary-foreground disabled:opacity-60"
            >
              Apply Import
            </button>
            <button
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
              className="h-8 rounded-md px-3 text-xs border border-border hover:bg-accent disabled:opacity-60"
            >
              Copy AniList Export
            </button>
          </div>
          {syncResult && (
            <p className="rounded-md border border-border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
              {syncResult}
            </p>
          )}
        </Card>
      )}

      {showListSettings && (
        <div className="rounded-lg border border-border p-3 space-y-3">
          <h3 className="text-sm font-medium text-foreground">Manage Lists</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="New list name"
              className="h-8 rounded-md border border-input bg-background px-2 text-xs min-w-[180px]"
            />
            <input
              type="color"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
              className="h-8 w-9 rounded border border-input bg-background p-0.5"
              aria-label="New list color"
            />
            <button
              onClick={() => {
                const tag = newTagName.trim();
                if (!tag) return;
                createTagMutation.mutate(
                  { tag, color: newTagColor },
                  {
                    onSuccess: () => {
                      setNewTagName("");
                      setActiveTab(tag);
                    },
                  },
                );
              }}
              disabled={createTagMutation.isPending}
              className="h-8 rounded-md px-3 text-xs bg-primary text-primary-foreground disabled:opacity-60"
            >
              Add List
            </button>
          </div>

          <div className="space-y-2">
            {tags.map((tag) => {
              const draft = tagDrafts[tag.id] || {
                tag: tag.tag,
                color: resolveTagColor(tag.tag, tag.color),
              };
              return (
                <div key={`${tag.id}-manage`} className="flex flex-wrap items-center gap-2">
                  <input
                    value={draft.tag}
                    onChange={(e) =>
                      setTagDrafts((prev) => ({
                        ...prev,
                        [tag.id]: {
                          ...draft,
                          tag: e.target.value,
                        },
                      }))
                    }
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs min-w-[180px]"
                  />
                  <input
                    type="color"
                    value={draft.color}
                    onChange={(e) =>
                      setTagDrafts((prev) => ({
                        ...prev,
                        [tag.id]: {
                          ...draft,
                          color: e.target.value,
                        },
                      }))
                    }
                    className="h-8 w-9 rounded border border-input bg-background p-0.5"
                    aria-label={`${tag.tag} color`}
                  />
                  <button
                    onClick={() =>
                      updateTagMutation.mutate({
                        tagId: tag.id,
                        tag: draft.tag.trim(),
                        color: draft.color,
                      })
                    }
                    disabled={updateTagMutation.isPending}
                    className="h-8 rounded-md px-2 text-xs border border-border hover:bg-accent disabled:opacity-60"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      if (!window.confirm(`Delete list "${tag.tag}"? Items will be moved automatically.`)) {
                        return;
                      }
                      deleteTagMutation.mutate({ tagId: tag.id });
                    }}
                    disabled={deleteTagMutation.isPending}
                    className="h-8 rounded-md px-2 text-xs border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tasteProfile && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Taste Profile</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Recommendations from your watchlist genres, themes, types, and list signals.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border border-border px-3 py-2">
                  <div className="text-sm font-semibold">{tasteProfile.sampledTitles}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">sampled</div>
                </div>
                <div className="rounded-md border border-border px-3 py-2">
                  <div className="text-sm font-semibold">{tasteProfile.favoriteGenres.length}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">genres</div>
                </div>
                <div className="rounded-md border border-border px-3 py-2">
                  <div className="text-sm font-semibold">{recommendations.length}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">picks</div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {[...tasteProfile.favoriteGenres, ...tasteProfile.favoriteThemes].slice(0, 8).map((signal) => (
                <Badge key={`${signal.name}-${signal.weight}`} variant="outline" className="text-[11px]">
                  {signal.name} · {signal.weight}
                </Badge>
              ))}
              {tasteProfile.sampledTitles === 0 && (
                <span className="text-sm text-muted-foreground">
                  Add anime to your watchlist to build a profile.
                </span>
              )}
            </div>
          </div>

          {recommendations.length > 0 && (
            <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              {recommendations.slice(0, 6).map((item) => (
                <Link
                  key={item.mal_id}
                  href={getAnimeDetailHref(item.mal_id)}
                  className="group flex gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/50"
                >
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.title_english || item.title}
                      width={56}
                      height={78}
                      className="h-[78px] w-14 rounded-md object-cover"
                    />
                  ) : (
                    <div className="h-[78px] w-14 shrink-0 rounded-md bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                      {item.title_english || item.title}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                      {item.score ? <span>{item.score}</span> : null}
                      {item.year ? <span>{item.year}</span> : null}
                      {item.type ? <span>{item.type}</span> : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.reasons.slice(0, 2).map((reason) => (
                        <Badge key={reason} variant="secondary" className="text-[10px] font-normal">
                          {reason}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold text-primary">{item.tasteScore}</div>
                    <div className="text-[10px] text-muted-foreground">fit</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {activeTab ? `No anime with tag "${activeTab}"` : "No anime in watchlist yet"}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((item) => (
            <Card key={item.mal_id} className="overflow-hidden flex flex-row p-0 hover:border-primary/30 transition-colors">
              {item.image ? (
                <Link
                  href={getAnimeDetailHref(item.mal_id)}
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
                <div className="w-[85px] min-h-[120px] shrink-0 bg-muted flex items-center justify-center">
                  <span className="text-muted-foreground text-xs">No img</span>
                </div>
              )}

              <div className="flex-1 p-3 flex flex-col gap-1.5 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={getAnimeDetailHref(item.mal_id)}
                    className="min-w-0 flex-1 text-sm font-medium text-foreground hover:text-primary transition-colors truncate"
                  >
                    {item.title}
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${item.title} on MyAnimeList`}
                        className="text-muted-foreground transition-colors hover:text-primary"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                    {item.type && (
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {item.type}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 text-xs text-muted-foreground">
                  {item.score && (
                    <span>
                      <span className={cn(
                        "font-medium",
                        item.score >= 8 ? "text-emerald-400" : item.score >= 6 ? "text-yellow-400" : "text-red-400"
                      )}>
                        {item.score}
                      </span>
                    </span>
                  )}
                  {item.year && <span>{item.year}</span>}
                  {item.episodes && <span>{item.episodes} eps</span>}
                </div>

                {item.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.genres.slice(0, 4).map((g) => (
                      <Badge key={g} variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                        {g}
                      </Badge>
                    ))}
                  </div>
                )}

                {item.note ? (
                  <p className="line-clamp-2 rounded-md bg-secondary/50 px-2 py-1 text-xs text-muted-foreground">
                    {item.note}
                  </p>
                ) : null}

                <div className="mt-auto pt-1">
                  <select
                    value={item.watchStatus}
                    onChange={(e) => {
                      if (e.target.value === "REMOVE") {
                        removeMutation.mutate(item.mal_id);
                        return;
                      }
                      if (e.target.value === "__NEW_TAG__") {
                        const customTag = window.prompt("New tag name");
                        if (!customTag || !customTag.trim()) return;
                        const tag = customTag.trim();
                        const color = getDefaultTagColor(tag);
                        statusMutation.mutate({ malId: item.mal_id, status: tag, tagColor: color });
                        setActiveTab(tag);
                        return;
                      }
                      statusMutation.mutate({
                        malId: item.mal_id,
                        status: e.target.value,
                        tagColor: tagColorMap.get(e.target.value),
                      });
                    }}
                    disabled={statusMutation.isPending || removeMutation.isPending}
                    className="h-7 rounded-lg border border-input bg-secondary px-2 text-xs"
                  >
                    {tags.map((tag) => (
                      <option key={tag.tag} value={tag.tag}>{tag.tag}</option>
                    ))}
                    <option value="__NEW_TAG__">+ New tag...</option>
                    <option value="REMOVE" className="text-destructive">Remove from watchlist</option>
                  </select>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
