'use client';

import { RotateCw } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
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

type IdentityState = { status: 'loading' | 'error' } | { status: 'ready'; api: GoogleIdentityApi };
const loadingIdentity: IdentityState = { status: 'loading' };
const identityListeners = new Set<() => void>();
let identityState: IdentityState = loadingIdentity;
let pendingScript: HTMLScriptElement | undefined;
let deadline: number | undefined;
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

function subscribeIdentity(listener: () => void): () => void {
  identityListeners.add(listener);
  return () => identityListeners.delete(listener);
}

function publishIdentity(state: IdentityState): void {
  identityState = state;
  for (const listener of identityListeners) listener();
}

function requestIdentity(): void {
  window.clearTimeout(deadline);
  if (window.google) {
    publishIdentity({ status: 'ready', api: window.google.accounts.id });
    return;
  }
  publishIdentity(loadingIdentity);
  // Keep an in-flight script after the UI deadline so late success can recover automatically.
  deadline = window.setTimeout(() => publishIdentity({ status: 'error' }), 12_000);
  if (pendingScript) return;

  const script = document.createElement('script');
  const finish = (api?: GoogleIdentityApi) => {
    window.clearTimeout(deadline);
    pendingScript = undefined;
    script.onload = null;
    script.onerror = null;
    if (api) {
      publishIdentity({ status: 'ready', api });
    } else {
      script.remove();
      publishIdentity({ status: 'error' });
    }
  };
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.dataset.gsiLoader = 'true';
  script.onload = () => finish(window.google?.accounts.id);
  script.onerror = () => finish();
  pendingScript = script;
  document.head.appendChild(script);
}

export default function GoogleSignInButton({ compact = false }: { compact?: boolean }) {
  const { login } = useAuth();
  const controlRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const identity = useSyncExternalStore(
    subscribeIdentity,
    () => identityState,
    () => loadingIdentity
  );
  const api = identity.status === 'ready' ? identity.api : undefined;

  useEffect(() => {
    if (identityState.status === 'loading' && !pendingScript) requestIdentity();
  }, []);

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
      ref={controlRef}
      tabIndex={-1}
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
          onClick={() => {
            controlRef.current?.focus();
            requestIdentity();
          }}
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
