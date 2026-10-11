import { Skeleton as LibrarySkeleton } from '@saas-maker/ui/components/skeleton';
import { useRouterState } from '@tanstack/react-router';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { Card } from './card';

type SkeletonProps = ComponentProps<'div'>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <LibrarySkeleton
      aria-hidden="true"
      className={cn('motion-safe:animate-none animate-none bg-muted/70', className)}
      {...props}
    />
  );
}

export function LoadingStatus({ label }: { label: string }) {
  return (
    <span className="sr-only" role="status" aria-live="polite">
      {label}
    </span>
  );
}

export function RouteProgress() {
  const isLoading = useRouterState({ select: (state) => state.isLoading });

  if (!isLoading) return null;

  return <div className="fixed inset-x-0 top-14 z-[60] h-0.5 bg-primary/40" aria-hidden="true" />;
}

export function RefreshIndicator({
  active,
  label = 'Updating content',
}: {
  active: boolean;
  label?: string;
}) {
  if (!active) return null;

  return (
    <span className="sr-only" role="status" aria-live="polite">
      {label.toLowerCase()}
    </span>
  );
}

function CatalogCardSkeleton({ manga = false }: { manga?: boolean }) {
  return (
    <div>
      <Skeleton className="aspect-[2/3] rounded-sm" />
      <div className={manga ? 'mt-3 space-y-1' : 'mt-4 space-y-1'}>
        <Skeleton className={manga ? 'h-10 w-4/5' : 'h-11 w-4/5'} />
        <Skeleton className={manga ? 'h-3.5 w-1/2 bg-muted/45' : 'h-8 w-1/2 bg-muted/45'} />
      </div>
    </div>
  );
}

export function CatalogGridSkeleton({
  label = 'loading catalog',
  manga = false,
}: {
  label?: string;
  manga?: boolean;
}) {
  return (
    <section aria-busy="true" aria-label={label} className="space-y-5">
      <LoadingStatus label={label} />
      <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, index) => (
          <CatalogCardSkeleton key={index} manga={manga} />
        ))}
      </div>
    </section>
  );
}

function StatsChartSkeleton({ distribution }: { distribution: boolean }) {
  return (
    <Card className={cn('gap-0 p-4', distribution ? 'h-56' : 'h-96')}>
      <Skeleton className="h-5 w-28 mb-3" />
      <div className="space-y-1.5">
        {Array.from({ length: distribution ? 5 : 11 }).map((_, row) => (
          <div key={row} className="flex items-center gap-2">
            <Skeleton className="h-3 w-28 shrink-0" />
            <Skeleton className="h-5 flex-1 rounded-full bg-muted/45" />
            <Skeleton className="h-3 w-14 shrink-0" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function StatsGridSkeleton({ label = 'Loading statistics' }: { label?: string }) {
  return (
    <section aria-busy="true" aria-label={label} className="space-y-4">
      <LoadingStatus label={label} />
      <Skeleton className="h-5 w-28" />
      <div className="grid gap-4 lg:grid-cols-2">
        {[true, true, true, true, false, false, false, false].map((distribution, index) => (
          <StatsChartSkeleton key={index} distribution={distribution} />
        ))}
      </div>
      <Card className="h-64 gap-0 p-4">
        <Skeleton className="h-5 w-28 mb-3" />
        <Skeleton className="h-40 w-full bg-muted/45" />
      </Card>
    </section>
  );
}

export function ListSkeleton({
  label = 'Loading list',
  rows = 5,
}: {
  label?: string;
  rows?: number;
}) {
  return (
    <section aria-busy="true" aria-label={label} className="space-y-3">
      <LoadingStatus label={label} />
      <div className="flex gap-2 pb-2">
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full bg-muted/45" />
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 rounded-xl border border-border bg-card/50 p-4"
        >
          <Skeleton className="h-16 w-12 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-2/5 bg-muted/45" />
          </div>
          <Skeleton className="hidden h-8 w-20 rounded-full sm:block" />
        </div>
      ))}
    </section>
  );
}

/**
 * Compact-section shape for small bordered panels (token lists, side panels)
 * that resolve after authentication or a short fetch.
 */
export function CompactSectionSkeleton({
  label = 'Loading section',
  rows = 3,
}: {
  label?: string;
  rows?: number;
}) {
  return (
    <section
      aria-busy="true"
      aria-label={label}
      className="space-y-3 rounded-xl border border-border bg-card/50 p-6"
    >
      <LoadingStatus label={label} />
      <Skeleton className="h-4 w-40" />
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-3 w-full bg-muted/45" />
      ))}
    </section>
  );
}

export function TableSkeleton({ label = 'Loading table' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" aria-label={label} className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="grid grid-cols-[minmax(0,1fr)_6rem] gap-4 border-b border-border py-3"
        >
          <div className="space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5 bg-muted/45" />
          </div>
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
    </div>
  );
}

export function PageShellSkeleton() {
  return (
    <section
      data-page-placeholder
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="loading page"
    >
      <div data-placeholder-heading>
        <Skeleton data-placeholder-title />
        <Skeleton data-placeholder-description />
      </div>
      <div data-placeholder-grid>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} data-placeholder-card>
            <Skeleton data-placeholder-image />
            <Skeleton data-placeholder-card-title />
          </div>
        ))}
      </div>
    </section>
  );
}
