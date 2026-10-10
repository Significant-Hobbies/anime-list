import { createElement, useEffect, useState } from 'react';
import { getLastUpdated } from '@/lib/api';
import { PRODUCT_NAME, PUBLISHER_NAME } from '@/lib/brand';

const SITE_URL = 'https://anime.significanthobbies.com';

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

const footerConfig = {
  groups: [
    {
      title: 'Discover',
      links: [
        { label: 'Search anime', href: '/search' },
        { label: 'Search manga', href: '/manga' },
        { label: 'Anime statistics', href: '/stats' },
        { label: 'Manga statistics', href: '/manga/stats' },
      ],
    },
    {
      title: 'Catalogue & project',
      links: [
        { label: 'MCP', href: '/mcp' },
        { label: 'Catalog updates', href: '/catalog-updates' },
        { label: 'Roadmap', href: 'https://github.com/Significant-Hobbies/anime-list/issues' },
        { label: 'GitHub repository', href: 'https://github.com/Significant-Hobbies/anime-list' },
      ],
    },
  ],
  art: {
    src: '/footer-art/anime-list.webp',
    alt: 'Anime List: An original animation-club room centers a personal watch shelf and one invented illustrated story card. A projector, original abstract story panels and a seasonal moon-cycle window frame the scene.',
    position: '50% 50%',
  },
};

/**
 * The SaaS Maker UI library StudioFooter (framework-free build). The element
 * is defined by /footer.js and styled by /footer.css, both loaded in index.html.
 */
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

  const summary = '35,000+ titles. One search bar. No sign-up required.';
  const legal = `${PRODUCT_NAME} by ${PUBLISHER_NAME}${lastUpdated ? ` · Updated ${timeAgo(lastUpdated)}` : ''}`;

  return createElement(
    'studio-footer',
    {
      product: PRODUCT_NAME,
      url: SITE_URL,
      'catalog-id': 'anime-list',
      capture: 'newsletter',
      variant: 'studio',
      'privacy-url': `${SITE_URL}/privacy`,
      summary,
      legal,
      'data-mode': 'dark',
      className: 'block w-full',
    },
    <script
      type="application/json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(footerConfig) }}
    />
  );
}
