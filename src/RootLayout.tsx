import { Suspense, lazy, useEffect } from 'react';
import { Outlet, useRouterState } from '@tanstack/react-router';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { AuthProvider } from '@/lib/auth';
import { AnalyticsProvider } from '@/components/posthog-provider';
import { PageShellSkeleton, RouteProgress } from '@/components/ui/loading-state';

const FeedbackWidgetWrapper = lazy(() => import('@/components/FeedbackWidgetWrapper'));

export default function RootLayout() {
  const isHome = useRouterState({ select: (state) => state.location.pathname === '/' });

  useEffect(() => {
    document.documentElement.toggleAttribute('data-home', isHome);
  }, [isHome]);

  return (
    <AnalyticsProvider>
      <AuthProvider>
        <div className="flex min-h-dvh flex-col">
          <Navigation />
          <RouteProgress />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-12 pt-8 sm:px-6">
            <Suspense fallback={<PageShellSkeleton />}>
              <Outlet />
            </Suspense>
          </main>
          <Footer />
          <Suspense fallback={null}>
            <FeedbackWidgetWrapper />
          </Suspense>
        </div>
      </AuthProvider>
    </AnalyticsProvider>
  );
}
