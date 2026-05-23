"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
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
    <nav className="sticky top-0 z-50 border-b border-outline/20 bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-14 gap-6">
        <Link
          href={homeHref}
          className="font-display font-black text-base uppercase tracking-tighter italic text-glow whitespace-nowrap"
        >
          <span className="text-primary">NEON</span>
          <span className="text-white"> CURATOR</span>
        </Link>

        <div className="hidden sm:flex items-center gap-1 p-1 bg-surface-container-low border border-outline/10 rounded-sm">
          <Link
            href="/"
            className={cn(
              "px-3 py-1.5 text-[9px] font-black tracking-widest uppercase rounded-sm transition-all",
              !mangaMode ? "bg-primary-container text-on-primary-container" : "text-white/40 hover:text-white",
            )}
          >
            Anime
          </Link>
          <Link
            href="/manga"
            className={cn(
              "px-3 py-1.5 text-[9px] font-black tracking-widest uppercase rounded-sm transition-all",
              mangaMode ? "bg-primary-container text-on-primary-container" : "text-white/40 hover:text-white",
            )}
          >
            Manga
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-5 flex-1">
          {links.map((link) => {
            const active = isActiveLink(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-[11px] font-black uppercase tracking-widest transition-colors",
                  active
                    ? "text-primary text-glow"
                    : "text-white/40 hover:text-white",
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
            <DropdownMenuContent
              align="start"
              className="bg-surface-container-high border-outline/20 rounded-sm"
            >
              <DropdownMenuItem asChild>
                <Link href="/" className={cn("w-full cursor-pointer text-[10px] font-black uppercase tracking-widest", !mangaMode ? "text-primary" : "text-white/70")}>
                  Anime
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/manga" className={cn("w-full cursor-pointer text-[10px] font-black uppercase tracking-widest", mangaMode ? "text-primary" : "text-white/70")}>
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
                        "w-full cursor-pointer text-[10px] font-black uppercase tracking-widest",
                        active ? "text-primary" : "text-white/70",
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 h-8 px-2 hover:bg-white/5"
                >
                  <Avatar className="h-6 w-6">
                    {user.picture && (
                      <AvatarImage src={user.picture} alt={user.name} />
                    )}
                    <AvatarFallback className="text-[10px] bg-primary-container text-on-primary-container font-black">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest text-white/70">
                    {user.name.split(" ")[0]}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-surface-container-high border-outline/20 rounded-sm"
              >
                <DropdownMenuItem className="text-[9px] font-bold uppercase tracking-widest text-white/40">
                  {user.email}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={logout}
                  className="text-[10px] font-bold uppercase tracking-widest text-white/80"
                >
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
