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

initVitals();
initApiTiming();

void import('@fontsource/inter/latin-400.css');
void import('@fontsource/inter/latin-600.css');
