'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { LoadingStatus, Skeleton } from '@/components/ui/loading-state';

const PRODUCTION_GOOGLE_CLIENT_ID =
  '207924374505-0mur9a99sal0ckob0vt38pcdj360ond5.apps.googleusercontent.com';

function getGoogleClientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || PRODUCTION_GOOGLE_CLIENT_ID;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            ux_mode?: 'popup' | 'redirect';
            itp_support?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type: 'standard' | 'icon';
              theme: 'outline' | 'filled_blue' | 'filled_black';
              size: 'small' | 'medium';
              shape: 'rectangular' | 'pill' | 'circle' | 'square';
              text?: 'signin_with';
              logo_alignment?: 'left' | 'center';
              width?: number;
            }
          ) => void;
        };
      };
    };
  }
}

type GoogleIdentityApi = NonNullable<Window['google']>['accounts']['id'];

let initializedIdentityApi: GoogleIdentityApi | null = null;
let activeLogin: ((credential: string) => Promise<void>) | null = null;

function initializeGoogleIdentity(api: GoogleIdentityApi, clientId: string): void {
  if (initializedIdentityApi === api) return;
  api.initialize({
    client_id: clientId,
    // The rendered button uses Google's popup flow instead of One Tap's
    // FedCM prompt. The popup is initiated by a real user click and works
    // with Safari's Intelligent Tracking Prevention.
    ux_mode: 'popup',
    itp_support: true,
    callback: async (response) => {
      try {
        await activeLogin?.(response.credential);
      } catch (err) {
        console.error('Login failed:', err);
      }
    },
  });
  initializedIdentityApi = api;
}

export default function GoogleSignInButton() {
  const { login } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const clientId = getGoogleClientId();
    if (!clientId) return;

    const initGoogle = () => {
      if (!window.google || !buttonRef.current || initializedRef.current) return;
      initializedRef.current = true;
      activeLogin = login;
      const identityApi = window.google.accounts.id;
      initializeGoogleIdentity(identityApi, clientId);
      identityApi.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'medium',
        shape: 'rectangular',
        text: 'signin_with',
        logo_alignment: 'left',
        width: 160,
      });
      setReady(true);
    };

    if (window.google) {
      initGoogle();
      return;
    }

    // Inject the GSI script on demand. Previously this lived in the root
    // layout (`Script src=accounts.google.com/gsi/client lazyOnload`) which
    // pulled 186 KiB on every page including the landing, where most
    // visitors never sign in. Loading from here keeps the home LCP clean
    // and only pays the cost on routes that actually render the button.
    const existing = document.querySelector<HTMLScriptElement>('script[data-gsi-loader="true"]');
    const script = existing ?? document.createElement('script');
    if (!existing) {
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.gsiLoader = 'true';
      document.head.appendChild(script);
    }
    const onLoad = () => initGoogle();
    script.addEventListener('load', onLoad);
    return () => script.removeEventListener('load', onLoad);
  }, [login]);

  return (
    <div className="relative h-8 w-40" aria-busy={!ready || undefined}>
      {!ready && (
        <>
          <Skeleton className="absolute inset-0 rounded-sm" />
          <LoadingStatus label="Loading Google sign-in" />
        </>
      )}
      <div ref={buttonRef} className="relative h-8 w-40 overflow-hidden rounded-sm" />
    </div>
  );
}
