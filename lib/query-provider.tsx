'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * Single QueryClient for the whole app, created once at module scope.
 *
 * The provider must wrap the entire router, not just the data-heavy `appRoute`
 * subtree: RootLayout renders <Footer /> (which calls useQuery) on every route,
 * and the changelog/about/privacy/terms routes live directly under the root
 * route. Scoping the provider to `appRoute` left those trees without a
 * QueryClient and crashed prod with "No QueryClient set".
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
