import { useRouterState } from '@tanstack/react-router';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type SkeletonProps = ComponentProps<'div'>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('rounded-md bg-muted/70 motion-safe:animate-pulse', className)}
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

  return (
    <div className="fixed inset-x-0 top-14 z-[60] h-0.5 overflow-hidden" aria-hidden="true">
      <div className="h-full w-1/3 animate-[route-progress_1.1s_ease-in-out_infinite] bg-primary shadow-[0_0_12px_rgba(129,140,248,0.75)] motion-reduce:w-full motion-reduce:animate-none" />
    </div>
  );
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
    <span
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-primary motion-safe:animate-pulse"
      />
      {label}
    </span>
  );
}

function CatalogCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-[2/3] rounded-lg" />
      <div className="mt-3 space-y-2">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-1/2 bg-muted/45" />
      </div>
    </div>
  );
}

export function CatalogGridSkeleton({ label = 'Loading catalog' }: { label?: string }) {
  return (
    <section aria-busy="true" aria-label={label} className="space-y-5">
      <LoadingStatus label={label} />
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16 bg-muted/45" />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, index) => (
          <CatalogCardSkeleton key={index} />
        ))}
      </div>
    </section>
  );
}

export function StatsGridSkeleton({ label = 'Loading statistics' }: { label?: string }) {
  return (
    <section aria-busy="true" aria-label={label} className="grid gap-4 md:grid-cols-2">
      <LoadingStatus label={label} />
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="rounded-xl border border-border bg-card/50 p-5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-4 h-28 w-full bg-muted/45" />
          <Skeleton className="mt-4 h-3 w-2/3 bg-muted/45" />
        </div>
      ))}
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
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading page"
      className="space-y-8"
    >
      <div className="space-y-3">
        <Skeleton className="h-3 w-20 bg-primary/25" />
        <Skeleton className="h-10 w-3/5 max-w-lg" />
        <Skeleton className="h-4 w-4/5 max-w-2xl bg-muted/45" />
      </div>
      <div className="rounded-2xl border border-border bg-card/50 p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-11" />
          <Skeleton className="h-11 bg-muted/45" />
          <Skeleton className="h-11 bg-muted/45" />
        </div>
        <Skeleton className="mt-5 h-24 bg-muted/45" />
      </div>
      <CatalogGridSkeleton />
    </div>
  );
}
