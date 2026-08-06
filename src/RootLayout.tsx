import { Suspense, lazy } from 'react';
import { Outlet } from '@tanstack/react-router';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { AuthProvider } from '@/lib/auth';
import { AnalyticsProvider } from '@/components/posthog-provider';

const FeedbackWidgetWrapper = lazy(() => import('@/components/FeedbackWidgetWrapper'));

function RouteFallback() {
  return (
    <div className="min-h-screen space-y-6" role="status" aria-live="polite">
      <section className="min-h-[264px] rounded-2xl border border-border bg-card p-5 md:p-7">
        <div className="grid animate-pulse gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div className="space-y-4">
            <div className="h-3 w-24 rounded bg-primary/25" />
            <div className="h-12 w-2/3 max-w-xl rounded bg-muted" />
            <div className="space-y-2">
              <div className="h-4 w-full max-w-2xl rounded bg-muted/70" />
              <div className="h-4 w-4/5 max-w-xl rounded bg-muted/70" />
            </div>
          </div>
          <div className="h-48 rounded-xl border border-border bg-background/60 p-4">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="mt-3 h-7 w-32 rounded bg-muted" />
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="h-14 rounded-lg bg-muted/60" />
              <div className="h-14 rounded-lg bg-muted/60" />
            </div>
          </div>
        </div>
      </section>
      <section className="min-h-64 animate-pulse rounded-xl border border-border bg-card p-4">
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="h-10 rounded-lg bg-muted" />
          <div className="h-10 rounded-lg bg-muted/70" />
          <div className="h-10 rounded-lg bg-muted/70" />
          <div className="h-10 rounded-lg bg-muted/70" />
        </div>
        <div className="mt-6 h-4 w-2/3 rounded bg-muted/60" />
        <div className="mt-4 h-24 rounded-lg bg-muted/50" />
      </section>
      <span className="sr-only">Loading page…</span>
    </div>
  );
}

export default function RootLayout() {
  return (
    <AnalyticsProvider>
      <AuthProvider>
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-24 pt-8">
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </main>
        <Footer />
        <Suspense fallback={null}>
          <FeedbackWidgetWrapper />
        </Suspense>
      </AuthProvider>
    </AnalyticsProvider>
  );
}
