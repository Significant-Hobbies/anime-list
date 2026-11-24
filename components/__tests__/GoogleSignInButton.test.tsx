import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { login } = vi.hoisted(() => ({ login: vi.fn() }));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ login }),
}));

describe('GoogleSignInButton', () => {
  beforeEach(() => {
    login.mockReset();
    delete window.google;
    vi.resetModules();
  });

  it('renders the interactive Google popup button for Safari-compatible sign-in', async () => {
    const { default: GoogleSignInButton } = await import('../GoogleSignInButton');
    const initialize = vi.fn();
    const renderButton = vi.fn();
    window.google = { accounts: { id: { initialize, renderButton } } };

    render(
      <>
        <GoogleSignInButton />
        <GoogleSignInButton />
      </>
    );

    await waitFor(() => expect(renderButton).toHaveBeenCalledTimes(2));
    expect(initialize).toHaveBeenCalledOnce();
    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        ux_mode: 'popup',
        itp_support: true,
        use_fedcm_for_button: true,
      })
    );
    expect(renderButton).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        type: 'standard',
        theme: 'outline_dark',
        shape: 'pill',
        size: 'medium',
        text: 'continue_with',
        logo_alignment: 'left',
        width: 220,
      })
    );
  });

  it('retries a failed Google script once for both visible sign-in controls', async () => {
    const { default: GoogleSignInButton } = await import('../GoogleSignInButton');
    render(
      <>
        <GoogleSignInButton compact />
        <GoogleSignInButton />
      </>
    );
    const currentScript = () => {
      const scripts = document.querySelectorAll('script[data-gsi-loader]');
      expect(scripts).toHaveLength(1);
      return scripts[0]!;
    };
    const first = await waitFor(currentScript);
    fireEvent.error(first);
    const retry = await screen.findAllByRole('button', { name: 'Retry Google sign-in' });
    expect(retry).toHaveLength(2);
    expect(first.isConnected).toBe(false);

    fireEvent.click(retry[0]!);
    const second = await waitFor(currentScript);
    expect(second).not.toBe(first);
    const initialize = vi.fn();
    const renderButton = vi.fn();
    window.google = { accounts: { id: { initialize, renderButton } } };
    fireEvent.load(second);
    await waitFor(() => expect(renderButton).toHaveBeenCalledTimes(2));
    expect(initialize).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Retry Google sign-in' })).toBeNull();
    second.remove();
  });
});
