'use client';

import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { getLastUpdated } from '@/lib/api';
import { PRODUCT_NAME, PUBLISHER_NAME } from '@/lib/brand';

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(`${dateStr}Z`).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function Footer() {
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getLastUpdated()
      .then((data) => {
        if (!cancelled) setLastUpdated(data.lastUpdated);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <footer className="mt-4 w-full border-t border-border">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="inline-flex flex-col items-start gap-0.5 text-foreground">
              <span className="font-medium leading-none">{PRODUCT_NAME}</span>
              <span className="text-[9px] leading-none text-muted-foreground">
                by {PUBLISHER_NAME}
              </span>
            </span>
            {lastUpdated && (
              <>
                <span className="text-border">·</span>
                <span>Updated {timeAgo(lastUpdated)}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            <Link to="/mcp" className="hover:text-foreground transition-colors">
              MCP
            </Link>
            <Link to="/catalog-updates" className="hover:text-foreground transition-colors">
              Catalog updates
            </Link>
            <a
              href="https://github.com/Significant-Hobbies/anime-list/issues"
              className="hover:text-foreground transition-colors"
            >
              Roadmap
            </a>
            <a
              href="https://github.com/Significant-Hobbies/anime-list"
              aria-label="GitHub repository"
              title="GitHub repository"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              <svg
                viewBox="0 0 16 16"
                width="20"
                height="20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              <span className="sr-only">GitHub repository</span>
            </a>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          35,000+ titles. One search bar. No sign-up required.
        </p>
      </div>
    </footer>
  );
}
