'use client';

import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getLastUpdated } from '@/lib/api';
import { SITE_NAME } from '@/lib/brand';

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
  const { data } = useQuery({
    queryKey: ['lastUpdated'],
    queryFn: getLastUpdated,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-8 mt-8 border-t border-border">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="font-medium text-foreground">{SITE_NAME}</span>
          {data?.lastUpdated && (
            <>
              <span className="text-border">·</span>
              <span>Updated {timeAgo(data.lastUpdated)}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Link to="/mcp" className="hover:text-foreground transition-colors">
            MCP
          </Link>
          <Link to="/changelog" className="hover:text-foreground transition-colors">
            Changelog
          </Link>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground/60">
        35,000+ titles. One search bar. No sign-up required.
      </p>
    </footer>
  );
}
