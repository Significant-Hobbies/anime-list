import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  type DatabaseClient,
  type DatabaseResult,
  type DatabaseStatement,
  type DatabaseValue,
  setDbClient,
} from './client';

const execFileAsync = promisify(execFile);
const DATABASE_NAME = 'anime-list';

interface WranglerResult {
  results?: Record<string, unknown>[];
  success?: boolean;
  meta?: { changes?: number };
}

export interface OperatorDatabaseOptions {
  remote: boolean;
  persistTo?: string;
  configPath?: string;
}

function sqlLiteral(value: DatabaseValue): string {
  if (value === null) return 'NULL';
  if (typeof value === 'string') return `'${value.replaceAll("'", "''")}'`;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Database numbers must be finite');
    return String(value);
  }
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';

  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  return `X'${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}'`;
}

export function bindStatement(statement: DatabaseStatement): string {
  if (typeof statement === 'string') return statement;

  const args = statement.args ?? [];
  let argIndex = 0;
  let quote: "'" | '"' | '`' | null = null;
  let sql = '';

  for (let index = 0; index < statement.sql.length; index += 1) {
    const character = statement.sql[index];

    if (quote) {
      sql += character;
      if (character === quote && statement.sql[index + 1] === quote) {
        sql += statement.sql[index + 1];
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      sql += character;
      continue;
    }

    if (character === '?') {
      if (argIndex >= args.length) {
        throw new Error('Database statement has fewer arguments than placeholders');
      }
      sql += sqlLiteral(args[argIndex]);
      argIndex += 1;
      continue;
    }

    sql += character;
  }

  if (argIndex !== args.length) {
    throw new Error('Database statement has more arguments than placeholders');
  }

  return sql;
}

export function parseWranglerResults(stdout: string): WranglerResult[] {
  const trimmed = stdout.trim();
  const jsonLineIndex = trimmed.split('\n').findIndex((line) => line.trimStart().startsWith('['));
  if (jsonLineIndex === -1) {
    throw new Error('Wrangler D1 command did not return a JSON result');
  }
  const jsonPayload = trimmed.split('\n').slice(jsonLineIndex).join('\n');
  const parsed = JSON.parse(jsonPayload) as WranglerResult[];
  if (!Array.isArray(parsed) || parsed.some((result) => result.success === false)) {
    throw new Error('Wrangler D1 command returned an unsuccessful result');
  }
  return parsed;
}

function toResult(result: WranglerResult): DatabaseResult {
  return {
    rows: result.results ?? [],
    rowsAffected: result.meta?.changes ?? 0,
  };
}

function createWranglerD1Client(options: OperatorDatabaseOptions): DatabaseClient {
  if (options.remote && process.env.D1_REMOTE_APPROVED !== 'true') {
    throw new Error('Remote D1 access requires --remote and D1_REMOTE_APPROVED=true');
  }

  const wrangler = path.resolve('node_modules/.bin/wrangler');
  const configPath =
    options.configPath ?? (options.remote ? 'wrangler.cron.toml' : 'wrangler.local.toml');
  const locationArgs = options.remote ? ['--remote'] : ['--local'];
  const persistenceArgs =
    !options.remote && options.persistTo ? ['--persist-to', options.persistTo] : [];
  let queue: Promise<void> = Promise.resolve();

  const runNow = async (args: string[]): Promise<WranglerResult[]> => {
    const { stdout } = await execFileAsync(
      wrangler,
      [
        'd1',
        'execute',
        DATABASE_NAME,
        ...locationArgs,
        '--config',
        configPath,
        '--json',
        ...persistenceArgs,
        ...args,
      ],
      { maxBuffer: 128 * 1024 * 1024 }
    );
    return parseWranglerResults(stdout);
  };

  const run = (args: string[]): Promise<WranglerResult[]> => {
    const operation = queue.then(() => runNow(args));
    queue = operation.then(
      () => undefined,
      () => undefined
    );
    return operation;
  };

  return {
    async execute(statement) {
      const sql = bindStatement(statement);
      const mutation = /^\s*(?:INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql);
      const command = mutation
        ? `${sql.trim().replace(/;$/, '')}; SELECT changes() AS __rows_affected`
        : sql;
      const results = await run(['--command', command]);
      const result = toResult(results[0] ?? {});
      if (mutation) {
        result.rowsAffected = Number(results[1]?.results?.[0]?.__rows_affected ?? 0);
      }
      return result;
    },

    async batch(statements) {
      if (statements.length === 0) return [];
      const tempDirectory = await mkdtemp(path.join(tmpdir(), 'anime-list-d1-batch-'));
      const sqlPath = path.join(tempDirectory, 'batch.sql');
      try {
        const sql = `${statements.map((statement) => `${bindStatement(statement).trim().replace(/;$/, '')};`).join('\n')}\n`;
        await writeFile(sqlPath, sql, { encoding: 'utf8', mode: 0o600 });
        return (await run(['--file', sqlPath])).map(toResult);
      } finally {
        await rm(tempDirectory, { recursive: true, force: true });
      }
    },
  };
}

export function configureOperatorDatabase(options: OperatorDatabaseOptions): void {
  setDbClient(createWranglerD1Client(options));
}

export function configureOperatorDatabaseFromArgs(): void {
  const remote = process.argv.includes('--remote');
  const persistToArg = process.argv.find((argument) => argument.startsWith('--persist-to='));
  const persistTo = persistToArg?.slice('--persist-to='.length);
  configureOperatorDatabase({ remote, persistTo });
}
