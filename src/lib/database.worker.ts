/// <reference lib="webworker" />
// @ts-ignore wa-sqlite has no bundled types
import SQLiteAsyncESMFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs';
// @ts-ignore wa-sqlite has no bundled types
import * as SQLite from 'wa-sqlite';

let db: number | undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sqlite3: any;

/* ── IndexedDB helpers (persistence layer) ── */

const IDB_NAME = 'maillet-db';
const IDB_STORE = 'data';
const IDB_KEY = 'sqlite-db';

async function idbSave(bytes: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => {
      const tx = req.result.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(bytes, IDB_KEY);
      tx.oncomplete = () => { req.result.close(); resolve(); };
      tx.onerror = () => { req.result.close(); reject(tx.error); };
    };
    req.onerror = () => reject(req.error);
  });
}

async function idbLoad(): Promise<Uint8Array | null> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => {
      const tx = req.result.transaction(IDB_STORE, 'readonly');
      const getReq = tx.objectStore(IDB_STORE).get(IDB_KEY);
      getReq.onsuccess = () => { req.result.close(); resolve(getReq.result ?? null); };
      getReq.onerror = () => { req.result.close(); reject(getReq.error); };
    };
    req.onerror = () => reject(req.error);
  });
}

/* ── Legacy IDB cleanup ── */

async function cleanupLegacyIDB(): Promise<void> {
  const legacyNames = ['card-tracker.db', '/card-tracker.db'];
  for (const name of legacyNames) {
    try {
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(name);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch {
      // ignore
    }
  }
}

/* ── SQL dump serialization (no sqlite3_serialize in wa-sqlite) ── */

const COLUMNS =
  'id, card_company, amount, merchant, transaction_date, ' +
  'description, category, email_subject, email_from, ' +
  'gmail_message_id, is_verified, created_at, memo';

async function saveToIDB(): Promise<void> {
  if (db === undefined || !sqlite3) return;
  const rows: unknown[][] = [];
  for await (const stmt of sqlite3.statements(
    db,
    `SELECT ${COLUMNS} FROM card_transactions`
  )) {
    while ((await sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
      rows.push(sqlite3.row(stmt));
    }
  }
  const encoder = new TextEncoder();
  await idbSave(encoder.encode(JSON.stringify(rows)));
}

async function loadFromIDB(): Promise<void> {
  if (db === undefined || !sqlite3) return;
  const bytes = await idbLoad();
  if (!bytes) return;
  const rows = JSON.parse(new TextDecoder().decode(bytes)) as unknown[][];
  if (rows.length === 0) return;
  const colCount = COLUMNS.split(',').length;
  const placeholders = Array(colCount).fill('?').join(',');
  for (const row of rows) {
    // 旧フォーマット互換: memo列がない場合は空文字を追加
    if (row.length === colCount - 1) {
      row.push('');
    }
    for await (const stmt of sqlite3.statements(
      db,
      `INSERT OR REPLACE INTO card_transactions (${COLUMNS}) VALUES (${placeholders})`
    )) {
      sqlite3.bind_collection(stmt, row);
      await sqlite3.step(stmt);
    }
  }
}

/* ── Schema & migration ── */

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS card_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_company TEXT NOT NULL,
    amount INTEGER NOT NULL,
    merchant TEXT NOT NULL,
    transaction_date TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT,
    email_subject TEXT,
    email_from TEXT,
    gmail_message_id TEXT UNIQUE,
    is_verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    memo TEXT DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_transactions_date
    ON card_transactions(transaction_date);
  CREATE INDEX IF NOT EXISTS idx_transactions_card_company
    ON card_transactions(card_company);
  CREATE INDEX IF NOT EXISTS idx_transactions_date_company
    ON card_transactions(transaction_date, card_company);
`;

const MIGRATION_SQL = `
  UPDATE card_transactions SET card_company = '' WHERE card_company IS NULL;
  UPDATE card_transactions SET merchant = '' WHERE merchant IS NULL;
  UPDATE card_transactions SET transaction_date = '1970-01-01T00:00:00.000Z' WHERE transaction_date IS NULL;
  UPDATE card_transactions SET description = '' WHERE description IS NULL;
`;

/* ── Core functions ── */

async function init(): Promise<{ ok: true; warning?: string }> {
  if (db !== undefined) return { ok: true };

  // Pre-fetch WASM binary to bypass Emscripten's internal URL resolution
  // (locateFile alone is unreliable across dev/production/worker contexts)
  const wasmPath = `${import.meta.env.BASE_URL}wa-sqlite-async.wasm`;
  const wasmResp = await fetch(wasmPath);
  if (!wasmResp.ok) {
    throw new Error(`Failed to load wa-sqlite WASM (${wasmResp.status}) from ${wasmPath}`);
  }
  const wasmBinary = new Uint8Array(await wasmResp.arrayBuffer());

  const module = await SQLiteAsyncESMFactory({ wasmBinary });
  sqlite3 = SQLite.Factory(module);

  // Memory DB (VFS-free: avoids journal file xOpen trap)
  db = await sqlite3.open_v2(':memory:');

  // Schema
  for await (const stmt of sqlite3.statements(db, SCHEMA_SQL)) {
    await sqlite3.step(stmt);
  }
  // Migration
  for await (const stmt of sqlite3.statements(db, MIGRATION_SQL)) {
    await sqlite3.step(stmt);
  }

  // Restore data from IndexedDB
  let warning: string | undefined;
  try {
    await cleanupLegacyIDB();
    await loadFromIDB();
  } catch (error) {
    warning = 'DB復元失敗。新規DBとして開始します。';
  }

  return warning ? { ok: true, warning } : { ok: true };
}

async function query(sql: string, params: unknown[] = []) {
  if (!sqlite3 || db === undefined) throw new Error('DB not initialized');
  const rows: unknown[][] = [];
  for await (const stmt of sqlite3.statements(db, sql)) {
    if (params.length) sqlite3.bind_collection(stmt, params);
    while ((await sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
      rows.push(sqlite3.row(stmt));
    }
  }
  return rows;
}

async function execute(sql: string, params: unknown[] = []) {
  if (!sqlite3 || db === undefined) throw new Error('DB not initialized');
  let changes = 0;
  for await (const stmt of sqlite3.statements(db, sql)) {
    if (params.length) sqlite3.bind_collection(stmt, params);
    await sqlite3.step(stmt);
    changes += sqlite3.changes(db);
  }
  let lastId: number | undefined;
  if (changes > 0) {
    const rows: unknown[][] = [];
    for await (const stmt of sqlite3.statements(db, 'SELECT last_insert_rowid()')) {
      while ((await sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
        rows.push(sqlite3.row(stmt));
      }
    }
    const rowid = rows[0]?.[0] as number;
    lastId = rowid > 0 ? rowid : undefined;
  }
  return { changes, lastId };
}

/* ── Worker message handler ── */

self.addEventListener('message', async (e: MessageEvent) => {
  const { id, action, args } = e.data as {
    id: number;
    action: string;
    args: unknown[];
  };
  try {
    let result;
    switch (action) {
      case 'init':    result = await init(); break;
      case 'query':   result = await query(args[0] as string, args[1] as unknown[]); break;
      case 'execute': result = await execute(args[0] as string, args[1] as unknown[]); break;
      case 'save':    await saveToIDB(); result = { ok: true }; break;
      default: throw new Error(`Unknown action: ${action}`);
    }
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
});
