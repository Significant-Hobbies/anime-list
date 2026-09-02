import { useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { SITE_NAME } from '@/lib/brand';
import { trackHomeSurfaceClick, trackHomepageVariantSeen } from '@/lib/engagement';
import { serializeFilters } from '@/lib/filterSerialization';
import { homeVariant } from '@/lib/flags';
import type { SearchFilter } from '@/lib/types';

// score 8+, TV, finished airing — expressed in the params FilterBuilder reads
// (advanced `af` filters + `airing`), serialized with the shared wrapped form.
const TOP_TV_FILTERS: SearchFilter[] = [
  { field: 'score', action: 'GREATER_THAN_OR_EQUALS', value: 8 },
  { field: 'type', action: 'EQUALS', value: 'TV' },
];
const TOP_TV_HREF = `/search?af=${encodeURIComponent(
  serializeFilters(TOP_TV_FILTERS)
)}&airing=no&sort=score`;

const FEATURES = [
  {
    title: 'Filter across every dimension',
    body: 'Score, type, genre, theme, year, airing status, member count — stack operators (includes all/any, excludes, numeric comparisons) until the results match what you want. Filter state lives in the URL, so any query is shareable.',
  },
  {
    title: "A watchlist that's yours",
    body: 'Track titles as Watching, Completed, Deferred, Avoiding, or BRR. Private to your Google account, synced across sessions, and never sold.',
  },
  {
    title: 'Ranking that surfaces hidden gems',
    body: 'A log-scale popularity formula keeps mega-popular titles from burying everything else, so quality scores from smaller fandoms still get a fair shot.',
  },
];

const FAQ = [
  {
    q: `Where does the data come from?`,
    a: 'Catalog data comes from MyAnimeList through the public Tenrai API. We are not affiliated with MyAnimeList.net or Tenrai.',
  },
  {
    q: 'How often is it updated?',
    a: 'A daily sync at midnight UTC refreshes the current and previous anime seasons plus the top manga pages. A quarterly job re-scores the full catalog.',
  },
  {
    q: 'Do I need an account?',
    a: 'No — search, stats, and the schedule work fully signed-out. Sign in with Google only if you want a personal watchlist.',
  },
  {
    q: 'How many titles does Anime List cover?',
    a: 'Roughly 14,800 anime and 20,600 top manga titles — the slice of MyAnimeList that meets a quality bar on score, scored-by count, members, favorites, and year.',
  },
  {
    q: 'Is it free?',
    a: 'Yes. No paid tier, no ads. The point is to explore the catalog without anything in the way.',
  },
];

function HeroSection({ quizAboveFold }: { quizAboveFold: boolean }) {
  return (
    <section className="px-4 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
      <div className="mx-auto max-w-3xl text-center">
        <div data-home-react-copy>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
            Anime &amp; manga, indexed from MyAnimeList
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
            Find your next anime in 30 seconds.
          </h1>
          <p className="mt-5 mx-auto max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Filter 35,000+ anime and manga titles from MyAnimeList by score, genre, year, and
            members. Free, no sign-up to search, private watchlist if you want one.
          </p>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/search"
            onClick={() => trackHomeSurfaceClick('search', 'hero')}
            className="inline-flex min-h-10 items-center rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            Filter the catalog
          </Link>
          <Link
            to="/discover"
            onClick={() => trackHomeSurfaceClick('discover', 'hero')}
            className="inline-flex min-h-10 items-center rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Browse the queue
          </Link>
          {quizAboveFold && (
            <Link
              to="/discover"
              hash="quiz"
              onClick={() => trackHomeSurfaceClick('quiz', 'hero')}
              className="inline-flex min-h-10 items-center rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Find your archetype
            </Link>
          )}
        </div>
        <CatalogPreview />
      </div>
    </section>
  );
}

function CatalogPreview() {
  return (
    <div
      className="mt-12 overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm"
      aria-label="Illustrative Anime List search query"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <p className="text-xs font-medium text-muted-foreground">Illustrative catalog query</p>
        <p className="text-xs text-muted-foreground">Filters stay in the URL</p>
      </div>
      <div className="grid md:grid-cols-[14rem_minmax(0,1fr)]">
        <div className="border-b border-border p-4 md:border-b-0 md:border-r sm:p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Stacked filters
          </p>
          <ul className="mt-4 flex flex-wrap gap-2 md:grid">
            {['Score ≥ 8', 'Type is TV', 'Finished airing', 'Sort by score'].map((filter) => (
              <li
                key={filter}
                className="rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground"
              >
                {filter}
              </li>
            ))}
          </ul>
        </div>
        <div>
          {[
            ['01', 'Monster', '8.89', 'Drama · Mystery · Suspense'],
            ['02', 'Hajime no Ippo', '8.78', 'Sports'],
            ['03', 'Cowboy Bebop', '8.75', 'Action · Award Winning · Sci-Fi'],
          ].map(([rank, title, score, genres], index) => (
            <div
              key={rank}
              className={`grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:px-5 ${index > 0 ? 'border-t border-border' : ''}`}
            >
              <span className="font-mono text-xs text-muted-foreground">{rank}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{title}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{genres}</p>
              </div>
              <span className="rounded-md bg-primary/10 px-2 py-1 font-mono text-xs font-semibold text-primary">
                {score}
              </span>
            </div>
          ))}
          <p className="border-t border-border px-4 py-3 text-xs leading-5 text-muted-foreground sm:px-5">
            Sample catalog entries from the checked-in MyAnimeList-derived dataset. Open the query
            for current results and scores.
          </p>
        </div>
      </div>
    </div>
  );
}

function FeaturesSection() {
  return (
    <section className="px-4 sm:px-6 py-16 border-t border-border">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          What you get
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-base font-semibold text-foreground">{f.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TryItSection() {
  return (
    <section className="px-4 sm:px-6 py-16 border-t border-border">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Try it without signing up
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Filter rows stack into a single query. Results, stats, and your watchlist all read from
          the same URL state — every query is shareable.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <a
            href={TOP_TV_HREF}
            onClick={() => trackHomeSurfaceClick('search', 'top_tv_card')}
            className="rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-foreground/30"
          >
            <p className="text-sm font-medium text-foreground">Top-rated TV anime</p>
            <p className="mt-1 text-xs text-muted-foreground">score 8+, finished airing</p>
          </a>
          <Link
            to="/discover"
            onClick={() => trackHomeSurfaceClick('discover', 'card')}
            className="rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-foreground/30"
          >
            <p className="text-sm font-medium text-foreground">Currently airing queue</p>
            <p className="mt-1 text-xs text-muted-foreground">this season, sorted for you</p>
          </Link>
          <Link
            to="/stats"
            onClick={() => trackHomeSurfaceClick('stats', 'card')}
            className="rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-foreground/30"
          >
            <p className="text-sm font-medium text-foreground">Catalog stats</p>
            <p className="mt-1 text-xs text-muted-foreground">14,800+ anime, score distribution</p>
          </Link>
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="px-4 sm:px-6 py-16 border-t border-border">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Frequently asked
        </h2>
        <div className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
          {FAQ.map((item) => (
            <details key={item.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-foreground">
                <span>{item.q}</span>
                <span
                  aria-hidden
                  className="text-muted-foreground transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FooterCta() {
  return (
    <section className="px-4 sm:px-6 py-20 border-t border-border">
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-8 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Find your next title.
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          No sign-up needed to start. Sign in later if you want a watchlist.
        </p>
        <Link
          to="/search"
          onClick={() => trackHomeSurfaceClick('search', 'footer_cta')}
          className="mt-6 inline-flex min-h-10 items-center rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          Open {SITE_NAME}
        </Link>
      </div>
    </section>
  );
}

export default function HomePage() {
  // A/B test: 50/50 cookie-based split (control = current layout,
  // treatment = quiz CTA above the fold). See lib/flags.ts +
  // PROJECT_STATUS.md "Engagement measurement".
  const quizAboveFold = homeVariant() === 'treatment';

  // Fire the variant impression once per mount so PostHog can build the
  // experiment funnel (variant seen -> surface click -> conversion).
  useEffect(() => {
    trackHomepageVariantSeen(quizAboveFold ? 'treatment' : 'control');
  }, [quizAboveFold]);

  return (
    <div className="-mt-8 -mx-4 sm:-mx-6">
      <HeroSection quizAboveFold={quizAboveFold} />
      <FeaturesSection />
      <TryItSection />
      <FaqSection />
      <FooterCta />
    </div>
  );
}
