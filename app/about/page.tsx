import Link from "next/link";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/brand";

const siteUrl = "https://anime-list-9lk.pages.dev";

export const metadata = {
  title: `About — ${SITE_NAME}`,
  description: SITE_DESCRIPTION,
  alternates: { canonical: `${siteUrl}/about` },
  openGraph: {
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: `${siteUrl}/about`,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
};

const FEATURES = [
  {
    title: "Filter across every dimension",
    body: "Score, type, genre, year, airing status, member count — combine them in one query. Filter state lives in the URL, so searches are shareable.",
  },
  {
    title: "A watchlist that's yours",
    body: "Track what you're watching, completed, deferred, or skipping. It's private to your Google account.",
  },
  {
    title: "Ranking that surfaces hidden gems",
    body: "A log-scale popularity formula keeps mega-popular titles from burying everything else.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Search or filter",
    body: "Start with a title search, or stack filters until the results match what you want.",
  },
  {
    n: "2",
    title: "Add to your list",
    body: "Sign in with Google and tag any title. Your watchlist syncs across sessions.",
  },
  {
    n: "3",
    title: "Stay current",
    body: "Data syncs daily from MyAnimeList via Jikan. Check the schedule for what's airing.",
  },
];

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Home
      </Link>

      <section className="mt-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {SITE_TAGLINE}
        </h1>
        <p className="mt-4 max-w-prose text-base leading-7 text-muted-foreground">
          {SITE_NAME} is a calm way to explore anime and manga on top of public
          MyAnimeList data — search, filter, compare stats, and keep a private list.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex min-h-10 items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Browse anime
          </Link>
          <Link
            href="/manga"
            className="inline-flex min-h-10 items-center rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Browse manga
          </Link>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-sm font-medium text-muted-foreground">What you get</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-sm font-medium text-muted-foreground">How it works</h2>
        <ol className="mt-4 space-y-4">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-sm font-medium text-primary">
                {s.n}
              </span>
              <div>
                <h3 className="text-sm font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14 rounded-xl border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">Ready to find your next title?</p>
        <Link
          href="/"
          className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Open {SITE_NAME}
        </Link>
      </section>
    </main>
  );
}
