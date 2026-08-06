import type { D1Database } from '@cloudflare/workers-types';
import { describe, expect, it, vi } from 'vitest';
import { createD1Client } from './client';
import { bindStatement, parseWranglerResults } from './operatorClient';

function createFakeDatabase() {
  const all = vi.fn(async () => ({ results: [{ value: 1 }], meta: { changes: 2 } }));
  const bind = vi.fn(() => ({ all }));
  const prepare = vi.fn(() => ({ bind, all }));
  const batch = vi.fn(async (statements: unknown[]) =>
    statements.map(() => ({ results: [], meta: { changes: 1 } }))
  );

  return {
    database: { prepare, batch } as unknown as D1Database,
    prepare,
    bind,
    batch,
  };
}

describe('D1 database client', () => {
  it('preserves the libSQL-shaped execute result used by domain modules', async () => {
    const fake = createFakeDatabase();
    const db = createD1Client(fake.database);

    const result = await db.execute({ sql: 'SELECT ? AS value', args: [1] });

    expect(fake.prepare).toHaveBeenCalledWith('SELECT ? AS value');
    expect(fake.bind).toHaveBeenCalledWith(1);
    expect(result).toEqual({ rows: [{ value: 1 }], rowsAffected: 2 });
  });

  it('chunks large batches at the D1 boundary without dropping results', async () => {
    const fake = createFakeDatabase();
    const db = createD1Client(fake.database);
    const statements = Array.from({ length: 205 }, (_, index) => ({
      sql: 'INSERT INTO items (id) VALUES (?)',
      args: [index],
    }));

    const results = await db.batch(statements);

    expect(fake.batch).toHaveBeenCalledTimes(3);
    expect(results).toHaveLength(205);
    expect(results.every((result) => result.rowsAffected === 1)).toBe(true);
  });
});

describe('Wrangler statement binding', () => {
  it('escapes values without replacing question marks inside SQL strings', () => {
    expect(
      bindStatement({
        sql: "INSERT INTO notes (body, marker, active) VALUES (?, '?', ?)",
        args: ["Sora's note", true],
      })
    ).toBe("INSERT INTO notes (body, marker, active) VALUES ('Sora''s note', '?', 1)");
  });

  it('rejects placeholder and argument mismatches', () => {
    expect(() => bindStatement({ sql: 'SELECT ?', args: [] })).toThrow(/fewer arguments/);
    expect(() => bindStatement({ sql: 'SELECT 1', args: [1] })).toThrow(/more arguments/);
  });
});

describe('Wrangler result parsing', () => {
  it('ignores status output before a JSON batch result', () => {
    const output = `├ Checking if file needs uploading
│ 🌀 Uploading complete.
│
[
  {"results":[{"Rows written":2}],"success":true,"meta":{"changes":2}}
]`;

    expect(parseWranglerResults(output)).toEqual([
      { results: [{ 'Rows written': 2 }], success: true, meta: { changes: 2 } },
    ]);
  });

  it('rejects output without a JSON result', () => {
    expect(() => parseWranglerResults('Upload failed')).toThrow(/did not return a JSON result/);
  });
});
