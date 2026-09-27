import { Link } from '@tanstack/react-router';

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-sm leading-7">
      <Link to="/" className="text-xs text-muted-foreground hover:underline">
        ← Home
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Privacy</h1>
      <p className="mt-4 text-xs text-muted-foreground">Last updated: 2026-09-28.</p>

      <h2 className="mt-8 text-base font-semibold">What we store</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Your Google OAuth identity when you sign in.</li>
        <li>Your watchlist entries and statuses.</li>
        <li>Optional sync tokens for MAL / AniList if you connect them.</li>
        <li>
          If you opt in to Anime List email updates, SaaS Maker processes your email address and
          consent record to manage the subscription.
        </li>
      </ul>

      <h2 className="mt-8 text-base font-semibold">Analytics</h2>
      <p className="mt-2">
        We use PostHog and SaaS Maker App Health for product analytics. App Health measures page
        visits and selected homepage actions using page paths, action names, and a pseudonymous
        browser identifier stored locally for up to 90 days where browser storage is available. The
        search, discover, and stats action events do not include account details, search terms, or
        watchlist contents. We do not use advertising pixels or remarketing.
      </p>

      <h2 className="mt-8 text-base font-semibold">What we don&apos;t</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>
          Anime metadata is sourced from public APIs (Tenrai, AniList) — we don&apos;t share your
          watchlist back with them.
        </li>
        <li>No selling of subscriber data.</li>
      </ul>

      <h2 className="mt-8 text-base font-semibold">Rate limits</h2>
      <p className="mt-2">
        Search uses an in-memory cache with stale-while-revalidate — your queries are fast and the
        upstream APIs are quiet.
      </p>

      <h2 className="mt-8 text-base font-semibold">Deletion</h2>
      <p className="mt-2">
        Revoke the Google OAuth grant in your Google account to disconnect. Contact the maintainer
        to request deletion of your watchlist, account data, or newsletter subscription.
      </p>
    </main>
  );
}
