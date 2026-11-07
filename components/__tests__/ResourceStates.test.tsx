import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ErrorState } from '@saas-maker/ui/components/error-state';
import ResultsGrid from '../ResultsGrid';
import MangaResultsGrid from '../MangaResultsGrid';

afterEach(cleanup);

it.each([ResultsGrid, MangaResultsGrid])('renders an empty collection without an error', (Grid) => {
  const { container } = render(<Grid results={{ filteredList: [], totalFiltered: 0 }} />);
  expect(screen.getByText('no titles match')).toBeInTheDocument();
  expect(container.querySelector('[data-slot="empty-state"]')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('offers a working retry action on failures', () => {
  const retry = vi.fn();
  render(<ErrorState title="could not load results" onRetry={retry} />);
  expect(screen.getByRole('alert')).toHaveTextContent('could not load results');
  fireEvent.click(screen.getByRole('button', { name: 'try again' }));
  expect(retry).toHaveBeenCalledTimes(1);
});
