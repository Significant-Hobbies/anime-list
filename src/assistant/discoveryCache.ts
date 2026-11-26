import { getDb, type DatabaseClient } from '../db/client';

type PublicRows = Record<string, unknown>[];
interface PackedPage {
  fields: string[];
  values: string;
}
interface Entry {
  pages: PackedPage[];
  bytes: number;
}
interface Store {
  filling: boolean;
  entries: Map<string, Entry>;
  bytes: number;
}
// UTF-16 upper bound, plus a fixed allowance for each page and field names.
// Keep only catalog projection rows. Account state and rankings stay request-local.
const LIMIT = 16 * 1024 * 1024;
const MAX_ENTRIES = 12;
const stores = new WeakMap<DatabaseClient, Store>();
function cacheFor(db: DatabaseClient) {
  let store = stores.get(db);
  if (!store) {
    store = { entries: new Map(), bytes: 0, filling: false };
    stores.set(db, store);
  }
  return store;
}
function publish(store: Store, key: string, entry: Entry) {
  const current = store.entries.get(key);
  if (current) {
    store.bytes -= current.bytes;
    store.entries.delete(key);
  }
  store.entries.set(key, entry);
  store.bytes += entry.bytes;
  while (store.bytes > LIMIT || store.entries.size > MAX_ENTRIES) {
    const oldest = store.entries.keys().next().value;
    if (oldest === undefined) break;
    store.bytes -= store.entries.get(oldest)!.bytes;
    store.entries.delete(oldest);
  }
}
export async function catalogRevision() {
  const r = await getDb().execute(
    'SELECT revision FROM assistant_discovery_revision WHERE singleton=1'
  );
  return Number(r.rows[0].revision);
}
export async function* publicCatalogPages(
  signature: string,
  revision: number,
  read: () => AsyncGenerator<PublicRows>
) {
  const store = cacheFor(getDb());
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signature));
  // Hash the SQL shape and its public filtering parameters. The store retains no input text.
  const key = revision + ':' + Array.from(new Uint8Array(digest)).join('.');
  const hit = store.entries.get(key);
  if (hit) {
    store.entries.delete(key);
    store.entries.set(key, hit);
    for (const page of hit.pages) {
      const decoded = JSON.parse(page.values) as unknown[][];
      yield decoded.map((values) => Object.fromEntries(page.fields.map((f, i) => [f, values[i]])));
    }
    return;
  }
  // Concurrent cold requests stream independently. Only one may allocate a
  // pending snapshot per database/isolate; cross-request I/O isn't shared.
  if (store.filling) {
    yield* read();
    return;
  }
  store.filling = true;
  try {
    let pending: Entry | null = { pages: [], bytes: 0 };
    for await (const rows of read()) {
      if (pending && rows.length) {
        const fields = Object.keys(rows[0]);
        const values = JSON.stringify(rows.map((r) => fields.map((f) => r[f])));
        pending.bytes += values.length * 2 + fields.join('').length * 2 + 1024;
        if (pending.bytes > LIMIT) pending = null;
        else pending.pages.push({ fields, values });
      }
      yield rows;
    }
    if (pending) publish(store, key, pending);
  } finally {
    store.filling = false;
  }
}
