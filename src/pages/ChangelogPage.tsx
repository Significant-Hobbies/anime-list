import { useEffect } from 'react';

const RELEASES = [
  {
    date: '2026-07-25',
    title: 'Agent-ready catalog access',
    outcomes: [
      'Added a documented MCP setup page for searching the public catalog and reading a signed-in watchlist.',
      'Personal access tokens can be created, viewed once, and revoked without exposing account credentials.',
    ],
  },
  {
    date: '2026-07-17',
    title: 'Anime and manga pages became easier to discover',
    outcomes: [
      'Thousands of title pages gained unique search and social metadata, readable summaries, and structured data.',
      'Chunked anime and manga sitemaps now cover the qualifying public catalog.',
    ],
  },
  {
    date: '2026-07-11',
    title: 'Faster, steadier search',
    outcomes: [
      'Anime and manga searches now cancel stale requests and avoid showing results from an older query.',
      'Simple numeric filters use a faster catalog path, while background refresh failures no longer take search down.',
    ],
  },
  {
    date: '2026-06-20',
    title: 'Watchlists, alerts, and public collections',
    outcomes: [
      'Watchlists can be imported or exported with a conflict preview before anything changes.',
      'Saved searches can surface new matches in-app, and curated collections can be published with a shareable link.',
    ],
  },
] as const;

const REPOSITORY = 'https://github.com/Significant-Hobbies/anime-list';

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function ChangelogPage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Changelog | Shelf';

    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <header className="max-w-2xl">
        <p className="text-sm font-medium text-primary">Shelf product history</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Changelog</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Meaningful improvements to discovery, personal lists, and catalog reliability. Catalog
          ingestion has its own separate update feed.
        </p>
        <nav className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Project links">
          <a className="text-primary hover:underline" href={`${REPOSITORY}/issues`}>
            Roadmap
          </a>
          <a className="text-primary hover:underline" href={REPOSITORY}>
            Source
          </a>
          <a className="text-primary hover:underline" href="/catalog-updates">
            Catalog updates
          </a>
        </nav>
      </header>

      <ol className="mt-12 space-y-5">
        {RELEASES.map((release) => (
          <li key={`${release.date}-${release.title}`}>
            <article className="rounded-xl border border-border bg-card p-5 sm:p-6">
              <time className="text-xs font-medium text-muted-foreground" dateTime={release.date}>
                {formatDate(release.date)}
              </time>
              <h2 className="mt-2 text-lg font-semibold text-foreground">{release.title}</h2>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                {release.outcomes.map((outcome) => (
                  <li key={outcome} className="flex gap-3">
                    <span className="text-primary" aria-hidden="true">
                      •
                    </span>
                    <span>{outcome}</span>
                  </li>
                ))}
              </ul>
            </article>
          </li>
        ))}
      </ol>
    </div>
  );
}
