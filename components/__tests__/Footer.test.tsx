import type React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { getLastUpdated } = vi.hoisted(() => ({ getLastUpdated: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/api', () => ({ getLastUpdated }));

import Footer from '../Footer';

describe('Footer', () => {
  it('loads the catalog timestamp without a query provider', async () => {
    getLastUpdated.mockResolvedValue({
      lastUpdated: '2026-08-14 05:00:00',
      anime: '2026-08-14 05:00:00',
      manga: '2026-08-14 05:00:00',
    });

    const { container } = render(<Footer />);

    expect(await screen.findByText(/^Updated /)).toBeInTheDocument();
    expect(getLastUpdated).toHaveBeenCalledOnce();
    expect(container.querySelector('footer')).toHaveClass('w-full');
    expect(container.querySelector('fleet-footer-extension')).toHaveAttribute('theme', 'dark');
    expect(container.querySelector('fleet-footer-extension')).toHaveAttribute(
      'font-base',
      '/fonts/fleet-footer-precise-v1/'
    );
    expect(container.querySelector('footer')).toHaveAttribute('slot', 'navigation');
    expect(screen.getByRole('link', { name: 'Search anime' })).toHaveAttribute('href', '/search');
    expect(screen.getByRole('link', { name: 'Catalog updates' })).toHaveAttribute(
      'href',
      '/catalog-updates'
    );
    expect(container.querySelector('saas-maker-newsletter-capture')).toHaveAttribute(
      'layout',
      'compact'
    );
    expect(container.querySelector('saas-maker-newsletter-capture')).toHaveAttribute('integrated');
    expect(container.querySelector('saas-maker-newsletter-capture')).toHaveAttribute(
      'catalog-id',
      'anime-list'
    );
  });
});
