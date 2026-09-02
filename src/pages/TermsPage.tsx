import { Link } from '@tanstack/react-router';

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-sm leading-7">
      <Link to="/" className="text-xs text-muted-foreground hover:underline">
        ← Home
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Terms</h1>
      <p className="mt-4 text-xs text-muted-foreground">Last updated: 2026-09-02.</p>

      <h2 className="mt-8 text-base font-semibold">Data sources</h2>
      <p className="mt-2">
        Anime / manga metadata is sourced from the public Tenrai and AniList APIs and refreshed on a
        schedule. Each entry traces back to MAL / AniList; we add structure on top, not new claims
        about the works themselves.
      </p>

      <h2 className="mt-8 text-base font-semibold">Your watchlist</h2>
      <p className="mt-2">
        Signed-in users get a personal watchlist tied to their Google account. Watchlists are
        private to your account by default.
      </p>

      <h2 className="mt-8 text-base font-semibold">No warranty</h2>
      <p className="mt-2">
        Provided as-is. Air dates, episode counts, and synopses come from upstream sources and can
        drift. Cross-check before marathon-watching.
      </p>
    </main>
  );
}
