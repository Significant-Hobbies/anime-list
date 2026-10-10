import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { getLastUpdated } = vi.hoisted(() => ({ getLastUpdated: vi.fn() }));

vi.mock('@/lib/api', () => ({ getLastUpdated }));

import Footer from '../Footer';

describe('Footer', () => {
  it('renders the library studio-footer element with the catalog id and links', async () => {
    getLastUpdated.mockResolvedValue({
      lastUpdated: '2026-08-14 05:00:00',
      anime: '2026-08-14 05:00:00',
      manga: '2026-08-14 05:00:00',
    });

    const { container } = render(<Footer />);
    const element = container.querySelector('studio-footer');

    expect(element).toHaveAttribute('catalog-id', 'anime-list');
    expect(element).toHaveAttribute('capture', 'newsletter');
    expect(element).toHaveAttribute('privacy-url', 'https://anime.significanthobbies.com/privacy');
    await vi.waitFor(() => expect(element?.getAttribute('legal')).toMatch(/Updated /));

    const config = JSON.parse(
      element?.querySelector('script[type="application/json"]')?.textContent ?? '{}'
    );
    const links = config.groups.flatMap(
      (group: { links: { label: string; href: string }[] }) => group.links
    );
    expect(links).toContainEqual({ label: 'Search anime', href: '/search' });
    expect(links).toContainEqual({ label: 'Catalog updates', href: '/catalog-updates' });
    expect(config.art.src).toBe('/footer-art/anime-list.webp');
    expect(getLastUpdated).toHaveBeenCalledOnce();
  });
});
