'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { useAuth } from './auth';

/**
 * Detail responses contain private watchlist status and notes. Keep both the
 * query cache and descendant drafts scoped to the current signed-in account.
 */
function AccountQueries({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 10 * 60 * 1000, // 10 minutes
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <AccountQueries key={user ? `user:${user.id}` : 'guest'}>{children}</AccountQueries>;
}
