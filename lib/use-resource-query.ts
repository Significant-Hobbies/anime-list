import { createResourceClient, useResource } from '@saas-maker/ui/lib/use-resource';
import { hashKey, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useAuth } from './auth';

const publicResources = createResourceClient();
type ResourceClient = ReturnType<typeof createResourceClient>;
const caches = new WeakMap<
  QueryClient,
  {
    client: ResourceClient;
    reads: Map<string, { client: ResourceClient; key: string }>;
    writing: Set<string>;
  }
>();

/** Keep existing mutation invalidation and optimistic updates on the same data. */
function cacheFor(queryClient: QueryClient) {
  let cache = caches.get(queryClient);
  if (!cache) {
    cache = { client: createResourceClient(), reads: new Map(), writing: new Set() };
    caches.set(queryClient, cache);
    const current = cache;
    queryClient.getQueryCache().subscribe((event) => {
      const read = current.reads.get(event.query.queryHash);
      if (!read || current.writing.has(event.query.queryHash) || event.type !== 'updated') return;
      if (event.action.type === 'invalidate') {
        // A mutation must not dedupe against a read started before its write.
        // mutate preserves the cached value and cancels the pending read.
        if (read.client.entry(read.key).promise) {
          read.client.mutate(read.key, (previous: unknown) => previous);
        }
        read.client.invalidate(read.key);
        // Resource entries own staleness; allow the next mutation to dispatch
        // another invalidation while this refresh is still pending.
        event.query.setState({ isInvalidated: false });
      }
      if (event.action.type === 'success' && event.action.manual) {
        read.client.mutate(read.key, event.query.state.data);
      }
    });
  }
  return cache;
}

function isPublic(key: QueryKey) {
  const name = key[0] === 'manga' ? key[1] : key[0];
  return ['stats', 'search', 'fields', 'filterActions', 'changelog'].includes(String(name));
}

type Options<T> = {
  queryKey: QueryKey;
  queryFn: (context: { signal: AbortSignal }) => Promise<T>;
  enabled?: boolean;
  initialData?: T;
  placeholderData?: (previous: T | undefined) => T | undefined;
  staleTime?: number;
};

/** useResource owns reads, retries, dedupe and navigation caching. */
export function useResourceQuery<T>(options: Options<T>) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const cache = cacheFor(queryClient);
  const hash = hashKey(options.queryKey);
  const enabled = options.enabled !== false;
  const client = isPublic(options.queryKey) ? publicResources : cache.client;
  const key = `${user?.id ?? 'guest'}:${hash}`;
  cache.reads.set(hash, { client, key });

  const resource = useResource<T>(
    enabled ? key : `disabled:${key}`,
    async (signal) => {
      const data = await options.queryFn({ signal });
      if (!signal.aborted) {
        cache.writing.add(hash);
        try {
          queryClient.setQueryData(options.queryKey, data);
        } finally {
          cache.writing.delete(hash);
        }
      }
      return data;
    },
    {
      client,
      initialData: options.initialData,
      staleTime: enabled ? (options.staleTime ?? 30_000) : Infinity,
      cacheTime: 10 * 60_000,
      revalidateOnFocus: false,
      isEmpty: (data) => {
        if (Array.isArray(data)) return data.length === 0;
        if (!data || typeof data !== 'object') return false;
        if ('filteredList' in data && Array.isArray(data.filteredList))
          return data.filteredList.length === 0;
        if ('items' in data && Array.isArray(data.items)) return data.items.length === 0;
        if ('totalAnime' in data) return data.totalAnime === 0;
        return false;
      },
    }
  );

  // Register even an unmounted read for prefix invalidation after a mutation.
  useEffect(() => {
    if (!enabled) return;
    queryClient.getQueryCache().build(queryClient, { queryKey: options.queryKey });
    if (
      resource.data !== undefined &&
      queryClient.getQueryData(options.queryKey) !== resource.data
    ) {
      cache.writing.add(hash);
      try {
        queryClient.setQueryData(options.queryKey, resource.data);
      } finally {
        cache.writing.delete(hash);
      }
    }
  }, [queryClient, hash, enabled, resource.data]);

  const previous = useRef<{ queryClient: QueryClient; data: T | undefined }>({
    queryClient,
    data: undefined,
  });
  const data = enabled
    ? (resource.data ??
      (previous.current.queryClient === queryClient
        ? options.placeholderData?.(previous.current.data)
        : undefined))
    : undefined;
  useEffect(() => {
    previous.current = { queryClient, data };
  }, [queryClient, data]);

  return {
    ...resource,
    data,
    error: enabled ? resource.error : undefined,
    isLoading: enabled && resource.status === 'loading' && data === undefined,
    isFetching: enabled && (resource.status === 'loading' || resource.isRevalidating),
    isError: enabled && resource.status === 'error',
    refetch: resource.retry,
  };
}
