import { lazy } from 'react';
import { createRouter, createRootRoute, createRoute, notFound } from '@tanstack/react-router';
import RootLayout from './RootLayout';
import AppProvidersLayout from './AppProvidersLayout';
import NotFoundPage from './pages/NotFoundPage';
import HomePage from './pages/HomePage';

function validateMalId(malId: string) {
  const numericMalId = Number(malId);
  if (!Number.isInteger(numericMalId) || numericMalId <= 0) {
    throw notFound();
  }
}

const SearchPage = lazy(() => import('./pages/SearchPage'));
const DiscoverPage = lazy(() => import('./pages/DiscoverPage'));
const AnimeDetailPage = lazy(() => import('./pages/AnimeDetailPage'));
const MangaDetailPage = lazy(() => import('./pages/MangaDetailPage'));
const GenreRandomPage = lazy(() => import('./pages/GenreRandomPage'));
const RandomPage = lazy(() => import('./pages/RandomPage'));
const SchedulePage = lazy(() => import('./pages/SchedulePage'));
const WatchlistPage = lazy(() => import('./pages/WatchlistPage'));
const StatsPage = lazy(() => import('./pages/StatsPage'));
const MangaSearchPage = lazy(() => import('./pages/MangaSearchPage'));
const MangaStatsPage = lazy(() => import('./pages/MangaStatsPage'));
const MangaWatchlistPage = lazy(() => import('./pages/MangaWatchlistPage'));
const AlertsPage = lazy(() => import('./pages/AlertsPage'));
const CollectionsPage = lazy(() => import('./pages/CollectionsPage'));
const PublicCollectionPage = lazy(() => import('./pages/PublicCollectionPage'));
const QuizPage = lazy(() => import('./pages/QuizPage'));
const ChangelogPage = lazy(() => import('./pages/ChangelogPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const McpPage = lazy(() => import('./pages/McpPage'));

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

/** Pathless layout: Query + nuqs only for routes that need them (not /). */
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  component: AppProvidersLayout,
});

const searchRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/search',
  component: SearchPage,
});

const discoverRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/discover',
  component: DiscoverPage,
});

const animeDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/anime/$malId',
  beforeLoad: ({ params }) => validateMalId(params.malId),
  component: AnimeDetailPage,
});

const mangaDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/manga/$malId',
  beforeLoad: ({ params }) => validateMalId(params.malId),
  component: MangaDetailPage,
});

const genreRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/genre/$genre',
  component: GenreRandomPage,
});

const randomRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/random',
  component: RandomPage,
});

const scheduleRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/schedule',
  component: SchedulePage,
});

const watchlistRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/watchlist',
  component: WatchlistPage,
});

const statsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/stats',
  component: StatsPage,
});

const mangaRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/manga',
  component: MangaSearchPage,
});

const mangaStatsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/manga/stats',
  component: MangaStatsPage,
});

const mangaWatchlistRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/manga/watchlist',
  component: MangaWatchlistPage,
});

const alertsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/alerts',
  component: AlertsPage,
});

const collectionsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/collections',
  component: CollectionsPage,
});

const publicCollectionRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/c/$slug',
  component: PublicCollectionPage,
});

const quizRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/quiz',
  component: QuizPage,
});

const changelogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/changelog',
  component: ChangelogPage,
});

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about',
  component: AboutPage,
});

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/privacy',
  component: PrivacyPage,
});

const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/terms',
  component: TermsPage,
});

const mcpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mcp',
  component: McpPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  appRoute.addChildren([
    searchRoute,
    discoverRoute,
    animeDetailRoute,
    genreRoute,
    randomRoute,
    scheduleRoute,
    watchlistRoute,
    alertsRoute,
    collectionsRoute,
    publicCollectionRoute,
    statsRoute,
    mangaStatsRoute,
    mangaWatchlistRoute,
    mangaDetailRoute,
    mangaRoute,
    quizRoute,
  ]),
  changelogRoute,
  aboutRoute,
  privacyRoute,
  termsRoute,
  mcpRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
