import { createHash } from 'node:crypto';

const APPLICATION_TABLES = new Set([
  'users',
  'user_tags',
  'anime_watchlist',
  'manga_watchlist',
  'anime_dismissals',
  'anime_schedule',
  'watching_schedule_preferences',
  'library_details',
  'library_tags',
  'library_entry_tags',
  'anime_data',
  'catalog_title_metadata',
  'manga_data',
  'anime_relations_cache',
  'anime_recommendations_cache',
  'saved_searches',
  'saved_search_alerts',
  'collections',
  'collection_items',
  'user_api_tokens',
  'assistant_write_grants',
  'assistant_discovery_preferences',
  'assistant_recommendation_feedback',
  'assistant_franchise_edges',
  'assistant_anime_details',
  'assistant_manga_details',
  'assistant_manga_edges',
  'assistant_franchise_monitors',
  'assistant_release_events',
  'assistant_provider_attempts',
  'assistant_manga_attempts',
]);

const HEADER = 'PRAGMA defer_foreign_keys = true;\n';
const IGNORED_TABLES = new Set(['d1_migrations', 'sqlite_sequence', '_cf_KV', '_cf_METADATA']);

export function splitStatements(sql) {
  const statements = [];
  let current = '';
  let quote = null;

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    current += character;

    if (quote) {
      if (character === quote && sql[index + 1] === quote) {
        current += sql[index + 1];
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (character === ';') {
      statements.push(current.trim());
      current = '';
    }
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

function normalizeTableName(value) {
  return value.replace(/^["'`[]|["'`\]]$/g, '');
}

function decodeUnistrValue(value) {
  let decoded = '';
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character !== '\\') {
      decoded += character;
      continue;
    }

    if (value[index + 1] === '\\') {
      decoded += '\\';
      index += 1;
      continue;
    }

    const marker = value[index + 1];
    const width = marker === '+' ? 6 : marker === 'U' ? 8 : 4;
    const hexStart = marker === '+' || marker === 'u' || marker === 'U' ? index + 2 : index + 1;
    const hex = value.slice(hexStart, hexStart + width);
    if (!/^[0-9a-f]+$/i.test(hex) || hex.length !== width) {
      decoded += '\\';
      continue;
    }

    decoded += String.fromCodePoint(Number.parseInt(hex, 16));
    index = hexStart + width - 1;
  }
  return decoded;
}

export function normalizeUnistrCalls(sql) {
  return sql.replace(/unistr\('((?:''|[^'])*)'\)/gi, (_match, literal) => {
    const decoded = decodeUnistrValue(literal.replaceAll("''", "'"));
    return `'${decoded.replaceAll("'", "''")}'`;
  });
}

function chunkStatements(statements, maxBytes) {
  const chunks = [];
  let current = HEADER;
  for (const statement of statements) {
    const next = `${statement.sql}\n`;
    if (current !== HEADER && Buffer.byteLength(current) + Buffer.byteLength(next) > maxBytes) {
      chunks.push(current);
      current = HEADER;
    }
    current += next;
  }
  if (current !== HEADER) chunks.push(current);

  return chunks;
}

function replayInsert(sourceStatement, table) {
  const prefix = /^INSERT(?:\s+OR\s+REPLACE)?\s+INTO/i;
  const insert = sourceStatement.replace(prefix, 'INSERT INTO').replace(/;$/, '');
  if (table === 'library_tags' || table === 'library_entry_tags')
    return insert + ' ON CONFLICT DO NOTHING;';
  if (table === 'library_details')
    return (
      insert +
      ` ON CONFLICT(user_id,media,mal_id) DO UPDATE SET
    rating=excluded.rating,notes=excluded.notes,
    created_at=excluded.created_at,updated_at=excluded.updated_at,completed_at=excluded.completed_at;`
    );
  if (table !== 'anime_watchlist' && table !== 'manga_watchlist')
    return sourceStatement.replace(prefix, 'INSERT OR REPLACE INTO');

  // Preseed unknown legacy timestamps before insert triggers run. The source's
  // actual dated metadata (if available) is replayed after parent and tag rows.
  const media = table === 'anime_watchlist' ? 'anime' : 'manga';
  const columns =
    media === 'anime' ? 'user_id,mal_id,tag_id,title,type,episodes,note' : 'user_id,mal_id,tag_id';
  const parts = insert.match(/^INSERT INTO\s+[^\s(]+\s*(?:\(([^)]+)\))?\s*(VALUES[\s\S]+)$/i);
  if (!parts) throw new Error('Unsupported watchlist backup row');
  const prepareDates = `WITH source(${parts[1] ?? columns}) AS (${parts[2]})
    INSERT INTO library_details(user_id,media,mal_id) SELECT user_id,'${media}',mal_id FROM source WHERE true ON CONFLICT DO NOTHING;`;
  const fields =
    media === 'anime'
      ? 'tag_id=excluded.tag_id,title=excluded.title,type=excluded.type,episodes=excluded.episodes,note=excluded.note'
      : 'tag_id=excluded.tag_id';
  return (
    prepareDates + '\n' + insert + ' ON CONFLICT(user_id,mal_id) DO UPDATE SET ' + fields + ';'
  );
}

export function prepareD1Import(sourceSql, options = {}) {
  const maxBytes = options.maxBytes ?? 4 * 1024 * 1024;
  const statements = [];
  const preferences = [];
  const assignments = [];
  const details = [];
  const tableStatementCounts = {};

  for (const rawSourceStatement of splitStatements(sourceSql)) {
    const sourceStatement = normalizeUnistrCalls(rawSourceStatement);
    const match = sourceStatement.match(/^INSERT(?:\s+OR\s+REPLACE)?\s+INTO\s+([^\s(]+)/i);
    if (!match) continue;

    const table = normalizeTableName(match[1]);
    if (IGNORED_TABLES.has(table)) continue;
    if (!APPLICATION_TABLES.has(table)) {
      throw new Error(`Unexpected source table in dump: ${table}`);
    }

    const statement = replayInsert(sourceStatement, table);
    if (Buffer.byteLength(`${HEADER}${statement}\n`) > maxBytes) {
      throw new Error(`Source statement for ${table} exceeds the ${maxBytes}-byte chunk limit`);
    }

    const target =
      {
        assistant_write_grants: preferences,
        watching_schedule_preferences: preferences,
        assistant_release_events: assignments,
        library_entry_tags: assignments,
        library_details: details,
      }[table] ?? statements;
    target.push({ table, sql: statement });
    tableStatementCounts[table] = (tableStatementCounts[table] ?? 0) + 1;
  }

  // Restore child preferences after their parents regardless of dump order.
  const ordered = statements.concat(preferences, assignments, details);
  const chunks = chunkStatements(ordered, maxBytes);

  return {
    chunks,
    manifest: {
      schemaVersion: 'anime-list-d1-import.v1',
      sourceSha256: createHash('sha256').update(sourceSql).digest('hex'),
      statementCount: ordered.length,
      chunkCount: chunks.length,
      maxChunkBytes: Math.max(0, ...chunks.map((chunk) => Buffer.byteLength(chunk))),
      tableStatementCounts,
      chunks: chunks.map((chunk, index) => ({
        file: `${String(index + 1).padStart(4, '0')}.sql`,
        bytes: Buffer.byteLength(chunk),
        sha256: createHash('sha256').update(chunk).digest('hex'),
      })),
    },
  };
}
