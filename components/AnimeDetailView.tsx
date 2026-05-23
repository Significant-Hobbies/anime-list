"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  ExternalLink,
  Heart,
  Star,
} from "lucide-react";
import { getAnimeDetail, updateAnimeNote } from "@/lib/api";
import type {
  AnimeRecommendationItem,
  AnimeRelationItem,
} from "@/lib/types";
import { getAnimeDetailHref } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const wholeNumber = new Intl.NumberFormat("en-US");

function animeTitle<T extends { title: string; title_english?: string | null }>(anime: T): string {
  return anime.title_english || anime.title;
}

function formatStat(value?: number | null, compact = false): string | null {
  if (value == null || value <= 0) return null;
  return compact ? compactNumber.format(value) : wholeNumber.format(value);
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse px-6 py-10">
      <div className="h-9 w-32 rounded-md bg-muted" />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4 aspect-[2/3] rounded-sm bg-surface-container-high" />
        <div className="lg:col-span-8 space-y-4 rounded-sm border border-outline/10 bg-surface-container-low p-6">
          <div className="space-y-2">
            <div className="h-12 w-2/3 rounded bg-muted" />
            <div className="h-4 w-1/2 rounded bg-muted" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 rounded-sm bg-muted" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RelatedTitleLink({
  item,
  relationLabel,
}: {
  item: AnimeRelationItem;
  relationLabel?: string;
}) {
  const title = animeTitle(item);
  const isAnimeRoute = item.url?.includes("/anime/") ?? false;
  const href = getAnimeDetailHref(item.mal_id);
  const className =
    "group flex items-start justify-between gap-3 bg-surface-container-low border-l-2 border-outline/20 px-4 py-3 transition-all hover:border-primary hover:bg-white/5";
  const body = (
    <>
      <div className="min-w-0 space-y-1">
        <div className="truncate text-sm font-display font-bold uppercase tracking-tight text-white group-hover:text-primary transition-colors">
          {title}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold tracking-widest uppercase text-white/40">
          {item.type ? <span>{item.type}</span> : null}
          {item.year ? <span>{item.year}</span> : null}
          {relationLabel ? (
            <span className="text-primary">{relationLabel}</span>
          ) : null}
        </div>
      </div>
      <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-white/20 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-primary" />
    </>
  );

  if (isAnimeRoute) {
    return (
      <Link href={href} prefetch={false} className={className}>
        {body}
      </Link>
    );
  }

  return item.url ? (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className={className}>
      {body}
    </a>
  ) : (
    <div className={className}>{body}</div>
  );
}

export default function AnimeDetailView({ malId }: { malId: number }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [noteDraft, setNoteDraft] = useState("");
  const detailQuery = useQuery({
    queryKey: ["anime", "detail", malId],
    queryFn: () => getAnimeDetail(malId),
  });
  const noteMutation = useMutation({
    mutationFn: (note: string) => updateAnimeNote(malId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anime", "detail", malId] });
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });

  const recommendations = useMemo(() => {
    if (!detailQuery.data) return [];
    const deduped = new Map<number, AnimeRecommendationItem>();
    for (const item of [...detailQuery.data.recommendations].sort((a, b) => b.votes - a.votes)) {
      if (item.mal_id === malId) continue;
      if (!deduped.has(item.mal_id)) {
        deduped.set(item.mal_id, item);
      }
    }
    return Array.from(deduped.values()).slice(0, 12);
  }, [detailQuery.data, malId]);

  useEffect(() => {
    setNoteDraft(detailQuery.data?.watchlistEntry?.note ?? "");
  }, [detailQuery.data?.watchlistEntry?.note]);

  if (detailQuery.isLoading) return <LoadingSkeleton />;
  if (detailQuery.error || !detailQuery.data) {
    return (
      <div className="space-y-4 px-6 pt-10">
        <Button asChild variant="ghost" size="sm" className="text-white/60 hover:text-white">
          <Link href="/"><ArrowLeft className="mr-2 h-4 w-4"/>Back to Discover</Link>
        </Button>
        <div className="bg-error-container text-on-error-container p-6 rounded-sm border border-error">
          <h2 className="text-lg font-bold font-display uppercase tracking-tight mb-2">Unable to load anime details</h2>
          <p className="text-sm font-body opacity-80">
            We couldn&apos;t reach the anime data right now. Check your
            connection and try again.
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

  const { anime, relations, watchlistEntry } = detailQuery.data;
  const title = animeTitle(anime);
  const score = formatStat(anime.score);
  const popularity = anime.popularity ? `#${wholeNumber.format(anime.popularity)}` : null;
  const rank = anime.rank ? `#${wholeNumber.format(anime.rank)}` : null;
  const synopsis = anime.synopsis?.trim();
  const prequels = relations.filter((item) => item.relation.toLowerCase() === "prequel");
  const sequels = relations.filter((item) => item.relation.toLowerCase() === "sequel");
  const franchiseGuide = relations.filter((item) => item.relation.toLowerCase() !== "prequel" && item.relation.toLowerCase() !== "sequel");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-12">
      {/* Detail Header */}
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Button asChild variant="ghost" size="sm" className="text-white/60 hover:text-white h-8 px-2 border border-outline/20">
            <Link href="/">
              <ArrowLeft className="mr-1 h-3 w-3" />
              Back
            </Link>
          </Button>
          <a 
            href={anime.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="px-4 py-2 text-[10px] font-black tracking-widest uppercase text-white/60 hover:text-white hover:bg-white/5 transition-colors border border-outline/10 flex items-center justify-center gap-2 rounded-sm"
          >
            Open on MAL <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {anime.rank ? (
              <span className="bg-primary text-primary-foreground px-3 py-1 text-[10px] font-black tracking-widest uppercase rounded-sm">
                Rank {rank}
              </span>
            ) : null}
            {anime.season && anime.year ? (
              <span className="text-white/60 font-body text-[10px] font-bold tracking-widest uppercase">
                {anime.season} {anime.year}
              </span>
            ) : null}
            {anime.type ? (
              <span className="text-white/60 font-body text-[10px] font-bold tracking-widest uppercase">
                • {anime.type}
              </span>
            ) : null}
          </div>
          <h1 className="font-semibold text-3xl sm:text-5xl tracking-tight text-foreground">
            {title}
          </h1>
          {anime.title !== title && (
            <h2 className="font-body text-lg text-white/40 tracking-wide uppercase font-bold">
              {anime.title}
            </h2>
          )}
        </div>
      </div>

      {/* Main Content Layout */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
        
        {/* Left Column: Poster & Stats */}
        <div className="lg:col-span-4 space-y-8">
          <div className="relative aspect-[2/3] w-full rounded-sm overflow-hidden bg-surface-container-low border border-outline/10 shadow-2xl">
            {anime.image ? (
              <Image src={anime.image} alt={title} fill priority className="object-cover" sizes="(max-width: 1024px) 100vw, 400px" />
            ) : null}
          </div>

          {/* Watchlist Action */}
          <div className="bg-surface-container-low p-1 flex rounded-sm">
            {watchlistEntry ? (
              <div className="flex-1 py-3 text-[10px] font-black tracking-widest uppercase text-center bg-primary text-primary-foreground rounded-sm">
                IN LIST: {watchlistEntry.status}
              </div>
            ) : (
              <div className="flex-1 py-3 text-[10px] font-black tracking-widest uppercase text-center text-white/40 bg-surface">
                NOT IN LIST
              </div>
            )}
          </div>

          {/* Bento Stats Grid */}
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

          {/* Details Table */}
          <div className="bg-surface-container-low p-6 rounded-sm border border-outline/5 space-y-4">
            {[
              { label: "Episodes", value: anime.episodes },
              { label: "Status", value: anime.status },
              { label: "Members", value: anime.members ? wholeNumber.format(anime.members) : null },
              { label: "Favorites", value: anime.favorites ? wholeNumber.format(anime.favorites) : null },
            ].map((stat) => (
              <div key={stat.label} className="flex justify-between border-b border-outline/10 last:border-0 pb-2 last:pb-0">
                <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase">{stat.label}</span>
                <span className="text-sm font-bold text-white">{stat.value || "Unknown"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Content & Editorial */}
        <div className="lg:col-span-8 space-y-12 md:space-y-16">
          
          {/* Genre Chips */}
          <div className="flex flex-wrap gap-3">
            {[...anime.genres, ...anime.themes, ...anime.demographics].map((g) => (
              <span key={g} className="px-4 py-2 border border-outline/20 text-[10px] font-black tracking-[0.2em] uppercase text-white hover:bg-white/5 transition-colors cursor-default bg-surface-container-low">
                {g}
              </span>
            ))}
          </div>

          {/* Synopsis */}
          {synopsis && (
            <div className="space-y-6">
              <h2 className="font-display text-3xl font-black italic tracking-tighter uppercase text-white">The Narrative</h2>
              <p className="font-body text-base md:text-lg text-white/70 leading-relaxed whitespace-pre-wrap">
                {synopsis}
              </p>
            </div>
          )}

          {/* Private Note */}
          {user && (
            <div className="space-y-6">
              <h2 className="font-display text-2xl font-black italic tracking-tighter uppercase text-white flex items-center gap-3">
                Curator Notes
              </h2>
              {watchlistEntry ? (
                <div className="bg-surface-container-low p-1 rounded-sm border border-outline/20 flex flex-col focus-within:border-primary/50 transition-colors">
                  <textarea
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    rows={4}
                    maxLength={2000}
                    className="w-full bg-transparent px-4 py-4 text-sm font-body text-white outline-none resize-y min-h-[100px]"
                    placeholder="Document your thoughts..."
                  />
                  <div className="flex items-center justify-between px-4 py-3 bg-surface-container-high border-t border-outline/10">
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                      {noteDraft.trim().length}/2000 CHARS
                    </span>
                    <Button
                      size="sm"
                      className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/20 h-7 text-[10px] font-black uppercase tracking-widest rounded-sm"
                      onClick={() => noteMutation.mutate(noteDraft)}
                      disabled={noteMutation.isPending || noteDraft.trim() === (watchlistEntry.note ?? "").trim()}
                    >
                      {noteMutation.isPending ? "SAVING..." : "SAVE NOTE"}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm font-body text-white/40 italic">Add to your library to unlock private notes.</p>
              )}
            </div>
          )}

          {/* Relations */}
          {(prequels.length > 0 || sequels.length > 0 || franchiseGuide.length > 0) && (
            <div className="space-y-6">
              <div className="flex items-end border-b border-outline/10 pb-4">
                <h2 className="font-display text-2xl font-black uppercase italic tracking-tighter text-white">Collection Echoes</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {[...prequels, ...sequels].map(item => (
                  <RelatedTitleLink key={`direct-${item.mal_id}`} item={item} relationLabel={item.relation} />
                ))}
              </div>
              {franchiseGuide.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-4">Franchise Guide</h3>
                  <div className="grid gap-2">
                    {franchiseGuide.map(item => (
                      <RelatedTitleLink key={`franchise-${item.mal_id}`} item={item} relationLabel={item.relation} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recommendations Scroll */}
          {recommendations.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-end border-b border-outline/10 pb-4">
                <h2 className="font-display text-2xl font-black uppercase italic tracking-tighter text-white">System Recommendations</h2>
              </div>
              <div className="flex gap-4 md:gap-6 overflow-x-auto hide-scrollbar pb-8 -mx-4 px-4 sm:mx-0 sm:px-0">
                {recommendations.map((item) => {
                  const itemTitle = animeTitle(item);
                  return (
                    <Link href={getAnimeDetailHref(item.mal_id)} prefetch={false} key={item.mal_id} className="min-w-[200px] md:min-w-[240px] group cursor-pointer block">
                      <div className="aspect-[2/3] overflow-hidden bg-surface-container-low mb-3 relative rounded-sm border border-outline/10">
                        {item.image ? (
                          <Image src={item.image} alt={itemTitle} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="240px" />
                        ) : null}
                        <div className="absolute inset-0 bg-primary-container/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      </div>
                      <h4 className="font-display font-black text-sm md:text-base uppercase tracking-tight text-white group-hover:text-primary transition-colors line-clamp-2 leading-tight">{itemTitle}</h4>
                      <p className="text-[9px] md:text-[10px] font-bold text-white/40 tracking-widest uppercase mt-1">{item.type || "Unknown"} • {item.year || "Unknown"}</p>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
          
        </div>
      </section>
    </div>
  );
}