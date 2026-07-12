'use client';

import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import type { AnimeSummary } from '@/lib/types';
import {
  addToWatchlist,
  addToSchedule,
  getWatchlist,
  getWatchlistTags,
  removeFromWatchlist,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { trackActivated, trackCoreAction } from '@/lib/analytics';
import { Badge } from '@/components/ui/badge';
import { DEFAULT_WATCH_TAGS, resolveTagColor } from '@/lib/watchStatus';
import { getAnimeDetailHref } from '@/lib/utils';

export default function AnimeCard({
  anime,
  priority = false,
}: {
  anime: AnimeSummary;
  priority?: boolean;
}) {
  const [scheduled, setScheduled] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [customTag, setCustomTag] = useState('');
  const [customColor, setCustomColor] = useState('#10b981');
  const [optimisticStatus, setOptimisticStatus] = useState<string | null | undefined>(undefined);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: watchlistData } = useQuery({
    queryKey: ['watchlist'],
    queryFn: () => getWatchlist(),
    enabled: !!user,
  });

  const { data: tagsData } = useQuery({
    queryKey: ['watchlist', 'tags'],
    queryFn: () => getWatchlistTags(),
    enabled: !!user,
  });

  const availableTags = tagsData?.tags?.length ? tagsData.tags : DEFAULT_WATCH_TAGS;
  const persistedStatus = watchlistData?.anime?.[String(anime.id)]?.status ?? null;
  const currentStatus = optimisticStatus === undefined ? persistedStatus : optimisticStatus;
  const currentStatusColor = useMemo(() => {
    if (!currentStatus) return null;
    const matchingTag = availableTags.find((tag) => tag.tag === currentStatus);
    return resolveTagColor(currentStatus, matchingTag?.color);
  }, [availableTags, currentStatus]);

  const mutation = useMutation({
    mutationFn: ({ status, tagColor }: { status: string; tagColor?: string }) =>
      addToWatchlist([anime.id], status, tagColor),
    onSuccess: () => {
      setCustomTag('');
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      queryClient.invalidateQueries({ queryKey: ['watchlist', 'tags'] });
      // Owner analytics: adding an anime to the watchlist is the core action,
      // and the first add is the user's `activated` milestone.
      trackCoreAction('watchlist_add');
      trackActivated(user?.id);
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: () => addToSchedule([anime.id]),
    onSuccess: () => {
      setScheduled(true);
      setShowMenu(false);
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => removeFromWatchlist([anime.id]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      queryClient.invalidateQueries({ queryKey: ['watchlist', 'tags'] });
    },
  });

  const handleAdd = (status: string, tagColor?: string) => {
    const previousStatus = currentStatus;
    setShowMenu(false);
    if (currentStatus === status) {
      setOptimisticStatus(null);
      removeMutation.mutate(undefined, {
        onError: () => setOptimisticStatus(previousStatus),
      });
      return;
    }
    setOptimisticStatus(status);
    mutation.mutate(
      { status, tagColor },
      {
        onError: () => {
          setOptimisticStatus(previousStatus);
        },
      }
    );
  };

  const title = anime.title_english || anime.name;
  const detailHref = getAnimeDetailHref(anime.id);
  const memberLabel = anime.members > 0 ? `${Math.round(anime.members / 1000)}k users` : null;

  return (
    <div className="group relative cursor-pointer block">
      {/* Poster image */}
      <Link to={detailHref} className="block">
        <div className="aspect-[2/3] relative overflow-hidden bg-surface-container-low mb-4">
          {anime.image ? (
            <img
              src={anime.image}
              alt={title}
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : 'auto'}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white/40 text-[10px] font-bold tracking-widest uppercase">
                No image
              </span>
            </div>
          )}

          <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/45 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />

          {/* Score badge */}
          {anime.score > 0 && (
            <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-md rounded-md px-2 py-1 border border-border">
              <span className="text-xs font-medium text-primary">{anime.score.toFixed(1)}</span>
            </div>
          )}

          {/* Type badge */}
          {anime.type && (
            <div className="absolute top-2 right-2 bg-black/55 backdrop-blur-md rounded-sm px-2 py-1 border border-white/15 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
              <span className="text-[10px] font-bold text-white uppercase tracking-widest drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                {anime.type}
              </span>
            </div>
          )}

          {/* Hover overlay with details */}
          <div className="absolute inset-x-0 bottom-0 p-4 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
            {anime.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {anime.genres.slice(0, 3).map((g) => (
                  <span
                    key={g}
                    className="text-[9px] font-black tracking-[0.2em] uppercase text-white bg-black/45 backdrop-blur-sm px-2 py-1 rounded-sm shadow-[0_4px_18px_rgba(0,0,0,0.45)] drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
            {anime.synopsis && (
              <p className="text-[11px] font-body text-white line-clamp-3 leading-relaxed drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
                {anime.synopsis}
              </p>
            )}
          </div>
        </div>
      </Link>

      {/* Title and metadata below poster */}
      <div className="mt-2 flex items-start gap-2 justify-between">
        <div className="min-w-0 flex-1">
          <Link to={detailHref} className="block w-full">
            <h4 className="font-medium text-base text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
              {title}
            </h4>
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-muted-foreground">
              <span>{anime.genres[0] || 'Unknown'}</span>
              {anime.year > 0 && <span> • </span>}
              {anime.year > 0 && <span>{anime.year}</span>}
              {memberLabel && <span> • </span>}
              {memberLabel && <span>{memberLabel}</span>}
            </p>
          </div>
        </div>
        <a
          href={anime.link}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${title} on MyAnimeList`}
          className="shrink-0 text-white/30 hover:text-primary transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      {/* Add to watchlist - top right on hover */}
      {user && (
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="relative">
            <button
              onClick={(e) => {
                e.preventDefault();
                setShowMenu(!showMenu);
              }}
              disabled={mutation.isPending || removeMutation.isPending}
              aria-label={
                currentStatus ? `Edit watchlist status: ${currentStatus}` : 'Add to watchlist'
              }
              className="h-8 min-w-8 rounded-sm bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 transition-transform px-2"
              style={
                currentStatusColor
                  ? {
                      backgroundColor: currentStatusColor,
                      boxShadow: `0 0 15px ${currentStatusColor}66`,
                    }
                  : undefined
              }
            >
              {mutation.isPending ? (
                <span className="animate-spin text-sm">...</span>
              ) : currentStatus ? (
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {currentStatus.slice(0, 1)}
                </span>
              ) : (
                <span className="font-black text-sm">+</span>
              )}
            </button>
            {showMenu && (
              <div className="absolute right-0 top-10 bg-surface-container-high border border-outline/20 shadow-2xl rounded-sm py-1 w-52 z-20">
                {availableTags.map((tag) => {
                  const color = resolveTagColor(tag.tag, tag.color);
                  const isCurrentTag = currentStatus === tag.tag;
                  return (
                    <button
                      key={tag.tag}
                      aria-pressed={isCurrentTag}
                      onClick={(e) => {
                        e.preventDefault();
                        handleAdd(tag.tag, tag.color);
                      }}
                      className="flex items-center justify-between gap-2 w-full px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition-colors text-left"
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: color, color: color }}
                        />
                        <span className="text-white/80">{tag.tag}</span>
                      </span>
                      {isCurrentTag && <span className="text-[9px] text-primary">Remove</span>}
                    </button>
                  );
                })}
                <div className="border-t border-outline/10">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      scheduleMutation.mutate();
                    }}
                    disabled={scheduleMutation.isPending || scheduled}
                    className="flex items-center gap-3 w-full px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white/80 hover:bg-white/5 transition-colors text-left disabled:opacity-50"
                  >
                    <svg
                      className="h-3 w-3 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                      />
                    </svg>
                    {scheduled ? 'Scheduled' : 'Schedule'}
                  </button>
                </div>
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
                    onClick={(e) => {
                      e.preventDefault();
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
        </div>
      )}
      {currentStatus && (
        <div className="mt-2">
          <Badge
            className="text-[9px] font-black tracking-widest uppercase rounded-sm border-none"
            style={{
              backgroundColor: currentStatusColor ?? resolveTagColor(currentStatus),
              color: '#131313',
            }}
          >
            {currentStatus}
          </Badge>
        </div>
      )}
    </div>
  );
}
