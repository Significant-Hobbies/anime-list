import { defineConfig } from "blume";

/**
 * Blume configuration for the Shelf (anime_list) knowledge base.
 *
 * Blume is the PRESENTATION and SEARCH layer only. The committed Markdown
 * under docs/ is the source of truth; this file does not change content.
 *
 * Install Blume separately (it is NOT a runtime dependency of the product):
 *   pnpm add -D blume
 *
 * Local authoring preview (does not write dist/):
 *   pnpm exec blume dev
 *
 * Publishing a static build — IMPORTANT: `blume build` writes to dist/ by
 * default, which collides with the Vite SPA's dist/. Build in isolation so
 * the SPA's dist/ is untouched:
 *   pnpm exec blume build --isolated     # -> .blume-verify/dist
 * or set BLUME_RUNTIME_DIR=.blume-verify before building.
 *
 * Generated artifacts (.blume/, .blume-verify/, docs-dist/) are gitignored.
 */
export default defineConfig({
  title: "Shelf (anime_list) Docs",
  description:
    "Knowledge base for Shelf / MAL Explorer — anime/manga discovery platform.",

  content: {
    root: "docs",
  },

  // The product already has a favicon; Blume auto-detects one in public/.
  // logo: "/favicon.svg",

  search: {
    provider: "orama",
  },

  ai: {
    llmsTxt: true,
  },

  seo: {
    og: { enabled: true },
    sitemap: true,
    robots: true,
    structuredData: true,
  },

  deployment: {
    output: "static",
    // Set when publishing to a real docs domain. Left unset here so local
    // dev falls back to the dev server origin.
    // site: "https://docs.anime.significanthobbies.com",
  },
});
