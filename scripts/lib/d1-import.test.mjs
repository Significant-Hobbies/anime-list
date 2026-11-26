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
    "INSERT INTO assistant_discovery_pages VALUES ('anime',0,1,'old','obsolete');",
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
    for (const name of ['0001_initial', '0003_watching_schedule', '0004_assistant_library']) {
      db.exec(readFileSync(new URL(`../../migrations/d1/${name}.sql`, import.meta.url), 'utf8'));
    }
    db.exec("INSERT INTO user_tags(id,user_id,name) VALUES ('tag','u','Watching')");
    db.exec("INSERT INTO anime_watchlist(user_id,mal_id,tag_id,note) VALUES ('u','1','tag','old')");
    db.exec(
      "INSERT INTO watching_schedule_preferences(user_id,mal_id,episodes_watched,hidden) VALUES ('u','1',5,1)"
    );
    const { chunks } = prepareD1Import(
      "INSERT INTO user_tags(id,user_id,name) VALUES ('new-tag','u','Watching');" +
        "INSERT OR REPLACE INTO anime_watchlist VALUES ('u','1','new-tag','New title',NULL,12,'new');"
    );
    for (const chunk of chunks) db.exec(chunk);
    assert.equal(db.prepare('SELECT note FROM anime_watchlist').get().note, 'new');
    assert.equal(
      db.prepare('SELECT episodes_watched FROM watching_schedule_preferences WHERE hidden=1').get()
        ?.episodes_watched,
      5
    );
    const reversed = prepareD1Import(
      "INSERT INTO watching_schedule_preferences VALUES ('u','2',3,7,NULL,0);" +
        "INSERT INTO anime_watchlist VALUES ('u','2','new-tag','Another title',NULL,12,NULL);"
    );
    for (const chunk of reversed.chunks) db.exec(chunk);
    assert.equal(
      db
        .prepare("SELECT episodes_watched FROM watching_schedule_preferences WHERE mal_id='2'")
        .get()?.episodes_watched,
      7
    );
  } finally {
    db.close();
  }
});

test('restores classifications, private ratings and original dates for both media', () => {
  const db = new DatabaseSync(':memory:');
  try {
    for (const name of ['0001_initial', '0003_watching_schedule', '0004_assistant_library']) {
      db.exec(readFileSync(new URL(`../../migrations/d1/${name}.sql`, import.meta.url), 'utf8'));
    }
    const source = [
      "INSERT INTO library_entry_tags VALUES('u','manga','1','Fav');",
      "INSERT INTO library_details VALUES('u','manga','1',8,'Read',NULL,'2024-01-02T00:00:00.000Z',NULL);",
      "INSERT INTO manga_watchlist VALUES('u','1','t');",
      "INSERT INTO anime_watchlist(user_id,mal_id,tag_id) VALUES('u','2','t');",
      "INSERT INTO library_tags VALUES('u','Fav');",
      "INSERT INTO user_tags(id,user_id,name) VALUES('t','u','Done');",
    ].join('\n');
    const { chunks } = prepareD1Import(source, { maxBytes: 1100 });
    for (let run = 0; run < 2; run++) for (const sql of chunks) db.exec(sql);
    const rows = db
      .prepare(
        'SELECT media,rating,tags,notes,created_at,updated_at,completed_at FROM assistant_library ORDER BY media'
      )
      .all();
    assert.deepEqual(
      { ...rows[0] },
      {
        media: 'anime',
        rating: null,
        tags: '[]',
        notes: null,
        created_at: null,
        updated_at: null,
        completed_at: null,
      }
    );
    assert.deepEqual(
      { ...rows[1] },
      {
        media: 'manga',
        rating: 8,
        tags: '["Fav"]',
        notes: 'Read',
        created_at: null,
        updated_at: '2024-01-02T00:00:00.000Z',
        completed_at: null,
      }
    );
  } finally {
    db.close();
  }
});

test('replaying an older token row preserves revocation, owner and independent write grants', () => {
  const db = new DatabaseSync(':memory:');
  try {
    for (const name of ['0001_initial', '0007_mcp_grants']) {
      db.exec(readFileSync(new URL(`../../migrations/d1/${name}.sql`, import.meta.url), 'utf8'));
    }
    db.exec(
      "INSERT INTO user_api_tokens VALUES('id','owner','original','hash',NULL,'created','revoked')"
    );
    db.exec("INSERT INTO assistant_write_grants VALUES('hash')");
    const dump =
      "INSERT INTO user_api_tokens VALUES('id','owner','restored','hash',NULL,'created',NULL);";
    for (const sql of prepareD1Import(dump + dump.replace("'owner'", "'other'")).chunks)
      db.exec(sql);
    assert.deepEqual(
      { ...db.prepare('SELECT user_id,name,revoked_at,last_used_at FROM user_api_tokens').get() },
      { user_id: 'owner', name: 'restored', revoked_at: 'revoked', last_used_at: null }
    );
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM assistant_write_grants').get().count, 1);
  } finally {
    db.close();
  }
});
