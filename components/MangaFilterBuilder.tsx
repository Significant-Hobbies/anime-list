"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useQueryState,
  parseAsString,
  parseAsArrayOf,
  parseAsInteger,
  parseAsJson,
} from "nuqs";
import { useQuery } from "@tanstack/react-query";
import type { SearchFilter, SearchResponse } from "@/lib/types";
import {
  getMangaFields,
  getMangaFilterActions,
  getWatchlistTags,
  searchManga,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { trackCoreAction } from "@/lib/analytics";
import {
  DEFAULT_FILTER_ACTIONS,
  DEFAULT_MANGA_FIELD_OPTIONS,
} from "@/lib/filterMetadata";
import FilterRow from "./FilterRow";
import MangaResultsGrid, { MangaResultsGridSkeleton } from "./MangaResultsGrid";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { resolveTagColor, toRgba } from "@/lib/watchStatus";

const DEFAULT_FILTER: SearchFilter = {
  field: "members",
  action: "GREATER_THAN_OR_EQUALS",
  value: 50000,
};
const DEFAULT_PAGE_SIZE = 40;

const QUICK_GENRES = [
  "Action", "Comedy", "Drama", "Fantasy", "Romance", "Sci-Fi",
  "Slice of Life", "Adventure", "Mystery", "Horror", "Supernatural",
  "Sports", "Suspense",
];

const SORT_OPTIONS = [
  { value: "score", label: "Score" },
  { value: "members", label: "Popularity" },
  { value: "year", label: "Year" },
  { value: "favorites", label: "Favorites" },
  { value: "chapters", label: "Chapters" },
  { value: "volumes", label: "Volumes" },
];

const filtersParser = parseAsJson<SearchFilter[]>((v) => {
  if (!Array.isArray(v)) return null;
  return v as SearchFilter[];
});

function normalizeFilter(filter: SearchFilter): SearchFilter {
  if (filter.field !== "type") return filter;
  const value = Array.isArray(filter.value)
    ? filter.value[0] ?? ""
    : typeof filter.value === "string"
      ? filter.value
      : "";
  return {
    ...filter,
    action: filter.action === "EXCLUDES" ? "EXCLUDES" : "EQUALS",
    value,
  };
}

function isFilterValuePresent(filter: SearchFilter): boolean {
  const normalizedFilter = normalizeFilter(filter);
  if (Array.isArray(normalizedFilter.value)) {
    return normalizedFilter.value.length > 0;
  }
  return normalizedFilter.value !== "" && normalizedFilter.value !== undefined;
}

export default function MangaFilterBuilder() {
  const { user } = useAuth();
  const [filters, setFilters] = useQueryState("mf", filtersParser.withDefault([{ ...DEFAULT_FILTER }]));
  const [searchText, setSearchText] = useQueryState("q", parseAsString.withDefault(""));
  const [sortBy, setSortBy] = useQueryState("sort", parseAsString.withDefault("score"));
  const [selectedGenres, setSelectedGenres] = useQueryState("genres", parseAsArrayOf(parseAsString).withDefault([]));
  const [hideWatched, setHideWatched] = useQueryState("wt", parseAsArrayOf(parseAsString).withDefault([]));
  const [pagesize, setPagesize] = useQueryState("pagesize", parseAsInteger.withDefault(DEFAULT_PAGE_SIZE));
  const [currentPage, setCurrentPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const normalizedFilters = filters.map(normalizeFilter);
  const activeAdvancedFilters = normalizedFilters.filter(isFilterValuePresent);

  const [inputValue, setInputValue] = useState(searchText);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    setInputValue(searchText);
  }, [searchText]);

  const handleInputChange = (value: string) => {
    setInputValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchText(value);
      setCurrentPage(1);
      if (value.trim()) trackCoreAction("manga_search");
    }, 300);
  };

  const [showAdvanced, setShowAdvanced] = useState(() =>
    normalizedFilters.some(isFilterValuePresent),
  );

  const resetPage = () => setCurrentPage(1);

  const { data: fields } = useQuery({
    queryKey: ["manga", "fields"],
    queryFn: getMangaFields,
    initialData: DEFAULT_MANGA_FIELD_OPTIONS,
  });

  const { data: actions } = useQuery({
    queryKey: ["manga", "filterActions"],
    queryFn: getMangaFilterActions,
    initialData: DEFAULT_FILTER_ACTIONS,
  });

  const { data: watchlistTagsData } = useQuery({
    queryKey: ["watchlist", "tags"],
    queryFn: () => getWatchlistTags(),
    enabled: !!user,
  });

  const watchlistTags = watchlistTagsData?.tags ?? [];
  const offset = (currentPage - 1) * pagesize;

  const buildSearchOpts = useCallback(() => {
    const allFilters: SearchFilter[] = [];

    if (selectedGenres.length > 0) {
      allFilters.push({
        field: "genres",
        action: "INCLUDES_ALL",
        value: selectedGenres,
      });
    }

    if (searchText.trim()) {
      allFilters.push({
        field: "title",
        action: "CONTAINS",
        value: searchText.trim(),
      });
    }

    allFilters.push(...activeAdvancedFilters);

    return {
      filters: allFilters,
      opts: {
        pagesize,
        offset,
        sortBy: sortBy || undefined,
        hideWatched,
      },
    };
  }, [activeAdvancedFilters, pagesize, offset, sortBy, selectedGenres, searchText, hideWatched]);

  const filterKey = JSON.stringify(buildSearchOpts());

  const { data, isLoading: loading, isFetching, error, refetch } = useQuery<SearchResponse>({
    queryKey: ["manga", "search", filterKey],
    queryFn: () => {
      const { filters: f, opts } = buildSearchOpts();
      return searchManga(f, opts);
    },
    placeholderData: (prev) => prev,
  });

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
    resetPage();
  };

  const toggleHideWatched = (status: string) => {
    setHideWatched((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
    resetPage();
  };

  const updateFilter = (index: number, filter: SearchFilter) => {
    setFilters((prev) =>
      prev.map((f, i) => (i === index ? normalizeFilter(filter) : f)),
    );
    resetPage();
  };

  const removeFilter = (index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index));
    resetPage();
  };

  const addFilter = () => {
    setFilters((prev) => [...prev, { ...DEFAULT_FILTER }]);
    resetPage();
  };

  const clearAll = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setInputValue("");
    setSelectedGenres([]);
    setSearchText("");
    setFilters([]);
    setSortBy("score");
    setHideWatched([]);
    setPagesize(DEFAULT_PAGE_SIZE);
    setShowAdvanced(false);
    setCurrentPage(1);
  };

  const totalFiltered = data?.totalFiltered || 0;
  const totalPages = totalFiltered > 0 ? Math.ceil(totalFiltered / pagesize) : 0;
  const hasNext = currentPage < totalPages;
  const hasPrev = currentPage > 1;

  if (!fields || !actions) {
    return <MangaResultsGridSkeleton />;
  }

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-card p-5 rounded-lg border border-border shadow-sm">
        <div className="lg:col-span-5 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/20 group-focus-within:text-primary transition-colors" />
          <input
            placeholder="Search manga titles..."
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            className="w-full h-11 bg-surface border border-border pl-12 pr-4 text-sm font-medium text-white placeholder:text-white/20 focus:outline-none focus:border-primary transition-all rounded-lg"
          />
        </div>

        <div className="lg:col-span-3">
          <label className="text-xs font-medium text-muted-foreground mb-2 block">Sort by</label>
          <Select
            value={sortBy}
            onValueChange={(value) => { setSortBy(value); resetPage(); }}
          >
            <SelectTrigger className="h-11 bg-surface border-border text-sm font-medium rounded-lg focus:border-primary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-surface-container-high border-border">
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-[10px] font-bold uppercase tracking-widest focus:bg-primary/10 focus:text-primary">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="lg:col-span-4 flex items-end gap-3">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={cn(
              "h-11 flex-1 flex items-center justify-center gap-3 text-sm font-medium rounded-lg border transition-all",
              showAdvanced
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-surface border-border text-white/60 hover:border-primary hover:text-white",
            )}
          >
            <SlidersHorizontal size={18} />
            Filters
            {activeAdvancedFilters.length > 0 && (
              <span className="bg-white/10 px-2 py-0.5 rounded-lg">{activeAdvancedFilters.length}</span>
            )}
          </button>

          <button
            onClick={clearAll}
            className="h-11 w-14 flex items-center justify-center bg-surface border border-border text-white/20 hover:text-error hover:border-error transition-all rounded-lg"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {showAdvanced && (
        <div className="space-y-4 p-4 md:p-8 bg-surface-container-low border border-border rounded-lg animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Advanced filters</h3>
            <button
              onClick={addFilter}
              className="text-sm font-medium text-primary hover:text-white transition-colors"
            >
              + Add filter
            </button>
          </div>
          <div className="space-y-4">
            {filters.map((_filter, i) => (
              <FilterRow
                key={i}
                filter={normalizedFilters[i]}
                index={i}
                fields={fields}
                actions={actions}
                mediaType="manga"
                onChange={updateFilter}
                onRemove={removeFilter}
              />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-8">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Genres</span>
            <div className="h-px flex-1 bg-outline/5" />
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_GENRES.map((genre) => {
              const selected = selectedGenres.includes(genre);
              return (
                <button
                  key={genre}
                  onClick={() => toggleGenre(genre)}
                  className={cn(
                    "px-6 py-2 min-h-11 border text-sm font-medium transition-all rounded-lg",
                    selected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-surface-container-low border-border text-white/40 hover:border-white/20 hover:text-white",
                  )}
                >
                  {genre}
                </button>
              );
            })}
          </div>
        </div>

        {user && watchlistTags.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Hide tagged</span>
              <div className="h-px flex-1 bg-outline/5" />
            </div>
            <div className="flex flex-wrap gap-2">
              {watchlistTags.map((tag) => {
                const active = hideWatched.includes(tag.tag);
                const color = resolveTagColor(tag.tag, tag.color);
                return (
                  <button
                    key={tag.tag}
                    onClick={() => toggleHideWatched(tag.tag)}
                    className="px-4 py-2 border rounded-lg text-[9px] font-black tracking-widest uppercase transition-all"
                    style={{
                      borderColor: active ? color : toRgba(color, 0.1),
                      backgroundColor: active ? toRgba(color, 0.2) : "transparent",
                      color: active ? color : toRgba(color, 0.4),
                      boxShadow: active ? `0 0 10px ${toRgba(color, 0.2)}` : "none",
                    }}
                  >
                    {tag.tag}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-error text-[10px] font-bold uppercase tracking-widest">
            Couldn&apos;t reach the manga search service
          </p>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-[10px] font-bold uppercase tracking-widest border border-error/40 text-error px-3 py-1 rounded-lg hover:bg-error/10 transition-colors disabled:opacity-50"
          >
            {isFetching ? "Retrying…" : "Retry"}
          </button>
        </div>
      )}

      <div className="pt-10">
        {loading && !data ? (
          <MangaResultsGridSkeleton />
        ) : data ? (
          <div className={cn("transition-opacity duration-500", isFetching && "opacity-30")}>
            <MangaResultsGrid results={data} />

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-20 border-t border-border pt-10 pb-32">
                <button
                  onClick={() => { setCurrentPage(currentPage - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  disabled={!hasPrev || isFetching}
                  className="flex items-center gap-4 text-sm font-medium text-muted-foreground hover:text-primary disabled:opacity-0 transition-all"
                >
                  <span className="text-lg">←</span> Previous
                </button>
                <div className="flex items-center gap-6">
                  <span className="text-white/20 font-display font-black italic text-2xl">{currentPage} <span className="text-sm opacity-50">/ {totalPages}</span></span>
                </div>
                <button
                  onClick={() => { setCurrentPage(currentPage + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  disabled={!hasNext || isFetching}
                  className="flex items-center gap-4 text-sm font-medium text-muted-foreground hover:text-primary disabled:opacity-0 transition-all text-right"
                >
                  Next <span className="text-lg">→</span>
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
