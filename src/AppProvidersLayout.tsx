import { Outlet } from '@tanstack/react-router';
import { NuqsAdapter } from 'nuqs/adapters/tanstack-router';
import { QueryProvider } from '@/lib/query-provider';

/**
 * Adds query caching and nuqs URL-state only for data-heavy routes.
 */
export default function AppProvidersLayout() {
  return (
    <QueryProvider>
      <NuqsAdapter>
        <Outlet />
      </NuqsAdapter>
    </QueryProvider>
  );
}
