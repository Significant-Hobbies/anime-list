'use client';

import { useResource } from '@saas-maker/ui/lib/use-resource';
import { RotateCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
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
            use_fedcm_for_button?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type: 'standard' | 'icon';
              theme: 'outline' | 'outline_dark' | 'filled_blue' | 'filled_black';
              size: 'small' | 'medium' | 'large';
              shape: 'rectangular' | 'pill' | 'circle' | 'square';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
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
    // Let Chrome mediate sign-in instead of the legacy cross-origin
    // session iframe, whose report-only frame-ancestors policy logs errors.
    use_fedcm_for_button: true,
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

function loadIdentity(signal: AbortSignal): Promise<GoogleIdentityApi> {
  if (window.google) return Promise.resolve(window.google.accounts.id);

  // This resource shares one request across the header and signed-out panels.
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const finish = (api?: GoogleIdentityApi) => {
      window.clearTimeout(deadline);
      signal.removeEventListener('abort', onAbort);
      script.onload = null;
      script.onerror = null;
      if (api) {
        resolve(api);
      } else {
        script.remove();
        reject(new Error('Google sign-in is unavailable'));
      }
    };
    const onAbort = () => finish();
    const deadline = window.setTimeout(onAbort, 12_000);
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }

    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.gsiLoader = 'true';
    script.onload = () => finish(window.google?.accounts.id);
    script.onerror = () => finish();
    document.head.appendChild(script);
  });
}

export default function GoogleSignInButton({ compact = false }: { compact?: boolean }) {
  const { login } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const identity = useResource('anime-list:google-identity', loadIdentity, {
    staleTime: 60 * 60 * 1000,
    retries: 0,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  const api = identity.data;

  useEffect(() => {
    const clientId = getGoogleClientId();
    if (!clientId || !api || !buttonRef.current || initializedRef.current) return;

    initializedRef.current = true;
    activeLogin = login;
    initializeGoogleIdentity(api, clientId);
    api.renderButton(buttonRef.current, {
      type: compact ? 'icon' : 'standard',
      theme: 'outline_dark',
      size: compact ? 'large' : 'medium',
      shape: compact ? 'circle' : 'pill',
      text: 'continue_with',
      logo_alignment: 'left',
      ...(compact ? {} : { width: 220 }),
    });
    setReady(true);
  }, [api, login, compact]);

  return (
    <div
      className={compact ? 'relative h-10 w-10' : 'relative h-8 w-[220px]'}
      aria-busy={(!ready && identity.status !== 'error') || undefined}
    >
      {identity.status === 'error' && !ready ? (
        <Button
          type="button"
          variant="outline"
          size={compact ? 'icon' : 'sm'}
          className={compact ? 'h-full w-full rounded-full' : 'w-full'}
          aria-label="Retry Google sign-in"
          title="Retry Google sign-in"
          onClick={() => void identity.retry()}
        >
          {compact ? <RotateCw aria-hidden="true" /> : 'Retry Google sign-in'}
        </Button>
      ) : (
        <>
          {!ready && (
            <>
              <Skeleton className="absolute inset-0 rounded-sm" />
              <LoadingStatus label="Loading Google sign-in" />
            </>
          )}
          <div
            ref={buttonRef}
            className={compact ? 'relative h-10 w-10' : 'relative h-8 w-[220px] rounded-full'}
          />
        </>
      )}
    </div>
  );
}
