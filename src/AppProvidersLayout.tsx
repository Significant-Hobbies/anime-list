import { Outlet } from '@tanstack/react-router';
import { NuqsAdapter } from 'nuqs/adapters/tanstack-router';

/**
 * Adds nuqs URL-state for the data-heavy routes that need it.
 * TanStack Query lives at the app root (see main.tsx) because Footer and the
 * top-level routes also call useQuery, so the QueryClient can't be scoped here.
 */
export default function AppProvidersLayout() {
  return (
    <NuqsAdapter>
      <Outlet />
    </NuqsAdapter>
  );
}
