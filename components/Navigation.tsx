'use client';

import { Link, useRouterState } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth';
import { SITE_NAME } from '@/lib/brand';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import GoogleSignInButton from './GoogleSignInButton';
import { cn } from '@/lib/utils';
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
    <nav className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-14 gap-3 sm:gap-6">
        <Link
          to={homeHref}
          className="min-w-0 truncate text-sm font-semibold tracking-tight text-foreground sm:text-base"
        >
          {SITE_NAME}
        </Link>

        <div className="hidden sm:flex items-center gap-1 rounded-lg bg-muted/60 p-1">
          <Link
            to={animeSectionHref}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              !mangaMode
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Anime
          </Link>
          <Link
            to={mangaSectionHref}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              mangaMode
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
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
                className={cn(
                  'px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="flex xl:hidden flex-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-popover border-border">
              <DropdownMenuItem asChild>
                <Link
                  to={animeSectionHref}
                  className={cn('w-full cursor-pointer text-sm', !mangaMode ? 'text-primary' : '')}
                >
                  Anime
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  to={mangaSectionHref}
                  className={cn('w-full cursor-pointer text-sm', mangaMode ? 'text-primary' : '')}
                >
                  Manga
                </Link>
              </DropdownMenuItem>
              {links.map((link) => {
                const active = isActiveLink(pathname, link.href);
                return (
                  <DropdownMenuItem key={link.href} asChild>
                    <Link
                      to={link.href}
                      className={cn('w-full cursor-pointer text-sm', active ? 'text-primary' : '')}
                    >
                      {link.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex min-w-28 items-center justify-end gap-3">
          {loading ? (
            <span className="h-9 w-28" aria-hidden />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 h-9 px-2">
                  <Avatar className="h-7 w-7">
                    {user.picture && <AvatarImage src={user.picture} alt={user.name} />}
                    <AvatarFallback className="text-xs bg-primary/15 text-primary">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm text-muted-foreground">
                    {user.name.split(' ')[0]}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border-border">
                <DropdownMenuItem className="text-xs text-muted-foreground">
                  {user.email}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout} className="text-sm">
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <GoogleSignInButton />
          )}
        </div>
      </div>
    </nav>
  );
}
