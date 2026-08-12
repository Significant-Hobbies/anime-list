'use client';

import type posthogType from 'posthog-js';

const PROJECT_SLUG = 'anime_list';
const POSTHOG_KEY =
  import.meta.env.VITE_POSTHOG_KEY ?? 'phc_qgiAarw4Co4pw9fz3Fxj4UJaHmqzFetqs4JrXhGc35Nd';
const POSTHOG_HOST = 'https://us.i.posthog.com';

let posthogPromise: Promise<typeof posthogType> | null = null;

function loadPosthog() {
  if (!posthogPromise) {
    posthogPromise = import('posthog-js').then((mod) => mod.default);
  }
  return posthogPromise;
}

function route() {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}${window.location.pathname}`;
}

function messageFrom(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

export async function capturePageCrash(
  error: unknown,
  source: 'window_error' | 'unhandled_rejection' | 'manual'
) {
  const posthog = await loadPosthog();
  posthog.capture('foundry_page_crash', {
    project_id: PROJECT_SLUG,
    route: route(),
    source,
    message: messageFrom(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}

export function installBrowserMonitoring() {
  if (typeof window === 'undefined') return () => {};

  void loadPosthog().then((posthog) => {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: 'always',
      capture_pageview: false,
      autocapture: false,
    });
  });

  const onError = (event: ErrorEvent) => {
    void capturePageCrash(event.error ?? event.message, 'window_error');
  };
  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    void capturePageCrash(event.reason, 'unhandled_rejection');
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
  };
}
