import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeUnistrCalls, prepareD1Import, splitStatements } from './d1-import.mjs';

test('splitStatements preserves semicolons and escaped quotes inside values', () => {
  assert.deepEqual(splitStatements("INSERT INTO users VALUES ('a;''b'); SELECT 1;"), [
    "INSERT INTO users VALUES ('a;''b');",
    'SELECT 1;',
  ]);
});

test('prepareD1Import keeps only approved data and makes chunks repeatable', () => {
  const source = [
    'CREATE TABLE users (id TEXT);',
    "INSERT INTO d1_migrations VALUES (1, '0001_initial.sql');",
    "INSERT INTO users VALUES ('u1');",
    "INSERT INTO anime_data VALUES (1, 'url', 'title');",
  ].join('\n');
  const prepared = prepareD1Import(source, { maxBytes: 1024 });

  assert.equal(prepared.manifest.statementCount, 2);
  assert.equal(prepared.manifest.chunkCount, 1);
  assert.deepEqual(prepared.manifest.tableStatementCounts, { users: 1, anime_data: 1 });
  assert.match(prepared.chunks[0], /INSERT OR REPLACE INTO users/);
  assert.doesNotMatch(prepared.chunks[0], /CREATE TABLE/);
});

test('prepareD1Import rejects unexpected source tables', () => {
  assert.throws(
    () => prepareD1Import("INSERT INTO unknown_table VALUES ('x');"),
    /Unexpected source table/
  );
});

test('prepareD1Import splits on a byte boundary without splitting statements', () => {
  const source = Array.from(
    { length: 20 },
    (_, index) => `INSERT INTO users VALUES ('user-${index}-${'x'.repeat(60)}');`
  ).join('\n');
  const prepared = prepareD1Import(source, { maxBytes: 1024 });

  assert.ok(prepared.chunks.length > 1);
  assert.ok(prepared.chunks.every((chunk) => Buffer.byteLength(chunk) <= 1024));
  assert.equal(
    prepared.chunks.reduce(
      (count, chunk) => count + (chunk.match(/INSERT OR REPLACE INTO/g)?.length ?? 0),
      0
    ),
    20
  );
});

test('normalizeUnistrCalls converts new SQLite dump literals for D1', () => {
  assert.equal(
    normalizeUnistrCalls(
      "INSERT INTO notes VALUES(unistr('line\\u000abreak\\\\path ''quoted'' \\+01f680'));"
    ),
    "INSERT INTO notes VALUES('line\nbreak\\path ''quoted'' 🚀');"
  );
});
