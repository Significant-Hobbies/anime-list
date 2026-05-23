"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import type { AnimeSummary } from "@/lib/types";
import {
  addToMangaWatchlist,
  getMangaWatchlist,
  getWatchlistTags,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_WATCH_TAGS, resolveTagColor } from "@/lib/watchStatus";
import { getMangaDetailHref } from "@/lib/utils";

export default function MangaCard({
  manga,
  priority = false,
}: {
  manga: AnimeSummary;
  priority?: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [customTag, setCustomTag] = useState("");
  const [customColor, setCustomColor] = useState("#10b981");
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: watchlistData } = useQuery({
    queryKey: ["manga", "watchlist"],
    queryFn: () => getMangaWatchlist(),
    enabled: !!user,
  });

  const { data: tagsData } = useQuery({
    queryKey: ["watchlist", "tags"],
    queryFn: () => getWatchlistTags(),
    enabled: !!user,
  });

  const availableTags = tagsData?.tags?.length ? tagsData.tags : DEFAULT_WATCH_TAGS;
  const persistedStatus = watchlistData?.manga?.[String(manga.id)]?.status ?? null;
  const currentStatus = optimisticStatus ?? persistedStatus;
  const currentStatusColor = useMemo(() => {
    if (!currentStatus) return null;
    const matchingTag = availableTags.find((tag) => tag.tag === currentStatus);
    return resolveTagColor(currentStatus, matchingTag?.color);
  }, [availableTags, currentStatus]);

  const mutation = useMutation({
    mutationFn: ({
      status,
      tagColor,
    }: {
      status: string;
      tagColor?: string;
    }) => addToMangaWatchlist([manga.id], status, tagColor),
    onSuccess: () => {
      setCustomTag("");
      queryClient.invalidateQueries({ queryKey: ["manga", "watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["manga", "watchlist", "enriched"] });
    },
  });

  const handleAdd = (status: string, tagColor?: string) => {
    setOptimisticStatus(status);
    mutation.mutate({ status, tagColor });
    setShowMenu(false);
  };

  const displayTitle = manga.title_english || manga.name;

  return (
    <article className="group relative flex flex-col">
      <Link href={getMangaDetailHref(manga.id)} className="block">
        <div className="relative aspect-[2/3] overflow-hidden rounded-sm bg-surface-container-high shadow-lg transition-transform duration-300 group-hover:scale-[1.02]">
          {manga.image ? (
            <Image
              src={manga.image}
              alt={displayTitle}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
              className="object-cover"
              priority={priority}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No cover
            </div>
          )}
          {manga.score ? (
            <Badge className="absolute left-2 top-2 bg-black/70 text-white border-0">
              {manga.score.toFixed(2)}
            </Badge>
          ) : null}
        </div>
      </Link>

      <div className="mt-3 space-y-1">
        <Link href={getMangaDetailHref(manga.id)}>
          <h3 className="line-clamp-2 text-sm font-bold uppercase tracking-tight text-white group-hover:text-primary transition-colors">
            {displayTitle}
          </h3>
        </Link>
        <div className="flex flex-wrap gap-1 text-[10px] text-white/40 uppercase tracking-widest">
          {manga.type ? <span>{manga.type}</span> : null}
          {manga.year ? <span>{manga.year}</span> : null}
          {manga.chapters ? <span>{manga.chapters} ch</span> : null}
        </div>
      </div>

      {user && (
        <div className="mt-2 relative">
          <button
            type="button"
            onClick={() => setShowMenu((open) => !open)}
            className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline"
          >
            {currentStatus ? `Tagged: ${currentStatus}` : "+ Reading list"}
          </button>
          {showMenu && (
            <div className="absolute z-20 mt-1 w-48 rounded border border-outline/20 bg-surface-container-high p-2 shadow-xl">
              {availableTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleAdd(tag.tag, tag.color)}
                  className="block w-full px-2 py-1 text-left text-xs hover:bg-white/5"
                  style={{ color: resolveTagColor(tag.tag, tag.color) }}
                >
                  {tag.tag}
                </button>
              ))}
              <div className="mt-2 border-t border-outline/10 pt-2 space-y-1">
                <input
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  placeholder="Custom tag"
                  className="w-full rounded border border-outline/20 bg-background px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  disabled={!customTag.trim()}
                  onClick={() => handleAdd(customTag.trim(), customColor)}
                  className="w-full rounded bg-primary/20 px-2 py-1 text-xs text-primary disabled:opacity-40"
                >
                  Save custom
                </button>
              </div>
            </div>
          )}
          {currentStatus && currentStatusColor ? (
            <Badge
              variant="outline"
              className="ml-2 text-[10px]"
              style={{ borderColor: currentStatusColor, color: currentStatusColor }}
            >
              {currentStatus}
            </Badge>
          ) : null}
        </div>
      )}

      {manga.link ? (
        <a
          href={manga.link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-[10px] text-white/30 hover:text-primary"
        >
          MAL <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </article>
  );
}
