/// <reference types="vite/client" />

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

declare module '@/lib/feedback-widget/index.mjs' {
  export { FeedbackWidget } from '@/lib/feedback-widget';
}
