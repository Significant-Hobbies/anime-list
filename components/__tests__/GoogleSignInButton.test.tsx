import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { login } = vi.hoisted(() => ({ login: vi.fn() }));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ login }),
}));

import GoogleSignInButton from '../GoogleSignInButton';

describe('GoogleSignInButton', () => {
  beforeEach(() => {
    login.mockReset();
  });

  it('renders the interactive Google popup button for Safari-compatible sign-in', async () => {
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
      expect.objectContaining({ ux_mode: 'popup', itp_support: true })
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
        width: 172,
      })
    );
  });
});
