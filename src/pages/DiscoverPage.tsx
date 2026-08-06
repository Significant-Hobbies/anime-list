import { useState } from 'react';
import { DiscoveryQueue } from '@/components/DiscoveryQueue';
import AnimeIdentityQuiz from '@/components/AnimeIdentityQuiz';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { cn } from '@/lib/utils';

type DiscoveryPanel = 'queue' | 'quiz';

function initialPanelFromLocation(): DiscoveryPanel {
  if (typeof window !== 'undefined' && window.location.hash === '#quiz') return 'quiz';
  return 'queue';
}

export default function DiscoverPage({ initialPanel }: { initialPanel?: DiscoveryPanel }) {
  const [panel, setPanel] = useState<DiscoveryPanel>(initialPanel ?? initialPanelFromLocation);

  const selectPanel = (nextPanel: DiscoveryPanel) => {
    setPanel(nextPanel);
    const nextUrl = nextPanel === 'quiz' ? '/discover#quiz' : '/discover';
    window.history.replaceState(window.history.state, '', nextUrl);
  };

  return (
    <div className="mx-auto max-w-6xl py-4 sm:py-8">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Discover</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
          Work through a weekly queue shaped by your watchlist, or answer four private questions for
          a quick taste profile.
        </p>
      </header>

      <div
        className="mt-8 inline-flex rounded-lg border border-border bg-muted/40 p-1"
        role="tablist"
        aria-label="Discovery tools"
      >
        {(
          [
            ['queue', 'Weekly queue'],
            ['quiz', 'Taste quiz'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={panel === value}
            aria-controls={`discover-${value}`}
            onClick={() => selectPanel(value)}
            className={cn(
              'min-h-10 rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              panel === value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <section
        id={`discover-${panel}`}
        role="tabpanel"
        className="mt-8"
        aria-label={panel === 'queue' ? 'Weekly discovery queue' : 'Anime taste quiz'}
      >
        {panel === 'queue' ? (
          <ErrorBoundary>
            <DiscoveryQueue />
          </ErrorBoundary>
        ) : (
          <div>
            <div className="mb-8 max-w-3xl">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Find your anime archetype
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Nothing is stored, no social profile is scraped, and the result only opens an
                existing anime search.
              </p>
            </div>
            <AnimeIdentityQuiz />
          </div>
        )}
      </section>
    </div>
  );
}
