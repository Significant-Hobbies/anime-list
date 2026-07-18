import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import '@/src/styles/globals.css';
import { QueryProvider } from '@/lib/query-provider';
import { router } from './router';
import { initVitals } from './lib/vitals';
import { initApiTiming } from './lib/api-timing';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <RouterProvider router={router} />
    </QueryProvider>
  </StrictMode>
);

// Remove the LCP shell once React has mounted so it doesn't block interaction
// or linger behind the app. We use double requestAnimationFrame (not
// queueMicrotask) because microtasks run BEFORE the next paint — the shell
// would be torn down before the browser ever paints it, so the LCP element
// would never register and LCP would fall back to the React-rendered h1
// (which waits for JS download + parse + CSS + fonts). Double rAF guarantees
// the browser paints at least one frame with the shell visible, registering
// it as the LCP element at ~first paint time, then removes it the next frame
// after React content has also rendered behind it.
requestAnimationFrame(() => {
  requestAnimationFrame(() => document.getElementById('lcp-shell')?.remove());
});

initVitals();
initApiTiming();

void import('@fontsource/inter/latin-400.css');
void import('@fontsource/inter/latin-600.css');
