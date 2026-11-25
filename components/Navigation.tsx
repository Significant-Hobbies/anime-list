'use client';

import { Link, useRouterState } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth';
import { PRODUCT_NAME, PUBLISHER_NAME } from '@/lib/brand';
import { LoadingStatus, Skeleton } from '@/components/ui/loading-state';
import { Button } from '@/components/ui/button';
import GoogleSignInButton from './GoogleSignInButton';
import { ChevronDown } from 'lucide-react';

const animeLinks = {
  primary: [
    { href: '/search', label: 'Search' },
    { href: '/watchlist', label: 'Watchlist' },
    { href: '/schedule', label: 'Schedule' },
  ],
  more: [
    { href: '/discover', label: 'Taste quiz' },
    { href: '/stats', label: 'Stats' },
    { href: '/catalog-updates', label: 'Catalog updates' },
  ],
};

const mangaLinks = {
  primary: [
    { href: '/manga', label: 'Discover' },
    { href: '/manga/watchlist', label: 'Watchlist' },
  ],
  more: [
    { href: '/manga/stats', label: 'Stats' },
    { href: '/catalog-updates', label: 'Catalog updates' },
  ],
};

function isMangaPath(pathname: string) {
  return pathname === '/manga' || pathname.startsWith('/manga/');
}

function isActiveLink(pathname: string, href: string) {
  if (href === '/' || href === '/manga') {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function sectionClassName(active: boolean): string {
  return `px-2 sm:px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
    active
      ? 'bg-background text-foreground shadow-sm'
      : 'text-muted-foreground hover:text-foreground'
  }`;
}

function closeDetails(event: React.MouseEvent<HTMLElement>) {
  event.currentTarget.closest('details')?.removeAttribute('open');
}

function closeDetailsOnEscape(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key !== 'Escape') return;
  event.currentTarget.removeAttribute('open');
  event.currentTarget.querySelector('summary')?.focus();
}

export default function Navigation() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading, logout } = useAuth();
  const mangaMode = isMangaPath(pathname);
  const links = mangaMode ? mangaLinks : animeLinks;
  // Site brand link goes to the marketing landing; section toggle goes to the
  // anime/manga app root.
  const homeHref = '/';
  const animeSectionHref = '/search';
  const mangaSectionHref = '/manga';

  return (
    <nav
      aria-label="Main navigation"
      className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-md"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap items-center gap-x-2 sm:gap-x-6 lg:h-14 lg:flex-nowrap">
        <Link
          to={homeHref}
          aria-label="Anime List"
          className="flex h-12 min-w-0 shrink-0 flex-col items-start justify-center gap-0.5 whitespace-nowrap text-foreground"
        >
          <span className="text-sm font-semibold leading-none tracking-tight sm:text-base">
            {PRODUCT_NAME}
          </span>
          <span className="text-[8px] font-medium leading-none text-muted-foreground sm:text-[9px]">
            by {PUBLISHER_NAME}
          </span>
        </Link>

        <div className="flex items-center gap-1 rounded-lg bg-muted/60 p-1">
          <Link to={animeSectionHref} className={sectionClassName(!mangaMode)}>
            Anime
          </Link>
          <Link to={mangaSectionHref} className={sectionClassName(mangaMode)}>
            Manga
          </Link>
        </div>

        <div className="order-last flex w-full items-center gap-1 border-t border-border/60 lg:order-none lg:w-auto lg:flex-1 lg:border-0">
          {links.primary.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              aria-current={isActiveLink(pathname, link.href) ? 'page' : undefined}
              className="flex min-h-11 items-center rounded-md px-1.5 text-sm font-medium text-muted-foreground hover:text-foreground aria-[current=page]:text-primary sm:px-3"
            >
              {link.label}
            </Link>
          ))}
          <details
            key={pathname}
            className="group relative ml-auto lg:ml-0"
            onKeyDown={closeDetailsOnEscape}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                event.currentTarget.removeAttribute('open');
              }
            }}
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-md px-1.5 text-sm font-medium text-muted-foreground hover:text-foreground sm:px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              More{' '}
              <ChevronDown
                aria-hidden="true"
                className="size-3.5 transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="absolute right-0 top-full z-50 mt-1 min-w-40 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md lg:left-0 lg:right-auto">
              {links.more.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={closeDetails}
                  aria-current={isActiveLink(pathname, link.href) ? 'page' : undefined}
                  className="flex min-h-11 items-center rounded-sm px-3 text-sm hover:bg-accent aria-[current=page]:text-primary"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </details>
        </div>

        <div className="ml-auto flex min-w-10 items-center justify-end gap-3 sm:min-w-28">
          {loading ? (
            <div aria-busy="true" className="flex items-center gap-2 px-2">
              <LoadingStatus label="Checking sign-in status" />
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="hidden h-3 w-14 bg-muted/45 sm:block" />
            </div>
          ) : user ? (
            <details className="relative" onKeyDown={closeDetailsOnEscape}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md px-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-xs text-primary">
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
                </span>
                <span className="hidden text-sm text-muted-foreground sm:inline">
                  {user.name.split(' ')[0]}
                </span>
              </summary>
              <div className="absolute right-0 top-full z-50 mt-2 min-w-48 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
                <div className="px-2 py-1.5 text-xs text-muted-foreground">{user.email}</div>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={logout}
                  className="block h-auto w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  Sign out
                </Button>
              </div>
            </details>
          ) : (
            <>
              <div className="sm:hidden">
                <GoogleSignInButton compact />
              </div>
              <div className="hidden sm:block">
                <GoogleSignInButton />
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
