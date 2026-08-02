import { fireEvent, render, screen } from '@testing-library/react';
import { DiscoverSelect, DiscoverToggleButton, GenrePills } from './ui';

describe('discover filter accessibility', () => {
  it('associates the visible label with a select trigger', () => {
    render(
      <DiscoverSelect
        label="Sort"
        value="score"
        onValueChange={() => undefined}
        options={[{ value: 'score', label: 'Score' }]}
      />
    );

    expect(screen.getByRole('combobox', { name: 'Sort' })).toBeInTheDocument();
  });

  it('exposes whether additional filters are expanded', () => {
    const { rerender } = render(<DiscoverToggleButton active={false} onClick={() => undefined} />);

    expect(screen.getByRole('button', { name: 'More filters' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );

    rerender(<DiscoverToggleButton active onClick={() => undefined} />);

    expect(screen.getByRole('button', { name: 'More filters' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('exposes genre selection state and keeps the toggle operable', () => {
    const onToggle = vi.fn();

    render(<GenrePills genres={['Action', 'Comedy']} selected={['Action']} onToggle={onToggle} />);

    expect(screen.getByRole('button', { name: 'Action' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Comedy' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Comedy' }));
    expect(onToggle).toHaveBeenCalledWith('Comedy');
  });
});
