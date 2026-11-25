import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
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

test('replaying a watchlist dump preserves dependent schedule preferences', () => {
  const db = new DatabaseSync(':memory:');
  try {
    for (const name of ['0001_initial', '0003_watching_schedule']) {
      db.exec(readFileSync(new URL(`../../migrations/d1/${name}.sql`, import.meta.url), 'utf8'));
    }
    db.exec("INSERT INTO user_tags(id,user_id,name) VALUES ('tag','u','Watching')");
    db.exec("INSERT INTO anime_watchlist(user_id,mal_id,tag_id,note) VALUES ('u','1','tag','old')");
    db.exec(
      "INSERT INTO watching_schedule_preferences(user_id,mal_id,episodes_watched,hidden) VALUES ('u','1',5,1)"
    );
    const { chunks } = prepareD1Import(
      "INSERT OR REPLACE INTO anime_watchlist VALUES ('u','1','tag','New title',NULL,12,'new');"
    );
    for (const chunk of chunks) db.exec(chunk);
    assert.equal(db.prepare('SELECT note FROM anime_watchlist').get().note, 'new');
    assert.equal(
      db.prepare('SELECT episodes_watched FROM watching_schedule_preferences WHERE hidden=1').get()
        ?.episodes_watched,
      5
    );
  } finally {
    db.close();
  }
});
