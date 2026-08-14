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
    <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-8 mt-8 border-t border-border">
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
            className="hover:text-foreground transition-colors"
          >
            Source
          </a>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        35,000+ titles. One search bar. No sign-up required.
      </p>
    </footer>
  );
}
