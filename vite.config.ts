import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(() => ({
  server: {
    host: '::',
    port: 5173,
  },
  plugins: [react(), tailwindcss()],
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      drafts: { customMedia: true },
    },
  },
  build: {
    cssMinify: 'lightningcss',
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('posthog-js')) return 'posthog';
            if (id.includes('@tanstack/react-router')) return 'router';
            if (id.includes('@tanstack/react-query')) return 'query';
            if (id.includes('react-dom') || id.includes('/react/')) return 'react';
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
}));
