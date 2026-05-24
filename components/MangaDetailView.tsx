"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Heart, Star } from "lucide-react";
import { getMangaDetail, addToMangaWatchlist, getWatchlistTags } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { trackActivated, trackCoreAction } from "@/lib/analytics";
import { DEFAULT_WATCH_TAGS, resolveTagColor } from "@/lib/watchStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const wholeNumber = new Intl.NumberFormat("en-US");

function mangaTitle<T extends { title: string; title_english?: string | null }>(manga: T): string {
  return manga.title_english || manga.title;
}

function formatStat(value?: number | null, compact = false): string | null {
  if (value == null || value <= 0) return null;
  return compact ? compactNumber.format(value) : wholeNumber.format(value);
}

function LoadingSkeleton({ isModal = false }: { isModal?: boolean }) {
    return (
      <div className={cn("space-y-6 animate-pulse", isModal ? "p-6" : "px-6 py-10")}>
        {!isModal && <div className="h-9 w-32 rounded-md bg-muted" />}
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-4 aspect-[2/3] rounded-sm bg-surface-container-high" />
          <div className="lg:col-span-8 space-y-4 rounded-sm border border-outline/10 bg-surface-container-low p-6">
            <div className="h-12 w-2/3 rounded bg-muted" />
            <div className="h-32 w-full rounded bg-muted" />
          </div>
        </div>
      </div>
    );
  }

export default function MangaDetailView({ malId, isModal = false }: { malId: number, isModal?: boolean }) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [showMenu, setShowMenu] = useState(false);
    const [customTag, setCustomTag] = useState("");
    const [customColor, setCustomColor] = useState("#10b981");
    const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["manga", "detail", malId],
    queryFn: () => getMangaDetail(malId),
  });

  const { data: tagsData } = useQuery({
    queryKey: ["watchlist", "tags"],
    queryFn: () => getWatchlistTags(),
    enabled: !!user,
  });

  const availableTags = tagsData?.tags?.length ? tagsData.tags : DEFAULT_WATCH_TAGS;
  const persistedStatus = detailQuery.data?.watchlistEntry?.status ?? null;
  const currentStatus = optimisticStatus ?? persistedStatus;
  const currentStatusColor = useMemo(() => {
    if (!currentStatus) return null;
    const matchingTag = availableTags.find((tag) => tag.tag === currentStatus);
    return resolveTagColor(currentStatus, matchingTag?.color);
  }, [availableTags, currentStatus]);

  const watchlistMutation = useMutation({
    mutationFn: ({
      status,
      tagColor,
    }: {
      status: string;
      tagColor?: string;
    }) => addToMangaWatchlist([malId], status, tagColor),
    onSuccess: () => {
      setCustomTag("");
      queryClient.invalidateQueries({ queryKey: ["manga", "watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist", "tags"] });
      queryClient.invalidateQueries({ queryKey: ["manga", "detail", malId] });
      trackCoreAction("watchlist_add");
      trackActivated(user?.id);
    },
  });

  const handleAdd = (status: string, tagColor?: string) => {
    const previousStatus = currentStatus;
    setShowMenu(false);
    setOptimisticStatus(status);
    watchlistMutation.mutate(
      { status, tagColor },
      {
        onError: () => {
          setOptimisticStatus(previousStatus);
        },
      },
    );
  };

  if (detailQuery.isLoading) return <LoadingSkeleton isModal={isModal} />;
  if (detailQuery.error || !detailQuery.data) {
    return (
        <div className={cn("space-y-4", isModal ? "p-6" : "px-6 pt-10")}>
        {!isModal && (
            <Button asChild variant="ghost" size="sm" className="text-white/60 hover:text-white">
                <Link href="/manga"><ArrowLeft className="mr-2 h-4 w-4"/>Back to Discover</Link>
            </Button>
        )}
        <div className="bg-error-container text-on-error-container p-6 rounded-sm border border-error">
          <h2 className="text-lg font-semibold text-foreground mb-2">Unable to load manga details</h2>
          <p className="text-sm font-body opacity-80">
            We couldn&apos;t reach the manga data right now. Check your connection and try again.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => detailQuery.refetch()}
            disabled={detailQuery.isFetching}
          >
            {detailQuery.isFetching ? "Retrying…" : "Try again"}
          </Button>
        </div>
      </div>
    );
  }

  const { manga } = detailQuery.data;
  const title = mangaTitle(manga);
  const score = formatStat(manga.score);
  const popularity = manga.popularity ? `#${wholeNumber.format(manga.popularity)}` : null;
  const rank = manga.rank ? `#${wholeNumber.format(manga.rank)}` : null;
  const synopsis = manga.synopsis?.trim();

  return (
    <div className={cn("space-y-12", !isModal && "max-w-7xl mx-auto", "px-4 sm:px-6 py-10")}>
      <div className="space-y-6">
        <div className={cn("flex items-center gap-4", isModal ? "justify-end" : "justify-between")}>
          {!isModal && (
            <Button asChild variant="ghost" size="sm" className="text-white/60 hover:text-white h-8 px-2 border border-outline/20">
              <Link href="/manga">
                <ArrowLeft className="mr-1 h-3 w-3" />
                Back
              </Link>
            </Button>
          )}
          <a
            href={manga.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Open on MAL <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {manga.rank ? (
              <span className="bg-primary text-primary-foreground px-3 py-1 text-[10px] font-black tracking-widest uppercase rounded-sm">
                Rank {rank}
              </span>
            ) : null}
            {manga.year ? (
              <span className="text-white/60 font-body text-[10px] font-bold tracking-widest uppercase">
                {manga.year}
              </span>
            ) : null}
            {manga.type ? (
              <span className="text-white/60 font-body text-[10px] font-bold tracking-widest uppercase">
                • {manga.type}
              </span>
            ) : null}
            {manga.status ? (
              <span className="text-white/60 font-body text-[10px] font-bold tracking-widest uppercase">
                • {manga.status}
              </span>
            ) : null}
          </div>
          <h1 className="font-semibold text-3xl sm:text-5xl tracking-tight text-foreground">
            {title}
          </h1>
          {manga.title !== title && (
            <h2 className="font-body text-lg text-white/40 tracking-wide uppercase font-bold">
              {manga.title}
            </h2>
          )}
        </div>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
        <div className="lg:col-span-4 space-y-8">
          <div className="relative aspect-[2/3] w-full rounded-sm overflow-hidden bg-surface-container-low border border-outline/10 shadow-2xl">
            {manga.image ? (
              <Image src={manga.image} alt={title} fill priority className="object-cover" sizes="(max-width: 1024px) 100vw, 400px" />
            ) : null}
          </div>

          <div className="relative">
          <button
              onClick={() => setShowMenu(!showMenu)}
              disabled={watchlistMutation.isPending}
              aria-label={currentStatus ? `Edit watchlist status: ${currentStatus}` : "Add to watchlist"}
              className="w-full h-12 rounded-sm bg-primary text-primary-foreground flex items-center justify-center hover:scale-[1.02] transition-transform"
              style={
                currentStatusColor
                  ? { backgroundColor: currentStatusColor, boxShadow: `0 0 25px -5px ${currentStatusColor}66` }
                  : undefined
              }
            >
              {watchlistMutation.isPending ? (
                <span className="animate-spin text-sm">...</span>
              ) : currentStatus ? (
                <span className="text-sm font-black uppercase tracking-widest">IN LIST: {currentStatus}</span>
              ) : (
                <span className="font-black text-sm">ADD TO LIST</span>
              )}
            </button>
            {showMenu && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-surface-container-high border border-outline/20 shadow-2xl rounded-sm py-1 w-full z-20">
                {availableTags.map((tag) => {
                  const color = resolveTagColor(tag.tag, tag.color);
                  const isCurrentTag = currentStatus === tag.tag;
                  return (
                  <button
                    key={tag.tag}
                    onClick={() => handleAdd(tag.tag, tag.color)}
                    className="flex items-center justify-between gap-2 w-full px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition-colors text-left"
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: color, color: color }}
                      />
                      <span className="text-white/80">{tag.tag}</span>
                    </span>
                    {isCurrentTag && (
                      <span className="text-[9px] text-primary">
                        Current
                      </span>
                    )}
                  </button>
                  );
                })}
                <div className="border-t border-outline/10 px-3 pt-3 pb-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={customTag}
                      onChange={(e) => setCustomTag(e.target.value)}
                      placeholder="NEW TAG"
                      className="h-8 flex-1 rounded-sm border border-outline/20 bg-surface px-2 text-[10px] font-bold uppercase tracking-widest text-white placeholder:text-white/20 focus:outline-none focus:border-primary"
                    />
                    <input
                      type="color"
                      value={customColor}
                      onChange={(e) => setCustomColor(e.target.value)}
                      className="h-8 w-8 rounded-sm border border-outline/20 bg-surface p-0.5 cursor-pointer"
                      aria-label="Tag color"
                    />
                  </div>
                  <button
                    onClick={() => {
                      const tag = customTag.trim();
                      if (!tag) return;
                      handleAdd(tag, customColor);
                    }}
                    className="h-8 w-full rounded-sm bg-primary/10 text-primary border border-primary/20 text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-container-high p-5 flex flex-col justify-between aspect-square rounded-sm border border-outline/5">
              <span className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase flex items-center gap-2"><Star className="h-3 w-3 text-primary"/> Rating</span>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-black font-display text-white italic">{score || "N/A"}</span>
                {score && <span className="text-primary font-bold mb-1">/10</span>}
              </div>
            </div>
            <div className="bg-surface-container-lowest p-5 flex flex-col justify-between aspect-square rounded-sm border border-outline/5">
              <span className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase flex items-center gap-2"><Heart className="h-3 w-3 text-primary"/> Popularity</span>
              <span className="text-3xl font-black font-display text-white">{popularity || "N/A"}</span>
            </div>
          </div>

          <div className="bg-surface-container-low p-6 rounded-sm border border-outline/5 space-y-4">
            {[
              { label: "Chapters", value: manga.chapters },
              { label: "Volumes", value: manga.volumes },
              { label: "Status", value: manga.status },
              { label: "Members", value: manga.members ? wholeNumber.format(manga.members) : null },
              { label: "Favorites", value: manga.favorites ? wholeNumber.format(manga.favorites) : null },
              { label: "English", value: manga.available_in_english ? "Yes" : manga.available_in_english === false ? "No" : null },
            ].map((stat) => (
              <div key={stat.label} className="flex justify-between border-b border-outline/10 last:border-0 pb-2 last:pb-0">
                <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase">{stat.label}</span>
                <span className="text-sm font-bold text-white">{stat.value ?? "Unknown"}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-8 space-y-12 md:space-y-16">
          <div className="flex flex-wrap gap-3">
            {[...manga.genres, ...manga.themes, ...manga.demographics].map((g) => (
              <span key={g} className="px-4 py-2 border border-outline/20 text-[10px] font-black tracking-[0.2em] uppercase text-white hover:bg-white/5 transition-colors cursor-default bg-surface-container-low">
                {g}
              </span>
            ))}
          </div>

          {(manga.has_colored || manga.is_completed) && (
            <div className="flex flex-wrap gap-2">
              {manga.has_colored ? <Badge variant="secondary">Colored</Badge> : null}
              {manga.is_completed ? <Badge variant="secondary">Completed</Badge> : null}
            </div>
          )}

          {synopsis ? (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Synopsis</h2>
              <p className="text-muted-foreground leading-relaxed text-sm md:text-base whitespace-pre-line">
                {synopsis}
              </p>
            </div>
          ) : null}

          {manga.available_languages && manga.available_languages.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display font-semibold text-xl text-foreground/80">Languages</h2>
              <div className="flex flex-wrap gap-2">
                {manga.available_languages.map((lang) => (
                  <Badge key={lang} variant="outline">{lang}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
