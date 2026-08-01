#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prepareD1Import } from './lib/d1-import.mjs';

function readOption(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

const input = readOption('input');
const outputDir = readOption('output-dir');
const maxBytesValue = readOption('max-bytes');
const maxBytes = maxBytesValue ? Number(maxBytesValue) : undefined;

if (
  !input ||
  !outputDir ||
  (maxBytes !== undefined && (!Number.isInteger(maxBytes) || maxBytes < 1024))
) {
  console.error(
    'usage: pnpm db:prepare-import -- --input=<turso.sql> --output-dir=<new-dir> [--max-bytes=4194304]'
  );
  process.exit(1);
}

const sourceSql = await readFile(input, 'utf8');
const prepared = prepareD1Import(sourceSql, { maxBytes });
await mkdir(outputDir, { recursive: false, mode: 0o700 });

for (const [index, chunk] of prepared.chunks.entries()) {
  const file = `${String(index + 1).padStart(4, '0')}.sql`;
  await writeFile(path.join(outputDir, file), chunk, { encoding: 'utf8', mode: 0o600 });
}

await writeFile(
  path.join(outputDir, 'manifest.json'),
  `${JSON.stringify(prepared.manifest, null, 2)}\n`,
  {
    encoding: 'utf8',
    mode: 0o600,
  }
);

console.log(
  `Prepared ${prepared.manifest.statementCount} data statements in ${prepared.manifest.chunkCount} chunk(s)`
);
