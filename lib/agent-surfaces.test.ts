import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// scripts/build-agent-surfaces.mjs regenerates these files on every build, so
// anything the generator forgets is silently dropped from the deployed site.
// Nothing else fails when that happens: the URLs keep working and the pages
// keep rendering, so the only symptom is a generated file quietly shrinking.
// These assertions are the alarm.
const root = join(__dirname, '..');
const readPublic = (name: string) => readFileSync(join(root, 'public', name), 'utf8');

describe('generated agent surfaces', () => {
  it('advertises the OpenAPI spec in the agent catalog', () => {
    const catalog = JSON.parse(readPublic('api-ai.json'));
    expect(catalog.openapi).toBe('https://anime.significanthobbies.com/openapi.json');
  });

  it('claims Markdown content negotiation, which the site actually serves', () => {
    // `Accept: text/markdown` on the homepage returns text/markdown, so
    // declaring false here understates the product to every agent that reads
    // this file.
    const catalog = JSON.parse(readPublic('api-ai.json'));
    expect(catalog.markdown).toMatchObject({ suffix: '.md', negotiation: true });
  });

  it('keeps the developer-facing sections in llms.txt', () => {
    const llms = readPublic('llms.txt');
    expect(llms).toContain('## Developer docs');
    expect(llms).toContain('## CLI');
    expect(llms).toContain('/openapi.json');
    expect(llms).toContain('Accept: text/markdown');
  });
});
