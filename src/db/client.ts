import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';

export type DatabaseValue = string | number | bigint | boolean | null | ArrayBuffer | Uint8Array;

export type DatabaseStatement =
  | string
  | {
      sql: string;
      args?: DatabaseValue[];
    };

export interface DatabaseResult {
  rows: Record<string, unknown>[];
  rowsAffected: number;
}

export interface DatabaseClient {
  execute(statement: DatabaseStatement): Promise<DatabaseResult>;
  batch(statements: DatabaseStatement[], mode?: 'read' | 'write'): Promise<DatabaseResult[]>;
}

const D1_BATCH_SIZE = 100;

let client: DatabaseClient | null = null;
let boundDatabase: D1Database | null = null;

function normalizeStatement(statement: DatabaseStatement): { sql: string; args: DatabaseValue[] } {
  const sql = typeof statement === 'string' ? statement : statement.sql;
  const args = typeof statement === 'string' ? [] : (statement.args ?? []);

  if (sql.trim() === '') {
    throw new TypeError('Database statement must include SQL');
  }

  return { sql, args };
}

function prepare(database: D1Database, statement: DatabaseStatement): D1PreparedStatement {
  const { sql, args } = normalizeStatement(statement);
  const prepared = database.prepare(sql);
  return args.length > 0 ? prepared.bind(...args) : prepared;
}

function toResult(result: {
  results?: Record<string, unknown>[];
  meta?: { changes?: number };
}): DatabaseResult {
  return {
    rows: result.results ?? [],
    rowsAffected: result.meta?.changes ?? 0,
  };
}

export function createD1Client(database: D1Database): DatabaseClient {
  if (!database || typeof database.prepare !== 'function') {
    throw new Error('Missing DB D1 binding');
  }

  return {
    async execute(statement) {
      const result = await prepare(database, statement).all<Record<string, unknown>>();
      return toResult(result);
    },

    async batch(statements) {
      const results: DatabaseResult[] = [];
      for (let offset = 0; offset < statements.length; offset += D1_BATCH_SIZE) {
        const chunk = statements.slice(offset, offset + D1_BATCH_SIZE);
        const chunkResults = await database.batch<Record<string, unknown>>(
          chunk.map((statement) => prepare(database, statement))
        );
        results.push(...chunkResults.map(toResult));
      }
      return results;
    },
  };
}

export function bindD1Database(database: D1Database): void {
  if (boundDatabase === database && client) return;
  boundDatabase = database;
  client = createD1Client(database);
}

export function setDbClient(nextClient: DatabaseClient): void {
  boundDatabase = null;
  client = nextClient;
}

export function getDb(): DatabaseClient {
  if (!client) {
    throw new Error(
      'Database client is not configured; bind the local or Worker D1 database first'
    );
  }
  return client;
}

/** Anime and manga share one production D1 database and ownership boundary. */
export function getMangaCatalogDb(): DatabaseClient {
  return getDb();
}
