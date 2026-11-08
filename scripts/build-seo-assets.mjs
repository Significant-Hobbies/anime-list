#!/usr/bin/env node
// Keep the full public snapshot in immutable static shards, not Function code.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shardSize = 200;
const maxBytes = 512 * 1024;
const assets = process.argv.includes('--assets');
const check = process.argv.includes('--check');
const collections = {};
for (const kind of ['anime', 'manga']) {
  const entries = JSON.parse(readFileSync(resolve(root, `src/data/seo-${kind}.json`), 'utf8'));
  const shards = [];
  for (let start = 0; start < entries.length; start += shardSize) {
    const rows = entries.slice(start, start + shardSize);
    const content = JSON.stringify({ version: 1, kind, entries: rows }) + '\n';
    const bytes = Buffer.byteLength(content);
    if (bytes > maxBytes) throw new Error(`${kind} shard exceeds ${maxBytes} bytes`);
    const sha256 = createHash('sha256').update(content).digest('hex');
    const path = `/catalog-data/${kind}/${sha256}.json`;
    shards.push({ path, sha256, count: rows.length, bytes });
    if (assets) {
      const target = resolve(root, 'dist', path.slice(1));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content);
    }
  }
  collections[kind] = { titles: entries.map(({ id, title }) => ({ id, title })), shards };
  console.log(`${kind}: ${entries.length} titles in ${shards.length} immutable public shards`);
}
const manifest = JSON.stringify({ version: 1, shardSize, maxBytes, collections }) + '\n';
const target = resolve(root, 'src/data/seo-index.json');
if (assets || check) {
  if (readFileSync(target, 'utf8') !== manifest)
    throw new Error('SEO asset index drift; regenerate before build');
} else writeFileSync(target, manifest);
