'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryState, parseAsString, parseAsArrayOf, parseAsInteger } from 'nuqs';
import { useQuery } from '@tanstack/react-query';
import type { SearchFilter, SearchResponse } from '@/lib/types';
import {
  getMangaFields,
  getMangaFilterActions,
  getWatchlistTags,
  isAbortError,
  searchManga,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { trackCoreAction } from '@/lib/analytics';
import {
  DEFAULT_FILTER_ACTIONS,
  DEFAULT_MANGA_FIELD_OPTIONS,
  filtersParser,
} from '@/lib/filterMetadata';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import FilterRow from './FilterRow';
import MangaResultsGrid, { MangaResultsGridSkeleton } from './MangaResultsGrid';
import { MANGA_SORT_OPTIONS, POPULARITY_PRESETS, QUICK_GENRES } from './discover/constants';
import {
  ActiveFilterChip,
  DiscoverClearButton,
  DiscoverPanel,
  DiscoverSearchInput,
  DiscoverSelect,
  DiscoverToggleButton,
  FilterSection,
  GenrePills,
} from './discover/ui';
import { cn } from '@/lib/utils';
import { resolveTagColor, toRgba } from '@/lib/watchStatus';

const DEFAULT_FILTER: SearchFilter = {
  field: 'score',
  action: 'GREATER_THAN_OR_EQUALS',
  value: 7,
};
const SEARCH_QUERY_DEBOUNCE_MS = 150;
const DEFAULT_PAGE_SIZE = 40;
const DEFAULT_MIN_MEMBERS = 50_000;

function normalizeFilter(filter: SearchFilter): SearchFilter {
  if (filter.field !== 'type') return filter;
  const value = Array.isArray(filter.value)
    ? (filter.value[0] ?? '')
    : typeof filter.value === 'string'
      ? filter.value
      : '';
  return {
    ...filter,
    action: filter.action === 'EXCLUDES' ? 'EXCLUDES' : 'EQUALS',
    value,
  };
}

function isFilterValuePresent(filter: SearchFilter): boolean {
  const normalizedFilter = normalizeFilter(filter);
  if (Array.isArray(normalizedFilter.value)) {
    return normalizedFilter.value.length > 0;
  }
  return normalizedFilter.value !== '' && normalizedFilter.value !== undefined;
}

const ACTION_LABEL: Record<string, string> = {
  EQUALS: '=',
  GREATER_THAN: '>',
  GREATER_THAN_OR_EQUALS: '≥',
  LESS_THAN: '<',
  LESS_THAN_OR_EQUALS: '≤',
  INCLUDES_ALL: 'includes',
  INCLUDES_ANY: 'any of',
  EXCLUDES: 'excl.',
  CONTAINS: '~',
};

function formatFilterChip(filter: SearchFilter): string {
  const words = filter.field.split('_');
  const field = [words[0][0].toUpperCase() + words[0].slice(1), ...words.slice(1)].join(' ');
  const op = ACTION_LABEL[filter.action] ?? filter.action.toLowerCase().replace(/_/g, ' ');
  const value = Array.isArray(filter.value) ? filter.value.join(', ') : String(filter.value);
  return `${field} ${op} ${value}`;
}

export default function MangaFilterBuilder() {
  const { user } = useAuth();
  const [filters, setFilters] = useQueryState('mf', filtersParser.withDefault([]));
  const [searchText, setSearchText] = useQueryState('q', parseAsString.withDefault(''));
  const [sortBy, setSortBy] = useQueryState('sort', parseAsString.withDefault('score'));
  const [minMembers, setMinMembers] = useQueryState(
    'min',
    parseAsInteger.withDefault(DEFAULT_MIN_MEMBERS)
  );
  const [selectedGenres, setSelectedGenres] = useQueryState(
    'genres',
    parseAsArrayOf(parseAsString).withDefault([])
  );
  const [hideWatched, setHideWatched] = useQueryState(
    'wt',
    parseAsArrayOf(parseAsString).withDefault([])
  );
  const [pagesize, setPagesize] = useQueryState(
    'pagesize',
    parseAsInteger.withDefault(DEFAULT_PAGE_SIZE)
  );
  const [currentPage, setCurrentPage] = useQueryState('page', parseAsInteger.withDefault(1));

  const normalizedFilters = useMemo(() => filters.map(normalizeFilter), [filters]);
  const activeAdvancedFilters = useMemo(
    () => normalizedFilters.filter(isFilterValuePresent),
    [normalizedFilters]
  );

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
      if (value.trim()) trackCoreAction('manga_search');
    }, 300);
  };

  // Open whenever any custom filter row exists (even one with an empty value),
  // so reloading a URL with in-progress rows doesn't hide them.
  const [showAdvanced, setShowAdvanced] = useState(() => filters.length > 0);

  const resetPage = () => {
    if (currentPage !== 1) setCurrentPage(1);
  };

  const { data: fields } = useQuery({
    queryKey: ['manga', 'fields'],
    queryFn: getMangaFields,
    initialData: DEFAULT_MANGA_FIELD_OPTIONS,
  });

  const { data: actions } = useQuery({
    queryKey: ['manga', 'filterActions'],
    queryFn: getMangaFilterActions,
    initialData: DEFAULT_FILTER_ACTIONS,
  });

  const { data: watchlistTagsData } = useQuery({
    queryKey: ['watchlist', 'tags'],
    queryFn: () => getWatchlistTags(),
    enabled: !!user,
  });

  const watchlistTags = watchlistTagsData?.tags ?? [];
  const offset = (currentPage - 1) * pagesize;

  const buildSearchOpts = useCallback(() => {
    const allFilters: SearchFilter[] = [];

    if (selectedGenres.length > 0) {
      allFilters.push({
        field: 'genres',
        action: 'INCLUDES_ALL',
        value: selectedGenres,
      });
    }

    if (searchText.trim()) {
      allFilters.push({
        field: 'title',
        action: 'CONTAINS',
        value: searchText.trim(),
      });
    }

    if (minMembers > 0) {
      allFilters.push({
        field: 'members',
        action: 'GREATER_THAN_OR_EQUALS',
        value: minMembers,
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
  }, [
    activeAdvancedFilters,
    pagesize,
    offset,
    sortBy,
    selectedGenres,
    searchText,
    hideWatched,
    minMembers,
  ]);

  const searchRequest = useMemo(() => buildSearchOpts(), [buildSearchOpts]);
  const filterKey = useMemo(() => JSON.stringify(searchRequest), [searchRequest]);
  const debouncedFilterKey = useDebouncedValue(filterKey, SEARCH_QUERY_DEBOUNCE_MS);
  const debouncedSearchRequest = useMemo(
    () => JSON.parse(debouncedFilterKey) as ReturnType<typeof buildSearchOpts>,
    [debouncedFilterKey]
  );

  const {
    data,
    isLoading: loading,
    isFetching,
    error,
    refetch,
  } = useQuery<SearchResponse>({
    queryKey: ['manga', 'search', debouncedFilterKey],
    queryFn: ({ signal }) => {
      const { filters: f, opts } = debouncedSearchRequest;
      return searchManga(f, opts, signal);
    },
    placeholderData: (prev) => prev,
    retry: (failureCount, error) => !isAbortError(error) && failureCount < 1,
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
    setFilters((prev) => prev.map((f, i) => (i === index ? normalizeFilter(filter) : f)));
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
    setInputValue('');
    setSelectedGenres([]);
    setSearchText('');
    setFilters([]);
    setSortBy('score');
    setMinMembers(DEFAULT_MIN_MEMBERS);
    setHideWatched([]);
    setPagesize(DEFAULT_PAGE_SIZE);
    setShowAdvanced(false);
    setCurrentPage(1);
  };

  const popularityOptions = useMemo(
    () =>
      POPULARITY_PRESETS.map((p) => ({
        value: String(p.value),
        label: p.label,
      })),
    []
  );

  const sortOptions = useMemo(
    () => MANGA_SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    []
  );

  const popularityLabel = POPULARITY_PRESETS.find((p) => p.value === minMembers)?.label;

  const hasActiveChips =
    searchText.trim().length > 0 ||
    selectedGenres.length > 0 ||
    minMembers !== DEFAULT_MIN_MEMBERS ||
    activeAdvancedFilters.length > 0 ||
    hideWatched.length > 0;

  const totalFiltered = data?.totalFiltered || 0;
  const totalPages = totalFiltered > 0 ? Math.ceil(totalFiltered / pagesize) : 0;
  const hasNext = currentPage < totalPages;
  const hasPrev = currentPage > 1;

  if (!fields || !actions) {
    return <MangaResultsGridSkeleton />;
  }

  return (
    <div className="space-y-6">
      <DiscoverPanel>
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end">
          <DiscoverSearchInput
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Search manga titles…"
          />
          <DiscoverSelect
            label="Sort"
            value={sortBy}
            onValueChange={(value) => {
              setSortBy(value);
              resetPage();
            }}
            options={sortOptions}
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
            <GenrePills genres={QUICK_GENRES} selected={selectedGenres} onToggle={toggleGenre} />
          </FilterSection>

          {user && watchlistTags.length > 0 && (
            <FilterSection label="Hide">
              <div className="flex flex-wrap gap-2">
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
                        backgroundColor: active ? toRgba(color, 0.15) : 'transparent',
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
                No custom filters yet. Add one to narrow by score, type, chapters, and more.
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
                    mediaType="manga"
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
                  setInputValue('');
                  setSearchText('');
                  resetPage();
                }}
              />
            )}
            {selectedGenres.map((genre) => (
              <ActiveFilterChip key={genre} label={genre} onRemove={() => toggleGenre(genre)} />
            ))}
            {minMembers !== DEFAULT_MIN_MEMBERS && popularityLabel && (
              <ActiveFilterChip
                label={popularityLabel}
                onRemove={() => {
                  setMinMembers(DEFAULT_MIN_MEMBERS);
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
                label={`Hide ${tag}`}
                onRemove={() => toggleHideWatched(tag)}
              />
            ))}
          </div>
        )}
      </DiscoverPanel>

      {data && (
        <p className="text-sm text-muted-foreground">
          {totalFiltered.toLocaleString()} titles
          {isFetching && ' · updating…'}
        </p>
      )}

      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">Couldn&apos;t reach the manga search service.</p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-sm font-medium text-destructive underline-offset-2 hover:underline disabled:opacity-50"
          >
            {isFetching ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}

      <div>
        {loading && !data ? (
          <MangaResultsGridSkeleton />
        ) : data ? (
          <div className={cn('transition-opacity duration-300', isFetching && 'opacity-50')}>
            <MangaResultsGrid results={data} />

            {totalPages > 1 && (
              <div className="mt-12 flex items-center justify-between border-t border-border pt-8 pb-16">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage(currentPage - 1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
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
                    window.scrollTo({ top: 0, behavior: 'smooth' });
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
