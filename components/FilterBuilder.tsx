"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  useQueryState,
  parseAsString,
  parseAsStringLiteral,
  parseAsArrayOf,
  parseAsInteger,
  parseAsJson,
} from "nuqs";
import { useQuery } from "@tanstack/react-query";
import type { SearchFilter, SearchResponse } from "@/lib/types";
import { getFields, getFilterActions, getWatchlistTags, searchAnime } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { trackCoreAction } from "@/lib/analytics";
import { DEFAULT_FIELD_OPTIONS, DEFAULT_FILTER_ACTIONS } from "@/lib/filterMetadata";
import FilterRow from "./FilterRow";
import ResultsGrid, { ResultsGridSkeleton } from "./ResultsGrid";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Search, SlidersHorizontal, Trash2 } from "lucide-react";

const DEFAULT_FILTER: SearchFilter = {
  field: "members",
  action: "GREATER_THAN_OR_EQUALS",
  value: 100000,
};
const DEFAULT_PAGE_SIZE = 40;
const SINGLE_VALUE_OPTION_FIELDS = new Set(["type", "season"]);
const RELEVANCE_SORT_VALUE = "relevance";

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
  { value: RELEVANCE_SORT_VALUE, label: "Relevance" },
];

const SEASON_NAMES = ["winter", "spring", "summer", "fall"] as const;

// Don't surface seasons that haven't aired yet — month-based mapping matches
// MAL's quarterly buckets.
const currentSeasonIndex = (() => {
  const now = new Date();
  const month = now.getMonth();
  if (month < 3) return 0; // winter
  if (month < 6) return 1; // spring
  if (month < 9) return 2; // summer
  return 3; // fall
})();
const currentYear = new Date().getFullYear();

const SEASON_OPTIONS = Array.from({ length: 18 }, (_, i) => currentYear - i).flatMap((year) =>
  [...SEASON_NAMES].reverse().flatMap((season) => {
    const idx = SEASON_NAMES.indexOf(season);
    if (year === currentYear && idx > currentSeasonIndex) return [];
    return [{
      value: `${season}-${year}`,
      label: `${season[0].toUpperCase()}${season.slice(1)} ${year}`,
      season,
      year,
    }];
  })
);

import { resolveTagColor, toRgba } from "@/lib/watchStatus";

const filtersParser = parseAsJson<SearchFilter[]>((v) => {
  if (!Array.isArray(v)) return null;
  return v as SearchFilter[];
});

function normalizeFilter(filter: SearchFilter): SearchFilter {
  if (!SINGLE_VALUE_OPTION_FIELDS.has(filter.field)) {
    return filter;
  }

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

export default function FilterBuilder() {
  const { user } = useAuth();
  const [filters, setFilters] = useQueryState("af", filtersParser.withDefault([{ ...DEFAULT_FILTER }]));
  const [searchText, setSearchText] = useQueryState("q", parseAsString.withDefault(""));
  const [sortBy, setSortBy] = useQueryState("sort", parseAsString.withDefault("score"));
  const [selectedSeason, setSelectedSeason] = useQueryState("season", parseAsString.withDefault("any"));
  const [airing, setAiring] = useQueryState("airing", parseAsStringLiteral(["yes", "no", "any"] as const).withDefault("any"));
  const [selectedGenres, setSelectedGenres] = useQueryState("genres", parseAsArrayOf(parseAsString).withDefault([]));
  const [hideWatched, setHideWatched] = useQueryState("wt", parseAsArrayOf(parseAsString).withDefault([]));
  const [watchlistMode, setWatchlistMode] = useQueryState("wm", parseAsStringLiteral(["hide", "show"] as const).withDefault("hide"));
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
      // Owner analytics: a non-empty committed query is the discovery core
      // action. Debounced, so it fires once per settled search, not keystroke.
      if (value.trim()) trackCoreAction("anime_search");
    }, 300);
  };

  const [showAdvanced, setShowAdvanced] = useState(() =>
    normalizedFilters.some(isFilterValuePresent)
  );

  const resetPage = () => setCurrentPage(1);

  const { data: fields } = useQuery({
    queryKey: ["fields"],
    queryFn: getFields,
    initialData: DEFAULT_FIELD_OPTIONS,
  });

  const { data: actions } = useQuery({
    queryKey: ["filterActions"],
    queryFn: getFilterActions,
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

    const seasonOption = SEASON_OPTIONS.find((option) => option.value === selectedSeason);
    if (seasonOption) {
      allFilters.push(
        {
          field: "season",
          action: "EQUALS",
          value: seasonOption.season,
        },
        {
          field: "year",
          action: "EQUALS",
          value: seasonOption.year,
        }
      );
    }

    allFilters.push(...activeAdvancedFilters);

    return {
      filters: allFilters,
      opts: {
        pagesize,
        offset,
        sortBy: sortBy === RELEVANCE_SORT_VALUE ? undefined : sortBy || undefined,
        airing,
        hideWatched: watchlistMode === "hide" ? hideWatched : [],
        includeWatched: watchlistMode === "show" ? hideWatched : [],
      },
    };
  }, [
    activeAdvancedFilters,
    pagesize,
    offset,
    sortBy,
    airing,
    selectedGenres,
    selectedSeason,
    searchText,
    hideWatched,
    watchlistMode,
  ]);

  const filterKey = JSON.stringify(buildSearchOpts());

  const { data, isLoading: loading, isFetching, error, refetch } = useQuery<SearchResponse>({
    queryKey: ["search", filterKey],
    queryFn: () => {
      const { filters: f, opts } = buildSearchOpts();
      return searchAnime(f, opts);
    },
    placeholderData: (prev) => prev,
  });

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
    resetPage();
  };

  const toggleHideWatched = (status: string) => {
    setHideWatched((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
    resetPage();
  };

  const updateFilter = (index: number, filter: SearchFilter) => {
    setFilters((prev) =>
      prev.map((f, i) => (i === index ? normalizeFilter(filter) : f))
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
    setSelectedSeason("any");
    setAiring("any");
    setHideWatched([]);
    setWatchlistMode("hide");
    setPagesize(DEFAULT_PAGE_SIZE);
    setShowAdvanced(false);
    setCurrentPage(1);
  };

  const totalFiltered = data?.totalFiltered || 0;
  const totalPages = totalFiltered > 0 ? Math.ceil(totalFiltered / pagesize) : 0;
  const hasNext = currentPage < totalPages;
  const hasPrev = currentPage > 1;

  if (!fields || !actions) {
    return <ResultsGridSkeleton />;
  }

  return (
    <div className="space-y-10">
      {/* Top Controls: Search and Essential Selects */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-card p-5 rounded-lg border border-border shadow-sm">
        <div className="lg:col-span-4 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/20 group-focus-within:text-primary transition-colors" />
          <input
            placeholder="Search titles..."
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            className="w-full h-11 bg-surface border border-border pl-12 pr-4 text-sm font-medium text-white placeholder:text-white/20 focus:outline-none focus:border-primary transition-all rounded-lg"
          />
        </div>

        <div className="lg:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-2 block">Sort by</label>
          <Select
            value={sortBy || RELEVANCE_SORT_VALUE}
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

        <div className="lg:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-2 block">Season</label>
          <Select
            value={selectedSeason}
            onValueChange={(value) => { setSelectedSeason(value); resetPage(); }}
          >
            <SelectTrigger className="h-11 bg-surface border-border text-sm font-medium rounded-lg focus:border-primary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-surface-container-high border-border">
              <SelectItem value="any" className="text-[10px] font-bold uppercase tracking-widest">Any season</SelectItem>
              {SEASON_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-[10px] font-bold uppercase tracking-widest">
                  {option.label}
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
                : "bg-surface border-border text-white/60 hover:border-primary hover:text-white"
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

      {/* Filters Builder */}
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
                onChange={updateFilter}
                onRemove={removeFilter}
              />
            ))}
          </div>
        </div>
      )}

      {/* Quick Access Matrix (Genres & Status) */}
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
                      : "bg-surface-container-low border-border text-white/40 hover:border-white/20 hover:text-white"
                  )}
                >
                  {genre}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Status</span>
              <div className="h-px flex-1 bg-outline/5" />
            </div>
            <div className="flex gap-2 p-1 bg-surface-container-low border border-border rounded-lg">
              {["any", "yes", "no"].map((val) => {
                const labelMap = { any: "ALL", yes: "AIRING", no: "FINISHED" };
                const active = airing === val;
                return (
                  <button
                    key={val}
                    onClick={() => { setAiring(val as any); resetPage(); }}
                    className={cn(
                      "flex-1 py-3 min-h-11 text-sm font-medium transition-all rounded-lg",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-white/20 hover:text-white"
                    )}
                  >
                    {labelMap[val as keyof typeof labelMap]}
                  </button>
                );
              })}
            </div>
          </div>

          {user && watchlistTags.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Watchlist Filter</span>
                <div className="h-px flex-1 bg-outline/5" />
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="flex gap-1 p-1 bg-surface-container-low border border-border rounded-lg mr-2">
                  <button
                    onClick={() => { setWatchlistMode("hide"); resetPage(); }}
                    className={cn("px-4 py-1.5 text-[9px] font-black rounded-lg transition-all", watchlistMode === "hide" ? "bg-white/10 text-white" : "text-white/20")}
                  >
                    HIDE
                  </button>
                  <button
                    onClick={() => { setWatchlistMode("show"); resetPage(); }}
                    className={cn("px-4 py-1.5 text-[9px] font-black rounded-lg transition-all", watchlistMode === "show" ? "bg-white/10 text-white" : "text-white/20")}
                  >
                    ONLY
                  </button>
                </div>
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
                        boxShadow: active ? `0 0 10px ${toRgba(color, 0.2)}` : 'none'
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
      </div>

      {error && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-error text-[10px] font-bold uppercase tracking-widest">
            Couldn&apos;t reach the search service
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
          <ResultsGridSkeleton />
        ) : data ? (
          <div className={cn("transition-opacity duration-500", isFetching && "opacity-30")}>
            <ResultsGrid results={data} />
            
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-20 border-t border-border pt-10 pb-32">
                <button
                  onClick={() => { setCurrentPage(currentPage - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={!hasPrev || isFetching}
                  className="flex items-center gap-4 text-sm font-medium text-muted-foreground hover:text-primary disabled:opacity-0 transition-all"
                >
                  <span className="text-lg">←</span> Previous
                </button>
                <div className="flex items-center gap-6">
                  <span className="text-white/20 font-display font-black italic text-2xl">{currentPage} <span className="text-sm opacity-50">/ {totalPages}</span></span>
                </div>
                <button
                  onClick={() => { setCurrentPage(currentPage + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
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