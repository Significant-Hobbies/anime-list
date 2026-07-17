import { describe, it, expect } from 'vitest';
import {
  rewriteShell,
  rewriteShellNoindex,
  escapeHtml,
  escapeJsonLd,
  buildJsonLd,
  buildHeadBlock,
  buildSsrSummary,
  type SeoEntry,
} from './seoRewrite';

const SHELL = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <!-- seo:start -->
    <title>Shelf — Discover anime &amp; manga</title>
    <meta name="description" content="Default desc" />
    <link rel="canonical" href="https://anime.significanthobbies.com" />
    <!-- seo:end -->
  </head>
  <body>
    <div id="root">
      <!-- ssr:start -->
      <!-- ssr:end -->
      <div>SPA shell</div>
    </div>
  </body>
</html>`;

const animeEntry: SeoEntry = {
  id: 5114,
  title: 'Fullmetal Alchemist: Brotherhood',
  titleEnglish: 'Fullmetal Alchemist: Brotherhood',
  type: 'TV',
  synopsis: 'After a horrific alchemy experiment goes wrong...',
  score: 9.1,
  scoredBy: 2235918,
  genres: ['Action', 'Adventure', 'Drama'],
  year: 2009,
  episodes: 64,
  image: 'https://cdn.myanimelist.net/images/anime/1208/94745.jpg',
};

const mangaEntry: SeoEntry = {
  id: 1,
  title: 'Monster',
  type: 'Manga',
  synopsis: 'Kenzou Tenma, a renowned Japanese neurosurgeon...',
  score: 9.16,
  scoredBy: 113836,
  genres: ['Drama', 'Mystery', 'Psychological'],
  year: 1994,
  chapters: 162,
  volumes: 18,
  image: null,
};

describe('escapeHtml', () => {
  it('escapes ampersands, angle brackets, quotes', () => {
    expect(escapeHtml('a&b<c>"d"\'e\'')).toBe('a&amp;b&lt;c&gt;&quot;d&quot;&#39;e&#39;');
  });

  it('handles empty strings', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('escapeJsonLd', () => {
  it('neutralizes </script> sequences', () => {
    expect(escapeJsonLd('</script>')).toBe('<\\/script>');
    expect(escapeJsonLd('</SCRIPT>')).toBe('<\\/script>');
  });
});

describe('buildJsonLd', () => {
  it('produces TVSeries for anime with type TV', () => {
    const jsonLd = buildJsonLd(
      animeEntry,
      'anime',
      'https://anime.significanthobbies.com/anime/5114'
    );
    expect(jsonLd['@type']).toBe('TVSeries');
    expect(jsonLd).toHaveProperty('numberOfEpisodes', 64);
    expect(jsonLd).toHaveProperty('aggregateRating');
  });

  it('produces Movie for anime with type Movie', () => {
    const movie: SeoEntry = { ...animeEntry, type: 'Movie', episodes: 1 };
    const jsonLd = buildJsonLd(movie, 'anime', 'https://example.com/anime/1');
    expect(jsonLd['@type']).toBe('Movie');
    expect(jsonLd).not.toHaveProperty('numberOfEpisodes');
  });

  it('produces Book for manga', () => {
    const jsonLd = buildJsonLd(mangaEntry, 'manga', 'https://example.com/manga/1');
    expect(jsonLd['@type']).toBe('Book');
    expect(jsonLd).toHaveProperty('bookFormat');
    expect(jsonLd).toHaveProperty('numberOfPages', 162);
  });

  it('omits aggregateRating when score is null or 0', () => {
    const noScore: SeoEntry = { ...animeEntry, score: null, scoredBy: null };
    const jsonLd = buildJsonLd(noScore, 'anime', 'https://example.com/anime/1');
    expect(jsonLd).not.toHaveProperty('aggregateRating');
  });
});

describe('buildHeadBlock', () => {
  it('includes title, description, canonical, OG, and JSON-LD', () => {
    const block = buildHeadBlock(
      animeEntry,
      'anime',
      'https://anime.significanthobbies.com/anime/5114'
    );
    expect(block).toContain('<title>Fullmetal Alchemist: Brotherhood — Shelf</title>');
    expect(block).toContain('name="description"');
    expect(block).toContain('rel="canonical"');
    expect(block).toContain('property="og:title"');
    expect(block).toContain('application/ld+json');
  });

  it('escapes HTML in title', () => {
    const dangerous: SeoEntry = { ...animeEntry, title: '<script>alert(1)</script>' };
    const block = buildHeadBlock(dangerous, 'anime', 'https://example.com/anime/1');
    expect(block).not.toContain('<script>alert(1)</script>');
    expect(block).toContain('&lt;script&gt;');
  });
});

describe('buildSsrSummary', () => {
  it('produces hidden div with h1 and synopsis', () => {
    const summary = buildSsrSummary(animeEntry, 'anime');
    expect(summary).toContain('data-ssr');
    expect(summary).toContain('display:none');
    expect(summary).toContain('<h1>Fullmetal Alchemist: Brotherhood</h1>');
    expect(summary).toContain('After a horrific alchemy');
  });

  it('includes facts table with score, genres, year, episodes', () => {
    const summary = buildSsrSummary(animeEntry, 'anime');
    expect(summary).toContain('<dt>Score</dt>');
    expect(summary).toContain('<dt>Genres</dt>');
    expect(summary).toContain('<dt>Year</dt>');
    expect(summary).toContain('<dt>Episodes</dt>');
  });
});

describe('rewriteShell', () => {
  it('replaces head block and inserts SSR summary', () => {
    const result = rewriteShell(SHELL, {
      origin: 'https://anime.significanthobbies.com',
      kind: 'anime',
      entry: animeEntry,
    });

    // Head: title replaced
    expect(result).toContain('<title>Fullmetal Alchemist: Brotherhood — Shelf</title>');
    expect(result).not.toContain('Shelf — Discover anime');

    // Canonical updated
    expect(result).toContain('href="https://anime.significanthobbies.com/anime/5114"');

    // JSON-LD present and parseable
    const jsonLdMatch = result.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(jsonLdMatch).not.toBeNull();
    const parsed = JSON.parse(jsonLdMatch![1]);
    expect(parsed['@type']).toBe('TVSeries');
    expect(parsed.name).toBe('Fullmetal Alchemist: Brotherhood');

    // SSR summary inserted
    expect(result).toContain('data-ssr');
    expect(result).toContain('<h1>Fullmetal Alchemist: Brotherhood</h1>');

    // SPA shell still present
    expect(result).toContain('SPA shell');
    expect(result).toContain('<div id="root">');
  });

  it('handles </script> injection in title', () => {
    const dangerous: SeoEntry = {
      ...animeEntry,
      title: '</script><script>alert(1)</script>',
      synopsis: 'safe',
    };
    const result = rewriteShell(SHELL, {
      origin: 'https://example.com',
      kind: 'anime',
      entry: dangerous,
    });

    // The JSON-LD block must not contain a raw </script> from the title
    const jsonLdMatches = result.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
    );
    expect(jsonLdMatches).not.toBeNull();
    // Each JSON-LD script block should parse correctly
    for (const block of jsonLdMatches!) {
      const content = block.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1];
      expect(() => JSON.parse(content)).not.toThrow();
    }
  });

  it('throws if seo markers are missing', () => {
    const badHtml = '<html><head></head><body></body></html>';
    expect(() =>
      rewriteShell(badHtml, {
        origin: 'https://example.com',
        kind: 'anime',
        entry: animeEntry,
      })
    ).toThrow('seo:start/end markers not found');
  });

  it('throws if ssr markers are missing', () => {
    const badHtml = '<html><head><!-- seo:start --><!-- seo:end --></head><body></body></html>';
    expect(() =>
      rewriteShell(badHtml, {
        origin: 'https://example.com',
        kind: 'anime',
        entry: animeEntry,
      })
    ).toThrow('ssr:start/end markers not found');
  });
});

describe('rewriteShellNoindex', () => {
  it('replaces head block with noindex meta', () => {
    const result = rewriteShellNoindex(SHELL);
    expect(result).toContain('name="robots"');
    expect(result).toContain('noindex');
    expect(result).not.toContain('rel="canonical"');
  });

  it('throws if seo markers are missing', () => {
    const badHtml = '<html><head></head><body></body></html>';
    expect(() => rewriteShellNoindex(badHtml)).toThrow('seo:start/end markers not found');
  });
});
