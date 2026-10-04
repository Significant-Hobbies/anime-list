import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: null }) }));

import FeedbackWidgetWrapper from '../FeedbackWidgetWrapper';

describe('FeedbackWidgetWrapper', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('contains keyboard focus and restores it when dismissed with Escape', async () => {
    render(<FeedbackWidgetWrapper />);
    const trigger = screen.getByRole('button', { name: 'Feedback' });
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'Feedback' });
    await waitFor(() => expect(dialog).toHaveFocus());

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Submit Feedback' })).toHaveFocus();

    const close = screen.getByRole('button', { name: 'Close' });
    close.focus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Submit Feedback' })).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('restores focus when dismissed with the Close button', async () => {
    render(<FeedbackWidgetWrapper />);
    const trigger = screen.getByRole('button', { name: 'Feedback' });
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole('button', { name: 'Close' }));
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('restores focus when dismissed by clicking the backdrop', async () => {
    render(<FeedbackWidgetWrapper />);
    const trigger = screen.getByRole('button', { name: 'Feedback' });
    fireEvent.click(trigger);
    await screen.findByRole('dialog', { name: 'Feedback' });

    fireEvent.click(document.querySelector('.smw-overlay')!);
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
