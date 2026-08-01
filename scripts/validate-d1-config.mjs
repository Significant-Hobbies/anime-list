#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const config = readFileSync('wrangler.cron.toml', 'utf8');
const databaseId = config.match(/database_id\s*=\s*"([^"]+)"/)?.[1];
const hasBinding = /binding\s*=\s*"DB"/.test(config);
const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
  databaseId ?? ''
);

if (!hasBinding || !isUuid) {
  console.error('deploy blocked: wrangler.cron.toml needs an approved DB binding and D1 UUID');
  process.exit(1);
}

const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
const deployBranch =
  branch || (process.env.GITHUB_ACTIONS === 'true' ? process.env.GITHUB_REF_NAME : '');

if (deployBranch !== 'main' || dirty) {
  console.error(
    `deploy blocked: expected clean main, found ${deployBranch || 'detached HEAD'}${dirty ? ' with changes' : ''}`
  );
  process.exit(1);
}

console.log(`D1 deploy configuration verified for ${databaseId}`);
