import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CatalogGridSkeleton, ListSkeleton, RefreshIndicator } from './loading-state';

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

  it('only renders refresh feedback while active', () => {
    const { rerender } = render(<RefreshIndicator active={false} label="Updating results" />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    rerender(<RefreshIndicator active label="Updating results" />);
    expect(screen.getByRole('status')).toHaveTextContent('Updating results');
  });
});
