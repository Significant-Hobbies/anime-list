"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import type { EnrichedWatchlistItem, ScheduleItem, ScheduleTimelineDay } from "@/lib/types";
import {
  addToSchedule,
  addToWatchlist,
  getEnrichedWatchlist,
  getScheduleTimeline,
  removeFromSchedule,
  updateScheduleItem,
  reorderSchedule,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, getAnimeDetailHref } from "@/lib/utils";

// ── Client-side timeline computation (uses local timezone) ─────────────

function buildTimeline(items: ScheduleItem[], epd: number): {
  timeline: ScheduleTimelineDay[];
  stats: { total_episodes: number; total_days: number; start_date: string; finish_date: string };
} {
  const timeline: ScheduleTimelineDay[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let currentDay = 0;
  let dayCapacityLeft = epd;
  let totalEpisodes = 0;

  const dateForDay = (day: number): string => {
    const d = new Date(today);
    d.setDate(d.getDate() + day);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const getOrCreateDay = (day: number): ScheduleTimelineDay => {
    let entry = timeline.find((t) => t.day === day);
    if (!entry) {
      entry = { day, date: dateForDay(day), entries: [] };
      timeline.push(entry);
    }
    return entry;
  };

  for (const item of items) {
    const totalEps = item.episodes ?? 0;
    const watched = item.episodes_watched ?? 0;
    const remaining = Math.max(0, totalEps - watched);
    if (remaining === 0) continue;
    totalEpisodes += remaining;
    let epsRemaining = remaining;
    let currentEp = watched + 1;

    while (epsRemaining > 0) {
      if (dayCapacityLeft === 0) {
        currentDay++;
        dayCapacityLeft = epd;
      }
      const epsThisDay = Math.min(dayCapacityLeft, epsRemaining);
      const dayEntry = getOrCreateDay(currentDay);
      dayEntry.entries.push({
        mal_id: item.mal_id,
        title: item.title,
        image: item.image,
        episodes_today: epsThisDay,
        episode_range: [currentEp, currentEp + epsThisDay - 1],
        is_final_day: epsRemaining === epsThisDay,
      });
      currentEp += epsThisDay;
      epsRemaining -= epsThisDay;
      dayCapacityLeft -= epsThisDay;
    }
  }

  const totalDays = timeline.length;
  const startDate = dateForDay(0);
  const finishDate = totalDays > 0 ? timeline[timeline.length - 1].date : startDate;

  return {
    timeline,
    stats: { total_episodes: totalEpisodes, total_days: totalDays, start_date: startDate, finish_date: finishDate },
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function ScheduleSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function DayLabel({ day, date }: { day: number; date: string }) {
  const todayStr = (() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  })();
  const isToday = date === todayStr;
  return (
    <span className={cn("text-xs font-medium", isToday ? "text-primary" : "text-muted-foreground")}>
      {isToday ? "Today" : `Day ${day + 1}`} &middot; {formatDate(date)}
    </span>
  );
}

// ── Main component ──────────────────────────────────────────────────────

export default function ScheduleView() {
  const { user, loading: authLoading } = useAuth();
  const [showPicker, setShowPicker] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [epd, setEpd] = useState(() => {
    if (typeof window === "undefined") return 3;
    const saved = localStorage.getItem("mal_schedule_epd");
    return saved ? Math.max(1, Number(saved) || 3) : 3;
  });
  const queryClient = useQueryClient();

  const updateEpd = (val: number) => {
    const clamped = Math.max(1, Math.min(100, val));
    setEpd(clamped);
    localStorage.setItem("mal_schedule_epd", String(clamped));
  };

  // Drag state
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Debounce watched updates -- optimistic UI is instant, API call is debounced
  const watchedTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const debouncedWatchedUpdate = useCallback(
    (malId: string, watched: number) => {
      const existing = watchedTimers.current.get(malId);
      if (existing) clearTimeout(existing);
      watchedTimers.current.set(
        malId,
        setTimeout(() => {
          watchedTimers.current.delete(malId);
          updateScheduleItem(malId, { episodes_watched: watched });
        }, 500),
      );
    },
    [],
  );

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["schedule", "timeline"],
    queryFn: () => getScheduleTimeline(),
    enabled: !!user,
  });

  const { data: watchlistData } = useQuery({
    queryKey: ["watchlist", "enriched"],
    queryFn: () => getEnrichedWatchlist(),
    enabled: !!user && showPicker,
  });

  const addMutation = useMutation({
    mutationFn: (malIds: number[]) => addToSchedule(malIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      setSelectedIds(new Set());
      setShowPicker(false);
    },
  });

  const SCHEDULE_KEY = ["schedule", "timeline"];

  const setWatched = useCallback(
    (malId: string, watched: number) => {
      // Optimistic: update cache instantly
      queryClient.setQueryData(SCHEDULE_KEY, (old: typeof data) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((i: ScheduleItem) =>
            i.mal_id === malId ? { ...i, episodes_watched: watched } : i,
          ),
        };
      });
      // Debounced: sync to server
      debouncedWatchedUpdate(malId, watched);
    },
    [queryClient, debouncedWatchedUpdate, data],
  );

  const removeMutation = useMutation({
    mutationFn: (malIds: number[]) => removeFromSchedule(malIds),
    onMutate: async (malIds) => {
      await queryClient.cancelQueries({ queryKey: SCHEDULE_KEY });
      const previous = queryClient.getQueryData(SCHEDULE_KEY);
      const removeSet = new Set(malIds.map(String));
      queryClient.setQueryData(SCHEDULE_KEY, (old: typeof data) => {
        if (!old) return old;
        return { ...old, items: old.items.filter((i: ScheduleItem) => !removeSet.has(i.mal_id)) };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(SCHEDULE_KEY, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULE_KEY });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (malIds: string[]) => reorderSchedule(malIds),
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: SCHEDULE_KEY });
      const previous = queryClient.getQueryData(SCHEDULE_KEY);
      queryClient.setQueryData(SCHEDULE_KEY, (old: typeof data) => {
        if (!old) return old;
        const map = new Map(old.items.map((i: ScheduleItem) => [i.mal_id, i]));
        const reordered = orderedIds
          .map((id, i) => {
            const item = map.get(id);
            return item ? { ...item, sort_order: i } : null;
          })
          .filter(Boolean) as ScheduleItem[];
        return { ...old, items: reordered };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(SCHEDULE_KEY, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULE_KEY });
    },
  });

  const doneMutation = useMutation({
    mutationFn: async (malId: string) => {
      await removeFromSchedule([Number(malId)]);
      await addToWatchlist([Number(malId)], "Done");
    },
    onMutate: async (malId) => {
      await queryClient.cancelQueries({ queryKey: SCHEDULE_KEY });
      const previous = queryClient.getQueryData(SCHEDULE_KEY);
      queryClient.setQueryData(SCHEDULE_KEY, (old: typeof data) => {
        if (!old) return old;
        return { ...old, items: old.items.filter((i: ScheduleItem) => i.mal_id !== malId) };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(SCHEDULE_KEY, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULE_KEY });
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist", "enriched"] });
    },
  });

  const items: ScheduleItem[] = data?.items ?? [];

  // Compute timeline client-side for correct local timezone
  const { timeline, stats } = useMemo(() => buildTimeline(items, epd), [items, epd]);

  const scheduledIds = new Set(items.map((i) => i.mal_id));
  const availableWatchlist: EnrichedWatchlistItem[] = (watchlistData?.items ?? []).filter(
    (item) => !scheduledIds.has(item.mal_id),
  );

  // ── Drag handlers ───────────────────────────────────────────────────

  const handleDragStart = (index: number) => {
    dragIndexRef.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (targetIndex: number) => {
    const fromIndex = dragIndexRef.current;
    if (fromIndex === null || fromIndex === targetIndex) {
      dragIndexRef.current = null;
      setDragOverIndex(null);
      return;
    }
    const ordered = items.map((i) => i.mal_id);
    const [moved] = ordered.splice(fromIndex, 1);
    ordered.splice(targetIndex, 0, moved);
    reorderMutation.mutate(ordered);
    dragIndexRef.current = null;
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  };

  // ── Auth gates ──────────────────────────────────────────────────────

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">Sign in to plan your schedule</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Plan your anime watching calendar day by day
        </p>
      </div>
    );
  }

  if (isLoading) return <ScheduleSkeleton />;
  if (error)
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-destructive text-sm">
          We couldn&apos;t load your schedule. Check your connection and try
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

  return (
    <div className="space-y-5">
      {/* Ep/day control + Stats */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-muted-foreground">Episodes per day</label>
        <input
          type="number"
          min={1}
          max={100}
          value={epd}
          onChange={(e) => updateEpd(Number(e.target.value) || 1)}
          className="h-8 w-16 rounded-md border border-input bg-background px-2 text-sm text-center"
        />
      </div>
      {stats && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-foreground">{items.length}</div>
            <div className="text-xs text-muted-foreground">Anime</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-foreground">{stats.total_episodes}</div>
            <div className="text-xs text-muted-foreground">Episodes</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-foreground">{stats.total_days}</div>
            <div className="text-xs text-muted-foreground">Days</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-primary">{formatDate(stats.finish_date)}</div>
            <div className="text-xs text-muted-foreground">Finish date</div>
          </Card>
        </div>
      )}

      {/* Queue header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Queue</h2>
        <button
          onClick={() => setShowPicker((prev) => !prev)}
          className="h-8 rounded-md px-3 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {showPicker ? "Cancel" : "+ Add from Watchlist"}
        </button>
      </div>

      {/* Anime picker */}
      {showPicker && (
        <Card className="p-3 space-y-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (selectedIds.size === 0) return;
                addMutation.mutate(Array.from(selectedIds).map(Number));
              }}
              disabled={selectedIds.size === 0 || addMutation.isPending}
              className="h-7 rounded-md px-3 text-xs bg-primary text-primary-foreground disabled:opacity-50"
            >
              Add {selectedIds.size > 0 ? `(${selectedIds.size})` : "selected"}
            </button>
          </div>

          {availableWatchlist.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              {watchlistData ? "All watchlist anime are already scheduled" : "Loading watchlist..."}
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-1">
              {availableWatchlist.map((item) => (
                <label
                  key={item.mal_id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-accent transition-colors",
                    selectedIds.has(item.mal_id) && "bg-primary/10",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.mal_id)}
                    onChange={(e) => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(item.mal_id);
                        else next.delete(item.mal_id);
                        return next;
                      });
                    }}
                    className="rounded"
                  />
                  {item.image && (
                    <Image src={item.image} alt="" width={28} height={40} className="rounded object-cover" />
                  )}
                  <span className="text-sm truncate flex-1">{item.title}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {item.episodes ? `${item.episodes} eps` : "? eps"}
                  </span>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{item.watchStatus}</Badge>
                </label>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Queue items — drag to reorder */}
      {items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No anime scheduled yet</p>
          <p className="text-xs mt-1">Add anime from your watchlist to start planning</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((item, index) => (
            <Card
              key={item.mal_id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              className={cn(
                "overflow-hidden flex flex-row p-0 transition-all cursor-grab active:cursor-grabbing",
                dragOverIndex === index
                  ? "border-primary ring-1 ring-primary/30"
                  : "hover:border-primary/30",
              )}
            >
              {item.image ? (
                <Link
                  href={getAnimeDetailHref(item.mal_id)}
                  className="relative block w-[60px] min-h-[80px] shrink-0"
                >
                  <Image src={item.image} alt={item.title} fill className="object-cover" sizes="60px" />
                </Link>
              ) : (
                <div className="w-[60px] min-h-[80px] shrink-0 bg-muted" />
              )}

              <div className="flex-1 p-2.5 flex items-center gap-3 min-w-0">
                {/* Drag handle */}
                <div className="shrink-0 text-muted-foreground/40 select-none" aria-hidden>
                  <svg width="12" height="20" viewBox="0 0 12 20" fill="currentColor">
                    <circle cx="3" cy="4" r="1.5" />
                    <circle cx="9" cy="4" r="1.5" />
                    <circle cx="3" cy="10" r="1.5" />
                    <circle cx="9" cy="10" r="1.5" />
                    <circle cx="3" cy="16" r="1.5" />
                    <circle cx="9" cy="16" r="1.5" />
                  </svg>
                </div>

                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <Link
                      href={getAnimeDetailHref(item.mal_id)}
                      className="min-w-0 flex-1 truncate text-sm font-medium transition-colors hover:text-primary"
                    >
                      {item.title}
                    </Link>
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${item.title} on MyAnimeList`}
                        className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {item.episodes != null && (
                      <span className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={item.episodes}
                          value={item.episodes_watched ?? 0}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(item.episodes ?? 0, Number(e.target.value) || 0));
                            setWatched(item.mal_id, val);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-5 w-10 rounded border border-input bg-background px-0.5 text-[11px] text-center"
                        />
                        <span>/ {item.episodes}</span>
                      </span>
                    )}
                    {item.type && <span>{item.type}</span>}
                    {item.episodes != null && (
                      <span className="text-primary">
                        {Math.ceil(Math.max(0, item.episodes - (item.episodes_watched ?? 0)) / epd)} days left
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => doneMutation.mutate(item.mal_id)}
                  disabled={doneMutation.isPending}
                  className="h-6 rounded-md px-1.5 text-[10px] font-medium text-emerald-500 hover:bg-emerald-500/10 border border-emerald-500/30 shrink-0"
                  aria-label="Mark as done"
                >
                  Done
                </button>
                <button
                  onClick={() => removeMutation.mutate([Number(item.mal_id)])}
                  disabled={removeMutation.isPending}
                  className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                  aria-label="Remove"
                >
                  &times;
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Timeline */}
      {timeline.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-foreground pt-2">Timeline</h2>
          <div className="space-y-1.5">
            {timeline.map((day) => (
              <div key={day.day} className="flex gap-3 items-start">
                <div className="w-28 shrink-0 pt-1.5">
                  <DayLabel day={day.day} date={day.date} />
                </div>
                <div className="flex-1 space-y-1">
                  {day.entries.map((entry, i) => (
                    <div
                      key={`${entry.mal_id}-${i}`}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm",
                        entry.is_final_day
                          ? "bg-primary/10 border border-primary/20"
                          : "bg-muted/50",
                      )}
                    >
                      {entry.image && (
                        <Image src={entry.image} alt="" width={20} height={28} className="rounded object-cover shrink-0" />
                      )}
                      <Link
                        href={getAnimeDetailHref(entry.mal_id)}
                        className="truncate flex-1 transition-colors hover:text-primary"
                      >
                        {entry.title}
                      </Link>
                      <Badge variant={entry.is_final_day ? "default" : "secondary"} className="text-[10px] shrink-0">
                        {entry.episode_range[0] === entry.episode_range[1]
                          ? `Ep ${entry.episode_range[0]}`
                          : `Ep ${entry.episode_range[0]}-${entry.episode_range[1]}`}
                      </Badge>
                      {entry.is_final_day && (
                        <span className="text-[10px] text-primary font-medium shrink-0">Done</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
