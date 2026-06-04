"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
import {
  DEFAULT_ANIME_MIN_MEMBERS,
  DEFAULT_ANIME_PAGE_SIZE,
} from "@/lib/animeSearchDefaults";
import { DEFAULT_FIELD_OPTIONS, DEFAULT_FILTER_ACTIONS } from "@/lib/filterMetadata";
import FilterRow from "./FilterRow";
import ResultsGrid, { ResultsGridSkeleton } from "./ResultsGrid";
import {
  ANIME_SORT_OPTIONS,
  POPULARITY_PRESETS,
  QUICK_GENRES,
} from "./discover/constants";
import {
  ActiveFilterChip,
  DiscoverClearButton,
  DiscoverPanel,
  DiscoverSearchInput,
  DiscoverSelect,
  DiscoverToggleButton,
  FilterSection,
  GenrePills,
  SegmentedControl,
} from "./discover/ui";
import { cn } from "@/lib/utils";
import { resolveTagColor, toRgba } from "@/lib/watchStatus";

const DEFAULT_FILTER: SearchFilter = {
  field: "score",
  action: "GREATER_THAN_OR_EQUALS",
  value: 7,
};
const RELEVANCE_SORT_VALUE = "relevance";
const SINGLE_VALUE_OPTION_FIELDS = new Set(["type", "season"]);

const SEASON_NAMES = ["winter", "spring", "summer", "fall"] as const;

const currentSeasonIndex = (() => {
  const month = new Date().getMonth();
  if (month < 3) return 0;
  if (month < 6) return 1;
  if (month < 9) return 2;
  return 3;
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
  }),
);

const AIRING_OPTIONS = [
  { value: "any" as const, label: "All" },
  { value: "yes" as const, label: "Airing" },
  { value: "no" as const, label: "Finished" },
];

const filtersParser = parseAsJson<SearchFilter[]>((v) => {
  if (!Array.isArray(v)) return null;
  return v as SearchFilter[];
});

function normalizeFilter(filter: SearchFilter): SearchFilter {
  if (!SINGLE_VALUE_OPTION_FIELDS.has(filter.field)) return filter;
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

const ACTION_LABEL: Record<string, string> = {
  EQUALS: "=",
  GREATER_THAN: ">",
  GREATER_THAN_OR_EQUALS: "≥",
  LESS_THAN: "<",
  LESS_THAN_OR_EQUALS: "≤",
  INCLUDES_ALL: "includes",
  INCLUDES_ANY: "any of",
  EXCLUDES: "excl.",
  CONTAINS: "~",
};

function formatFilterChip(filter: SearchFilter): string {
  const words = filter.field.split("_");
  const field = [words[0][0].toUpperCase() + words[0].slice(1), ...words.slice(1)].join(" ");
  const op = ACTION_LABEL[filter.action] ?? filter.action.toLowerCase().replace(/_/g, " ");
  const value = Array.isArray(filter.value) ? filter.value.join(", ") : String(filter.value);
  return `${field} ${op} ${value}`;
}

type FilterBuilderProps = {
  initialSearchData?: SearchResponse;
  initialSearchKey?: string;
};

export default function FilterBuilder({
  initialSearchData,
  initialSearchKey,
}: FilterBuilderProps) {
  const { user } = useAuth();
  const [filters, setFilters] = useQueryState("af", filtersParser.withDefault([]));
  const [searchText, setSearchText] = useQueryState("q", parseAsString.withDefault(""));
  const [sortBy, setSortBy] = useQueryState("sort", parseAsString.withDefault("score"));
  const [selectedSeason, setSelectedSeason] = useQueryState("season", parseAsString.withDefault("any"));
  const [minMembers, setMinMembers] = useQueryState(
    "min",
    parseAsInteger.withDefault(DEFAULT_ANIME_MIN_MEMBERS),
  );
  const [airing, setAiring] = useQueryState(
    "airing",
    parseAsStringLiteral(["yes", "no", "any"] as const).withDefault("any"),
  );
  const [selectedGenres, setSelectedGenres] = useQueryState(
    "genres",
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [hideWatched, setHideWatched] = useQueryState(
    "wt",
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [watchlistMode, setWatchlistMode] = useQueryState(
    "wm",
    parseAsStringLiteral(["hide", "show"] as const).withDefault("hide"),
  );
  const [pagesize, setPagesize] = useQueryState(
    "pagesize",
    parseAsInteger.withDefault(DEFAULT_ANIME_PAGE_SIZE),
  );
  const [currentPage, setCurrentPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1),
  );

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
      if (value.trim()) trackCoreAction("anime_search");
    }, 300);
  };

  const [showAdvanced, setShowAdvanced] = useState(
    () => activeAdvancedFilters.length > 0,
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

    if (minMembers > 0) {
      allFilters.push({
        field: "members",
        action: "GREATER_THAN_OR_EQUALS",
        value: minMembers,
      });
    }

    const seasonOption = SEASON_OPTIONS.find((option) => option.value === selectedSeason);
    if (seasonOption) {
      allFilters.push(
        { field: "season", action: "EQUALS", value: seasonOption.season },
        { field: "year", action: "EQUALS", value: seasonOption.year },
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
    minMembers,
  ]);

  const filterKey = JSON.stringify(buildSearchOpts());

  const { data, isLoading: loading, isFetching, error, refetch } = useQuery<SearchResponse>({
    queryKey: ["search", filterKey],
    queryFn: () => {
      const { filters: f, opts } = buildSearchOpts();
      return searchAnime(f, opts);
    },
    initialData: filterKey === initialSearchKey ? initialSearchData : undefined,
    initialDataUpdatedAt: 0,
    placeholderData: (prev) => prev,
    retry: 1,
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
    setShowAdvanced(true);
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
    setMinMembers(DEFAULT_ANIME_MIN_MEMBERS);
    setAiring("any");
    setHideWatched([]);
    setWatchlistMode("hide");
    setPagesize(DEFAULT_ANIME_PAGE_SIZE);
    setShowAdvanced(false);
    setCurrentPage(1);
  };

  const popularityOptions = useMemo(
    () =>
      POPULARITY_PRESETS.map((p) => ({
        value: String(p.value),
        label: p.label,
      })),
    [],
  );

  const sortOptions = useMemo(
    () => ANIME_SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    [],
  );

  const seasonSelectOptions = useMemo(
    () => [
      { value: "any", label: "Any season" },
      ...SEASON_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    ],
    [],
  );

  const selectedSeasonLabel = seasonSelectOptions.find((o) => o.value === selectedSeason)?.label;
  const popularityLabel = POPULARITY_PRESETS.find((p) => p.value === minMembers)?.label;

  const hasActiveChips =
    searchText.trim().length > 0 ||
    selectedGenres.length > 0 ||
    selectedSeason !== "any" ||
    airing !== "any" ||
    minMembers !== DEFAULT_ANIME_MIN_MEMBERS ||
    activeAdvancedFilters.length > 0 ||
    hideWatched.length > 0;

  const totalFiltered = data?.totalFiltered || 0;
  const totalPages = totalFiltered > 0 ? Math.ceil(totalFiltered / pagesize) : 0;
  const hasNext = currentPage < totalPages;
  const hasPrev = currentPage > 1;
  const browsingMode = selectedSeasonLabel === "Any season"
    ? "All seasons"
    : selectedSeasonLabel;
  const resultLabel = data
    ? `${totalFiltered.toLocaleString()} titles`
    : "Catalog ready";

  if (!fields || !actions) {
    return <ResultsGridSkeleton />;
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-[radial-gradient(circle_at_top_left,rgba(129,140,248,0.24),transparent_34%),linear-gradient(135deg,rgba(24,24,27,0.96),rgba(9,9,11,0.98))] p-5 shadow-sm md:p-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              MAL Explorer
            </p>
            <h1 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight text-foreground md:text-5xl">
              Find the next anime worth your time.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              Start from proven crowd signal, then narrow by season, genre, status, and your own watchlist.
              The default shelf is intentionally biased toward highly watched, highly scored titles.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-background/60 p-4 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Now browsing</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{resultLabel}</p>
              </div>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {isFetching ? "Updating" : "Live"}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-white/[0.04] p-3">
                <p className="text-xs text-muted-foreground">Sort</p>
                <p className="mt-1 font-medium text-foreground">
                  {ANIME_SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Score"}
                </p>
              </div>
              <div className="rounded-lg bg-white/[0.04] p-3">
                <p className="text-xs text-muted-foreground">Season</p>
                <p className="mt-1 font-medium text-foreground">{browsingMode}</p>
              </div>
              <div className="rounded-lg bg-white/[0.04] p-3">
                <p className="text-xs text-muted-foreground">Popularity</p>
                <p className="mt-1 font-medium text-foreground">{popularityLabel ?? "Custom"}</p>
              </div>
              <div className="rounded-lg bg-white/[0.04] p-3">
                <p className="text-xs text-muted-foreground">Genres</p>
                <p className="mt-1 font-medium text-foreground">
                  {selectedGenres.length > 0 ? selectedGenres.slice(0, 2).join(", ") : "Any genre"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <DiscoverPanel className="bg-card/80">
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end">
          <DiscoverSearchInput
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Search anime titles…"
          />
          <DiscoverSelect
            label="Sort"
            value={sortBy || RELEVANCE_SORT_VALUE}
            onValueChange={(value) => {
              setSortBy(value);
              resetPage();
            }}
            options={sortOptions}
          />
          <DiscoverSelect
            label="Season"
            value={selectedSeason}
            onValueChange={(value) => {
              setSelectedSeason(value);
              resetPage();
            }}
            options={seasonSelectOptions}
            className="min-w-[160px]"
          />
          <DiscoverSelect
            label="Popularity"
            value={String(minMembers)}
            onValueChange={(value) => {
              setMinMembers(Number(value));
              resetPage();
            }}
            options={popularityOptions}
            className="min-w-[160px]"
          />
          <div className="flex gap-2 lg:pb-0.5">
            <DiscoverToggleButton
              active={showAdvanced}
              count={activeAdvancedFilters.length}
              onClick={() => setShowAdvanced(!showAdvanced)}
            />
            <DiscoverClearButton onClick={clearAll} />
          </div>
        </div>

        <div className="space-y-4 border-t border-border px-4 py-4">
          <FilterSection label="Genres">
            <GenrePills
              genres={QUICK_GENRES}
              selected={selectedGenres}
              onToggle={toggleGenre}
            />
          </FilterSection>

          <FilterSection label="Status">
            <SegmentedControl
              value={airing}
              options={AIRING_OPTIONS}
              onChange={(val) => {
                setAiring(val);
                resetPage();
              }}
            />
          </FilterSection>

          {user && watchlistTags.length > 0 && (
            <FilterSection label="List">
              <div className="flex flex-wrap items-center gap-2">
                <SegmentedControl
                  value={watchlistMode}
                  options={[
                    { value: "hide" as const, label: "Hide tagged" },
                    { value: "show" as const, label: "Only tagged" },
                  ]}
                  onChange={(val) => {
                    setWatchlistMode(val);
                    resetPage();
                  }}
                />
                {watchlistTags.map((tag) => {
                  const active = hideWatched.includes(tag.tag);
                  const color = resolveTagColor(tag.tag, tag.color);
                  return (
                    <button
                      key={tag.tag}
                      type="button"
                      onClick={() => toggleHideWatched(tag.tag)}
                      className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                      style={{
                        borderColor: active ? color : toRgba(color, 0.25),
                        backgroundColor: active ? toRgba(color, 0.15) : "transparent",
                        color: active ? color : toRgba(color, 0.7),
                      }}
                    >
                      {tag.tag}
                    </button>
                  );
                })}
              </div>
            </FilterSection>
          )}
        </div>

        {showAdvanced && (
          <div className="space-y-3 border-t border-border bg-muted/20 px-4 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Custom filters</p>
              <button
                type="button"
                onClick={addFilter}
                className="text-sm font-medium text-primary hover:text-primary/80"
              >
                Add filter
              </button>
            </div>
            {filters.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No custom filters yet. Add one to narrow by score, type, themes, and more.
              </p>
            ) : (
              <div className="space-y-2">
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
            )}
          </div>
        )}

        {hasActiveChips && (
          <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
            {searchText.trim() && (
              <ActiveFilterChip
                label={`Search: ${searchText.trim()}`}
                onRemove={() => {
                  setInputValue("");
                  setSearchText("");
                  resetPage();
                }}
              />
            )}
            {selectedGenres.map((genre) => (
              <ActiveFilterChip
                key={genre}
                label={genre}
                onRemove={() => toggleGenre(genre)}
              />
            ))}
            {selectedSeason !== "any" && selectedSeasonLabel && (
              <ActiveFilterChip
                label={selectedSeasonLabel}
                onRemove={() => {
                  setSelectedSeason("any");
                  resetPage();
                }}
              />
            )}
            {airing !== "any" && (
              <ActiveFilterChip
                label={AIRING_OPTIONS.find((o) => o.value === airing)?.label ?? airing}
                onRemove={() => {
                  setAiring("any");
                  resetPage();
                }}
              />
            )}
            {minMembers !== DEFAULT_ANIME_MIN_MEMBERS && popularityLabel && (
              <ActiveFilterChip
                label={popularityLabel}
                onRemove={() => {
                  setMinMembers(DEFAULT_ANIME_MIN_MEMBERS);
                  resetPage();
                }}
              />
            )}
            {activeAdvancedFilters.map((filter, i) => (
              <ActiveFilterChip
                key={`${filter.field}-${i}`}
                label={formatFilterChip(filter)}
                onRemove={() => removeFilter(i)}
              />
            ))}
            {hideWatched.map((tag) => (
              <ActiveFilterChip
                key={tag}
                label={`${watchlistMode === "hide" ? "Hide" : "Only"} ${tag}`}
                onRemove={() => toggleHideWatched(tag)}
              />
            ))}
          </div>
        )}
      </DiscoverPanel>

      {data && (
        <p className="text-sm text-muted-foreground">
          {totalFiltered.toLocaleString()} titles
          {isFetching && " · updating…"}
        </p>
      )}

      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">Couldn&apos;t reach the search service.</p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-sm font-medium text-destructive underline-offset-2 hover:underline disabled:opacity-50"
          >
            {isFetching ? "Retrying…" : "Retry"}
          </button>
        </div>
      )}

      <div>
        {loading && !data ? (
          <ResultsGridSkeleton />
        ) : data ? (
          <div className={cn("transition-opacity duration-300", isFetching && "opacity-50")}>
            <ResultsGrid results={data} />

            {totalPages > 1 && (
              <div className="mt-12 flex items-center justify-between border-t border-border pt-8 pb-16">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage(currentPage - 1);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  disabled={!hasPrev || isFetching}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
                >
                  ← Previous
                </button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage(currentPage + 1);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  disabled={!hasNext || isFetching}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
