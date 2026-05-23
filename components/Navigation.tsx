"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { SITE_NAME } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import GoogleSignInButton from "./GoogleSignInButton";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";

const animeLinks = [
  { href: "/", label: "Discover" },
  { href: "/stats", label: "Stats" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/schedule", label: "Schedule" },
  { href: "/changelog", label: "Changelog" },
];

const mangaLinks = [
  { href: "/manga", label: "Discover" },
  { href: "/manga/stats", label: "Stats" },
  { href: "/manga/watchlist", label: "Watchlist" },
  { href: "/changelog", label: "Changelog" },
];

function isMangaPath(pathname: string) {
  return pathname === "/manga" || pathname.startsWith("/manga/");
}

function isActiveLink(pathname: string, href: string) {
  if (href === "/" || href === "/manga") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Navigation() {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const mangaMode = isMangaPath(pathname);
  const links = mangaMode ? mangaLinks : animeLinks;
  const homeHref = mangaMode ? "/manga" : "/";

  return (
    <nav className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-14 gap-6">
        <Link
          href={homeHref}
          className="text-lg font-semibold tracking-tight text-foreground whitespace-nowrap"
        >
          {SITE_NAME}
        </Link>

        <div className="hidden sm:flex items-center gap-1 rounded-lg bg-muted/60 p-1">
          <Link
            href="/"
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              !mangaMode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Anime
          </Link>
          <Link
            href="/manga"
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              mangaMode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Manga
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-1 flex-1">
          {links.map((link) => {
            const active = isActiveLink(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="flex md:hidden flex-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-popover border-border">
              <DropdownMenuItem asChild>
                <Link href="/" className={cn("w-full cursor-pointer text-sm", !mangaMode ? "text-primary" : "")}>
                  Anime
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/manga" className={cn("w-full cursor-pointer text-sm", mangaMode ? "text-primary" : "")}>
                  Manga
                </Link>
              </DropdownMenuItem>
              {links.map((link) => {
                const active = isActiveLink(pathname, link.href);
                return (
                  <DropdownMenuItem key={link.href} asChild>
                    <Link
                      href={link.href}
                      className={cn(
                        "w-full cursor-pointer text-sm",
                        active ? "text-primary" : "",
                      )}
                    >
                      {link.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-3">
          {loading ? null : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 h-9 px-2">
                  <Avatar className="h-7 w-7">
                    {user.picture && (
                      <AvatarImage src={user.picture} alt={user.name} />
                    )}
                    <AvatarFallback className="text-xs bg-primary/15 text-primary">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm text-muted-foreground">
                    {user.name.split(" ")[0]}
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
