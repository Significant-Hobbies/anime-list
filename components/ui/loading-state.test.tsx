import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  CatalogGridSkeleton,
  CompactSectionSkeleton,
  ListSkeleton,
  RefreshIndicator,
} from './loading-state';

describe('shared loading states', () => {
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

  it('keeps skeleton motion behind a reduced-motion guard', () => {
    const { container } = render(<CompactSectionSkeleton label="Loading section" />);

    for (const shape of container.querySelectorAll('[aria-hidden="true"]')) {
      expect(shape.className).toContain('motion-safe:animate-pulse');
    }
  });

  it('only renders refresh feedback while active', () => {
    const { rerender } = render(<RefreshIndicator active={false} label="Updating results" />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    rerender(<RefreshIndicator active label="Updating results" />);
    expect(screen.getByRole('status')).toHaveTextContent('Updating results');
  });
});
