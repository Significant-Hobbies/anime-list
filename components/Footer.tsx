'use client';

import { createElement, useEffect, useState, type CSSProperties } from 'react';
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

function FooterNavigation({ lastUpdated }: { lastUpdated: string | null }) {
  return (
    <footer slot="navigation" data-fleet-footer-navigation className="w-full">
      <div className="grid gap-6 text-sm sm:grid-cols-2">
        <section>
          <h2 data-fleet-footer-group-label className="mb-2 text-muted-foreground">
            Discover
          </h2>
          <nav aria-label="Anime List discovery" className="flex flex-col items-start">
            <Link
              to="/search"
              data-fleet-footer-primary
              className="hover:text-foreground transition-colors"
            >
              Search anime
            </Link>
            <Link to="/manga" className="hover:text-foreground transition-colors">
              Search manga
            </Link>
            <Link to="/stats" className="hover:text-foreground transition-colors">
              Anime statistics
            </Link>
            <Link to="/manga/stats" className="hover:text-foreground transition-colors">
              Manga statistics
            </Link>
          </nav>
        </section>
        <section>
          <h2 data-fleet-footer-group-label className="mb-2 text-muted-foreground">
            Catalogue &amp; project
          </h2>
          <nav aria-label="Anime List information" className="flex flex-col items-start">
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
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub repository
            </a>
          </nav>
        </section>
      </div>
      <div className="mt-6 space-y-2 text-xs leading-relaxed text-muted-foreground">
        <p>
          {PRODUCT_NAME} by {PUBLISHER_NAME}
        </p>
        {lastUpdated && <p>Updated {timeAgo(lastUpdated)}</p>}
        <p>35,000+ titles. One search bar. No sign-up required.</p>
      </div>
    </footer>
  );
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

  return createElement(
    'fleet-footer-extension',
    {
      'data-fleet-footer-project': 'anime-list',
      'product-name': PRODUCT_NAME,
      theme: 'dark',
      surface: 'app',
      'font-base': '/fonts/fleet-footer-precise-v1/',
      'art-src': '/footer-art/anime-list.webp',
      'art-alt':
        'Anime List: An original animation-club room centers a personal watch shelf and one invented illustrated story card. A projector, original abstract story panels and a seasonal moon-cycle window frame the scene.',
      'art-width': '2168',
      'art-height': '725',
      'art-position': '50% 50%',
      'art-credit': 'Original illustration for Anime List',
      className: 'block w-full text-foreground',
      style: {
        '--fleet-footer-canvas': 'var(--background)',
        '--fleet-footer-lower': 'var(--background)',
        '--fleet-footer-max-width': '1280px',
      } as CSSProperties,
    },
    <FooterNavigation lastUpdated={lastUpdated} />,
    <saas-maker-newsletter-capture
      slot="capture"
      catalog-id="anime-list"
      product-name={PRODUCT_NAME}
      kind="newsletter"
      source="footer"
      privacy-url="https://anime.significanthobbies.com/privacy"
      layout="compact"
      integrated=""
      theme="dark"
    />
  );
}
