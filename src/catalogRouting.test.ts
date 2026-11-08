// @vitest-environment node
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_generateASSETSBinding } from 'wrangler';
import { onRequest } from '../functions/_middleware';
import catalog from './data/catalog-pages.json';
import { escapeHtml } from './seoRewrite';

const origin = 'https://anime.significanthobbies.com';
const directory = mkdtempSync(join(tmpdir(), 'anime-catalog-routing-'));
const abort = new AbortController();
const warnings: string[] = [];
const fixtureFiles: string[] = [];
let assets: Awaited<ReturnType<typeof unstable_generateASSETSBinding>>;

beforeAll(async () => {
  // Exercise the installed Pages asset handler with the real catch-all rules.
  // A plain file read or Pages dev server alone misses this production boundary.
  execFileSync(process.execPath, ['scripts/build-catalog.mjs']);
  writeFileSync(join(directory, 'index.html'), readFileSync('index.html'));
  writeFileSync(join(directory, '_redirects'), readFileSync('public/_redirects'));
  for (const page of catalog) {
    const target = join(directory, page.path.slice(1) + '.html');
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(resolve('dist', page.path.slice(1) + '.html')));
    fixtureFiles.push(target);
  }
  assets = await unstable_generateASSETSBinding({
    directory,
    log: {
      log() {},
      debug() {},
      info() {},
      warn(message: string) {
        warnings.push(message);
      },
      error() {},
    },
    signal: abort.signal,
  } as never);
});
afterAll(() => {
  abort.abort();
  for (const file of fixtureFiles) unlinkSync(file);
  for (const folder of [...new Set(fixtureFiles.map(dirname))]
    .filter((folder) => folder !== directory)
    .sort((a, b) => b.length - a.length))
    rmdirSync(folder);
  // Remove only the fixture's known empty directories and files.
  rmdirSync(join(directory, 'catalog'));
  unlinkSync(join(directory, 'index.html'));
  unlinkSync(join(directory, '_redirects'));
  rmdirSync(directory);
});

async function request(path: string, method = 'GET') {
  const req = new Request(origin + path, { method, headers: { Accept: 'text/html' } });
  return onRequest({
    request: req,
    env: { ASSETS: { fetch: (input: Request) => assets(input as never) } },
    next: () => assets(req as never),
  } as never);
}

describe('catalog HTTP routing through real Pages redirect rules', () => {
  it('retains the observed installed asset behavior with the real redirect rules', async () => {
    const fallback = await assets(new Request(origin + '/catalog') as never);
    const version = JSON.parse(readFileSync('node_modules/wrangler/package.json', 'utf8')).version;
    expect(version).toBe(JSON.parse(readFileSync('package.json', 'utf8')).devDependencies.wrangler);
    process.stdout.write(
      JSON.stringify({ wranglerVersion: version, redirectWarnings: warnings }) + '\n'
    );
    expect(fallback.status).toBe(200);
    expect(fallback.headers.get('location')).toBeNull();
    expect(await fallback.text()).toContain('<h1>Anime and manga title catalog</h1>');
  });

  it('serves every catalog GET with its exact heading, canonical and real links', async () => {
    for (const page of catalog) {
      const response = await request(page.path);
      expect(response.status, page.path).toBe(200);
      expect(response.headers.get('location'), page.path).toBeNull();
      expect(response.headers.get('content-type')).toContain('text/html');
      const html = await response.text();
      expect(html).toContain(`<h1>${escapeHtml(page.title)}</h1>`);
      expect(html).toContain(`rel="canonical" href="${origin}${page.path}"`);
      if (page.kind) expect(html).toMatch(new RegExp(`href="/${page.kind}/\\d+"`));
      else {
        expect(html).toContain('href="/catalog/anime/1"');
        expect(html).toContain('href="/catalog/manga/1"');
      }
      expect(html).not.toContain('id="boot-shell"');
    }
  });

  it('serves every catalog HEAD at the same URL with HTML headers and no body', async () => {
    for (const page of catalog) {
      const response = await request(page.path, 'HEAD');
      expect(response.status, page.path).toBe(200);
      expect(response.headers.get('location'), page.path).toBeNull();
      expect(response.headers.get('content-type')).toContain('text/html');
      expect(await response.text(), page.path).toBe('');
    }
  });
});
