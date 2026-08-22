'use client';

import { Link, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { PRODUCT_NAME, PUBLISHER_NAME } from '@/lib/brand';
import { LoadingStatus, Skeleton } from '@/components/ui/loading-state';
import GoogleSignInButton from './GoogleSignInButton';
import { Menu } from 'lucide-react';

const animeLinks = [
  { href: '/discover', label: 'Discover' },
  { href: '/search', label: 'Search' },
  { href: '/stats', label: 'Stats' },
  { href: '/watchlist', label: 'Watchlist' },
  { href: '/schedule', label: 'Schedule' },
  { href: '/catalog-updates', label: 'Catalog updates' },
];

const mangaLinks = [
  { href: '/manga', label: 'Discover' },
  { href: '/manga/stats', label: 'Stats' },
  { href: '/manga/watchlist', label: 'Watchlist' },
  { href: '/catalog-updates', label: 'Catalog updates' },
];

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
  return `px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
    active
      ? 'bg-background text-foreground shadow-sm'
      : 'text-muted-foreground hover:text-foreground'
  }`;
}

function closeDetails(event: React.MouseEvent<HTMLElement>) {
  event.currentTarget.closest('details')?.removeAttribute('open');
}

function closeDetailsOnEscape(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key === 'Escape') event.currentTarget.removeAttribute('open');
}

export default function Navigation() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mangaMode = isMangaPath(pathname);
  const links = mangaMode ? mangaLinks : animeLinks;
  // Site brand link goes to the marketing landing; section toggle goes to the
  // anime/manga app root.
  const homeHref = '/';
  const animeSectionHref = '/search';
  const mangaSectionHref = '/manga';

  return (
    <nav className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-14 gap-3 sm:gap-6">
        <Link
          to={homeHref}
          aria-label="Anime List by Significant Hobbies"
          className="flex min-w-0 shrink-0 flex-col items-start justify-center gap-0.5 whitespace-nowrap text-foreground"
        >
          <span className="text-sm font-semibold leading-none tracking-tight sm:text-base">
            {PRODUCT_NAME}
          </span>
          <span className="text-[8px] font-medium leading-none text-muted-foreground sm:text-[9px]">
            by {PUBLISHER_NAME}
          </span>
        </Link>

        <div className="hidden sm:flex items-center gap-1 rounded-lg bg-muted/60 p-1">
          <Link to={animeSectionHref} className={sectionClassName(!mangaMode)}>
            Anime
          </Link>
          <Link to={mangaSectionHref} className={sectionClassName(mangaMode)}>
            Manga
          </Link>
        </div>

        <div className="hidden xl:flex items-center gap-1 flex-1">
          {links.map((link) => {
            const active = isActiveLink(pathname, link.href);
            return (
              <Link
                key={link.href}
                to={link.href}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <details
          open={mobileMenuOpen}
          className="group relative flex-1 xl:hidden"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setMobileMenuOpen(false);
          }}
        >
          <summary
            role="button"
            aria-controls="primary-mobile-navigation"
            aria-expanded={mobileMenuOpen}
            aria-haspopup="menu"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            onClick={(event) => {
              event.preventDefault();
              setMobileMenuOpen((open) => !open);
            }}
            className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-md transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
          >
            <Menu className="h-5 w-5" />
          </summary>
          <div
            id="primary-mobile-navigation"
            role="menu"
            className="absolute left-0 top-full z-50 mt-2 min-w-48 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
          >
            <Link
              to={animeSectionHref}
              onClick={() => setMobileMenuOpen(false)}
              role="menuitem"
              className={`flex min-h-11 items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent sm:hidden ${
                !mangaMode ? 'text-primary' : ''
              }`}
            >
              Anime
            </Link>
            <Link
              to={mangaSectionHref}
              onClick={() => setMobileMenuOpen(false)}
              role="menuitem"
              className={`flex min-h-11 items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent sm:hidden ${
                mangaMode ? 'text-primary' : ''
              }`}
            >
              Manga
            </Link>
            {links.map((link) => {
              const active = isActiveLink(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  role="menuitem"
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-11 items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent ${
                    active ? 'text-primary' : ''
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </details>

        <div className="flex min-w-10 items-center justify-end gap-3 sm:min-w-28">
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
                <button
                  type="button"
                  onClick={logout}
                  className="block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  Sign out
                </button>
              </div>
            </details>
          ) : (
            <GoogleSignInButton />
          )}
        </div>
      </div>
    </nav>
  );
}
