import type React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { auth, logout } = vi.hoisted(() => ({
  auth: {
    user: null as null | { id: string; name: string; email: string; picture: string | null },
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  },
  logout: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: '/' } }),
}));

vi.mock('@/lib/auth', () => ({ useAuth: () => auth }));
vi.mock('../GoogleSignInButton', () => ({ default: () => <span>Sign in</span> }));

import Navigation from '../Navigation';

describe('Navigation', () => {
  beforeEach(() => {
    auth.user = null;
    auth.loading = false;
    auth.logout = logout;
    logout.mockReset();
  });

  it('keeps primary links visible and closes More with Escape', () => {
    render(<Navigation />);
    expect(screen.getByRole('link', { name: 'Search' })).toHaveAttribute('href', '/search');
    expect(screen.getByRole('link', { name: 'Watchlist' })).toHaveAttribute('href', '/watchlist');
    expect(screen.getByRole('link', { name: 'Schedule' })).toHaveAttribute('href', '/schedule');
    const summary = screen.getByText('More');
    const details = summary.closest('details');
    expect(details).not.toHaveAttribute('open');
    fireEvent.click(summary);
    expect(details).toHaveAttribute('open');
    const quiz = screen.getByRole('link', { name: 'Taste quiz' });
    expect(quiz).toHaveAttribute('href', '/discover');
    fireEvent.keyDown(quiz, { key: 'Escape' });
    expect(details).not.toHaveAttribute('open');
    expect(summary).toHaveFocus();
  });

  it('shows an accessible account placeholder while auth resolves', () => {
    auth.loading = true;

    render(<Navigation />);

    expect(screen.getByRole('status')).toHaveTextContent('Checking sign-in status');
    expect(screen.queryByText('Sign in')).not.toBeInTheDocument();
  });

  it('keeps the signed-in account controls available', () => {
    auth.user = {
      id: 'u1',
      name: 'Sarthak Agrawal',
      email: 'sarthak@example.com',
      picture: null,
    };

    render(<Navigation />);
    fireEvent.click(screen.getByText('Sarthak').closest('summary')!);
    expect(screen.getByText('sarthak@example.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(logout).toHaveBeenCalledOnce();
  });
});
