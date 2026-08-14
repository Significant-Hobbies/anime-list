import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import '@/src/styles/globals.css';
import { router } from './router';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);

function initMonitoring() {
  void import('./lib/vitals').then(({ initVitals }) => initVitals());
  void import('./lib/api-timing').then(({ initApiTiming }) => initApiTiming());
}

if (document.readyState === 'complete') {
  initMonitoring();
} else {
  window.addEventListener('load', initMonitoring, { once: true });
}
