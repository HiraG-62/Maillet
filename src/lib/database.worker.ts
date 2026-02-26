/// <reference lib="webworker" />
// @ts-ignore wa-sqlite has no bundled types
import SQLiteAsyncESMFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs';
// @ts-ignore wa-sqlite has no bundled types
import * as SQLite from 'wa-sqlite';

let db: number | undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sqlite3: any;

const DB_NAME = 'card-tracker.db';

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
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_transactions_date
    ON card_transactions(transaction_date);
  CREATE INDEX IF NOT EXISTS idx_transactions_card_company
    ON card_transactions(card_company);
  CREATE INDEX IF NOT EXISTS idx_transactions_date_company
    ON card_transactions(transaction_date, card_company);
`;

async function init(): Promise<{ ok: true; warning?: string }> {
  console.log('[DEBUG-096] init() called');
  console.log('[DEBUG-096] current db state:', db !== undefined ? 'already initialized' : 'not initialized');
  if (db !== undefined) return { ok: true };
  const module = await SQLiteAsyncESMFactory();
  sqlite3 = SQLite.Factory(module);

  // IDBBatchAtomicVFS: IndexedDB-based VFS (no COOP/COEP headers required, works on GitHub Pages)
  console.log('[DEBUG-096] Attempting IDBBatchAtomicVFS...');
  let warning: string | undefined;
  try {
    const { IDBBatchAtomicVFS } = await import(
      // @ts-expect-error dynamic path
      'wa-sqlite/src/examples/IDBBatchAtomicVFS.js'
    );
    const vfs = new IDBBatchAtomicVFS(DB_NAME, { durability: 'relaxed' });
    sqlite3.vfs_register(vfs, true);
    db = await sqlite3.open_v2(
      DB_NAME,
      SQLite.SQLITE_OPEN_READWRITE | SQLite.SQLITE_OPEN_CREATE,
      DB_NAME
    );
    console.log('[DEBUG-096] IDBBatchAtomicVFS created successfully');

    // WAL mode prevents journal file errors (IDBBatchAtomicVFS + default rollback journal
    // causes "file not found: /xxx-journal" because xOpen lacks SQLITE_OPEN_CREATE for journals)
    for await (const stmt of sqlite3.statements(db, 'PRAGMA journal_mode=WAL')) {
      while ((await sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
        const mode = sqlite3.row(stmt);
        console.log('[DEBUG-096] journal_mode set to:', mode[0]);
      }
    }
  } catch (error) {
    // IDB unavailable (test env, etc.) → in-memory fallback
    console.error('[DEBUG-096] IDBBatchAtomicVFS FAILED:', error);
    db = await sqlite3.open_v2(':memory:');
    warning = 'DB永続化失敗。データはセッション終了時に消えます。';
    console.warn('[DEBUG-096] Using :memory: fallback —', warning);
  }

  for await (const stmt of sqlite3.statements(db, SCHEMA_SQL)) {
    await sqlite3.step(stmt);
  }

  // マイグレーション: 旧スキーマで NULL が入った可能性のある行を修正
  const MIGRATION_SQL = `
    UPDATE card_transactions SET card_company = '' WHERE card_company IS NULL;
    UPDATE card_transactions SET merchant = '' WHERE merchant IS NULL;
    UPDATE card_transactions SET transaction_date = '1970-01-01T00:00:00.000Z' WHERE transaction_date IS NULL;
    UPDATE card_transactions SET description = '' WHERE description IS NULL;
  `;
  for await (const stmt of sqlite3.statements(db, MIGRATION_SQL)) {
    await sqlite3.step(stmt);
  }

  // DB open後のテーブル行数確認ログ
  const tableCountRows: unknown[][] = [];
  for await (const stmt of sqlite3.statements(db, 'SELECT count(*) FROM card_transactions')) {
    while ((await sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
      tableCountRows.push(sqlite3.row(stmt));
    }
  }
  console.log('[DEBUG-096] DB opened. Table count (card_transactions rows):', tableCountRows[0]?.[0]);

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
  // wa-sqlite は last_insert_rowid を JS メソッドとして expose しないため
  // SQL で取得する（changes > 0 の場合のみ = INSERT が成功した場合のみ）
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
      default: throw new Error(`Unknown action: ${action}`);
    }
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
});
