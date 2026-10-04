/// <reference types="vite/client" />

import type { DetailedHTMLProps, HTMLAttributes } from 'react';

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_HOME_QUIZ_ABOVE_FOLD?: string;
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_SAASMAKER_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    appHealth?: {
      track(name: string): void;
    };
  }
}

declare module 'react' {
  // biome-ignore lint/style/noNamespace: React's JSX intrinsic element augmentation uses this namespace.
  namespace JSX {
    interface IntrinsicElements {
      'saas-maker-newsletter-capture': DetailedHTMLProps<
        HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        'catalog-id': string;
        'product-name'?: string;
        kind?: 'newsletter' | 'waitlist';
        source?: string;
        'privacy-url'?: string;
        layout?: 'compact';
        integrated?: string;
        theme?: 'light' | 'dark';
      };
    }
  }
}
