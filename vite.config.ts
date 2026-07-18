import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';

/** Load extracted app CSS without blocking first paint — index.html carries the LCP shell. */
function deferAppCss(): Plugin {
  return {
    name: 'defer-app-css',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace(
          /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/g,
          (match, href) => {
            if (match.includes('rel="preload"')) return match;
            return [
              `<link rel="preload" href="${href}" as="style" onload="this.onload=null;this.rel='stylesheet'">`,
              `<noscript><link rel="stylesheet" href="${href}"></noscript>`,
            ].join('\n    ');
          }
        );
      },
    },
  };
}

export default defineConfig(() => ({
  server: {
    host: '::',
    port: 5173,
  },
  plugins: [react(), tailwindcss(), deferAppCss()],
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
