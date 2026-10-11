import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CatalogGridSkeleton,
  CompactSectionSkeleton,
  ListSkeleton,
  PageShellSkeleton,
  RefreshIndicator,
} from './loading-state';

describe('shared loading states', () => {
  it('keeps the static first-paint placeholder and React route fallback in sync', () => {
    const html = readFileSync('index.html', 'utf8');
    const initial = new DOMParser().parseFromString(html, 'text/html');
    const staticShell = initial.querySelector('#root [data-page-placeholder]');
    const { container } = render(<PageShellSkeleton />);
    const reactShell = container.querySelector('[data-page-placeholder]');

    expect(staticShell).not.toBeNull();
    expect(staticShell?.getAttribute('aria-label')).toBe('loading page');
    for (const shape of ['title', 'description', 'image', 'card-title']) {
      expect(staticShell?.querySelectorAll(`[data-placeholder-${shape}]`).length).toBe(
        reactShell?.querySelectorAll(`[data-placeholder-${shape}]`).length
      );
    }
    expect(initial.querySelector('#boot-shell > main')?.hasAttribute('data-app-main')).toBe(true);
    expect(initial.querySelector('#lcp-shell')).not.toBeNull();
  });

  it('announces a catalog load and reserves representative cards', () => {
    const { container } = render(<CatalogGridSkeleton label="Loading manga results" />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading manga results');
    expect(screen.getByLabelText('Loading manga results')).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(12);
  });

  it('announces auth-gated list loading without a blank screen', () => {
    render(<ListSkeleton label="Loading anime watchlist" rows={3} />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading anime watchlist');
    expect(screen.getByLabelText('Loading anime watchlist')).toBeInTheDocument();
  });

  it('reserves a compact section and announces it while auth resolves', () => {
    const { container } = render(
      <CompactSectionSkeleton label="Loading personal access tokens" rows={2} />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading personal access tokens');
    expect(screen.getByLabelText('Loading personal access tokens')).toHaveAttribute(
      'aria-busy',
      'true'
    );
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(3);
  });

  it('keeps skeletons calm without animation', () => {
    const { container } = render(<CompactSectionSkeleton label="Loading section" />);

    for (const shape of container.querySelectorAll('[aria-hidden="true"]')) {
      expect(shape.className).toContain('motion-safe:animate-none');
    }
  });

  it('only renders refresh feedback while active', () => {
    const { rerender } = render(<RefreshIndicator active={false} label="Updating results" />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    rerender(<RefreshIndicator active label="Updating results" />);
    expect(screen.getByRole('status')).toHaveTextContent('updating results');
  });
});
