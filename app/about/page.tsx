import Link from "next/link";

const siteUrl = "https://anime-list-9lk.pages.dev";

export const metadata = {
  title: "About — NEON CURATOR",
  description:
    "NEON CURATOR is a fast, filter-first way to discover anime on top of MyAnimeList data — multi-field search, a private watchlist, and a daily auto-sync.",
  alternates: { canonical: `${siteUrl}/about` },
  openGraph: {
    title: "NEON CURATOR — discover anime, filter-first",
    description:
      "Filter 15,000+ anime across score, type, genre, year, and status in one query. Keep a private watchlist. Built on MyAnimeList data.",
    url: `${siteUrl}/about`,
    siteName: "NEON CURATOR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NEON CURATOR — discover anime, filter-first",
    description:
      "Filter 15,000+ anime in one query. Keep a private watchlist. Built on MyAnimeList data.",
  },
};

const FEATURES = [
  {
    title: "Filter across every dimension",
    body: "Score, type, genre, year, airing status, member count — combine them all in a single query. The whole filter state lives in the URL, so any search is shareable.",
  },
  {
    title: "A watchlist that's yours",
    body: "Track what you're Watching, Completed, Deferred, Avoiding, or BRR. It's private to your Google account — we don't share, sell, or analytics-tag your list.",
  },
  {
    title: "Ranking that surfaces hidden gems",
    body: "A log-scale popularity formula keeps mega-popular titles from burying everything else, so cult favorites still get a fair shot at the top of your results.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Search or filter",
    body: "Start with a title search, or open the filter matrix and stack conditions until the results match exactly what you're after.",
  },
  {
    n: "2",
    title: "Add to your watchlist",
    body: "Sign in with Google and tag any title with a status. Your watchlist syncs and stays in step across sessions.",
  },
  {
    n: "3",
    title: "Stay current",
    body: "A daily GitHub Action pulls fresh data from the Jikan API; check what's airing this week on the schedule page.",
  },
];

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/" className="text-xs text-white/40 hover:text-white">
        ← Home
      </Link>

      {/* Hero */}
      <section className="mt-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Discover anime, filter-first.
        </h1>
        <p className="mt-4 max-w-prose text-sm leading-7 text-white/60">
          NEON CURATOR is a fast, focused way to explore anime on top of public
          MyAnimeList data. Filter 15,000+ titles across score, type, genre,
          year, and status in one query — then keep a private watchlist of what
          you find.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-sm bg-primary px-6 py-3 text-[11px] font-black uppercase tracking-widest text-on-primary transition-opacity hover:opacity-90"
          >
            Start exploring
          </Link>
          <Link
            href="/schedule"
            className="inline-flex min-h-11 items-center rounded-sm border border-outline/20 px-6 py-3 text-[11px] font-black uppercase tracking-widest text-white/70 transition-colors hover:text-white"
          >
            See what&apos;s airing
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mt-14">
        <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30">
          What you get
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-sm border border-outline/10 bg-surface-container-low p-5"
            >
              <h3 className="text-sm font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-xs leading-6 text-white/50">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mt-14">
        <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30">
          How it works
        </h2>
        <ol className="mt-4 space-y-4">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-primary/30 bg-primary/10 text-xs font-black text-primary">
                {s.n}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-white">{s.title}</h3>
                <p className="mt-1 text-xs leading-6 text-white/50">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* How it stays fresh */}
      <section className="mt-14">
        <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30">
          How it stays fresh
        </h2>
        <p className="mt-3 max-w-prose text-sm leading-7 text-white/60">
          A daily GitHub Action pulls deltas from the Jikan API at midnight UTC,
          and a separate quarterly job does a full refresh. An always-warm
          in-memory cache keeps searches sub-millisecond once the server is up.
        </p>
      </section>

      {/* Privacy */}
      <section className="mt-14">
        <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30">
          Privacy
        </h2>
        <p className="mt-3 max-w-prose text-sm leading-7 text-white/60">
          Sign-in is Google OAuth. Your watchlist is private to your account —
          we don&apos;t share or sell it. See{" "}
          <Link href="/terms" className="underline">
            /terms
          </Link>{" "}
          for the rest.
        </p>
      </section>

      {/* Closing CTA */}
      <section className="mt-14 rounded-sm border border-outline/10 bg-surface-container-low p-6 text-center">
        <p className="text-sm text-white/70">Ready to find your next watch?</p>
        <Link
          href="/"
          className="mt-4 inline-flex min-h-11 items-center rounded-sm bg-primary px-8 py-3 text-[11px] font-black uppercase tracking-widest text-on-primary transition-opacity hover:opacity-90"
        >
          Open NEON CURATOR
        </Link>
      </section>
    </main>
  );
}
