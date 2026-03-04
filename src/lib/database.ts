import Dexie, { type Table } from 'dexie';

/* ── Internal row types ── */

interface CTRow {
  id?: number;
  card_company: string;
  amount: number;
  merchant: string;
  transaction_date: string;
  description: string;
  category: string | null;
  category_source: string | null;
  email_subject: string | null;
  email_from: string | null;
  gmail_message_id: string | null;
  is_verified: number;
  created_at: string;
  memo: string;
  tags: string;
}

interface LKRow {
  provider: string;
  encrypted_data: string;
  iv: string;
  salt: string;
  version: number;
  created_at: string;
  updated_at: string;
}

/* ── Dexie database ── */

class MailletDB extends Dexie {
  card_transactions!: Table<CTRow, number>;
  llm_keys!: Table<LKRow, string>;

  constructor() {
    super('maillet-dexie');
    this.version(1).stores({
      card_transactions:
        '++id, &gmail_message_id, transaction_date, card_company, category',
      llm_keys: 'provider',
    });
    this.version(2).stores({
      card_transactions:
        '++id, &gmail_message_id, transaction_date, card_company, category, category_source',
      llm_keys: 'provider',
    }).upgrade(tx => {
      return tx.table('card_transactions').toCollection().modify(row => {
        if (row.category_source === undefined) {
          row.category_source = null;
        }
      });
    });
  }
}

const db = new MailletDB();
let initialized = false;

/* ── Helpers ── */

function ym(d: string): string {
  return d.substring(0, 7);
}

function toTuple(t: CTRow): unknown[] {
  return [
    t.id, t.card_company, t.amount, t.merchant, t.transaction_date,
    t.description, t.category, t.email_subject, t.email_from,
    t.gmail_message_id, t.is_verified, t.created_at, t.memo, t.tags,
    t.category_source ?? null,
  ];
}

/* ── Migration from old wa-sqlite IDB ── */

async function migrateFromOldIDB(): Promise<void> {
  try {
    const existing = await db.card_transactions.count();
    if (existing > 0) return;

    const data = await new Promise<Uint8Array | null>((resolve) => {
      const req = indexedDB.open('maillet-db', 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('data')) {
          req.result.createObjectStore('data');
        }
      };
      req.onsuccess = () => {
        const idb = req.result;
        if (!idb.objectStoreNames.contains('data')) {
          idb.close();
          resolve(null);
          return;
        }
        try {
          const tx = idb.transaction('data', 'readonly');
          const g = tx.objectStore('data').get('sqlite-db');
          g.onsuccess = () => { idb.close(); resolve(g.result ?? null); };
          g.onerror = () => { idb.close(); resolve(null); };
        } catch { idb.close(); resolve(null); }
      };
      req.onerror = () => resolve(null);
    });

    if (!data) return;

    const rows = JSON.parse(new TextDecoder().decode(data)) as unknown[][];
    if (rows.length === 0) return;

    const objects: CTRow[] = rows.map((r) => {
      while (r.length < 14) {
        if (r.length === 12) r.push('');
        else if (r.length === 13) r.push('[]');
        else r.push(null);
      }
      return {
        id: r[0] as number,
        card_company: (r[1] as string) ?? '',
        amount: (r[2] as number) ?? 0,
        merchant: (r[3] as string) ?? '',
        transaction_date: (r[4] as string) ?? '1970-01-01T00:00:00.000Z',
        description: (r[5] as string) ?? '',
        category: r[6] as string | null,
        category_source: null,
        email_subject: r[7] as string | null,
        email_from: r[8] as string | null,
        gmail_message_id: r[9] as string | null,
        is_verified: (r[10] as number) ?? 0,
        created_at: (r[11] as string) ?? new Date().toISOString(),
        memo: (r[12] as string) ?? '',
        tags: (r[13] as string) ?? '[]',
      };
    });

    await db.card_transactions.bulkPut(objects);
    console.log(`[DB] Migrated ${objects.length} rows from old IDB`);
    indexedDB.deleteDatabase('maillet-db');
    indexedDB.deleteDatabase('card-tracker.db');
    indexedDB.deleteDatabase('/card-tracker.db');
  } catch (err) {
    console.warn('[DB] Migration failed (non-fatal):', err);
  }
}

/* ── Public API ── */

export async function initDB(): Promise<{ warning?: string }> {
  if (initialized) return {};
  try {
    await db.open();
    await migrateFromOldIDB();
    initialized = true;
    return {};
  } catch (err) {
    console.warn('[DB] initDB error:', err);
    initialized = true;
    return { warning: 'DB初期化中に問題が発生しました。' };
  }
}

export async function queryDB<T = unknown[]>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const s = sql.replace(/\s+/g, ' ').trim();

  /* ═══ llm_keys ═══ */
  if (s.includes('llm_keys')) {
    return queryLlmKeys<T>(s, params);
  }

  /* ═══ card_transactions ═══ */
  return queryCardTx<T>(s, params);
}

async function queryLlmKeys<T>(s: string, params: unknown[]): Promise<T[]> {
  if (s.includes('COUNT(*)')) {
    const c = await db.llm_keys.where('provider').equals(params[0] as string).count();
    return [[c]] as unknown as T[];
  }
  if (s.includes('encrypted_data, iv, salt') && s.includes('WHERE provider')) {
    const r = await db.llm_keys.get(params[0] as string);
    if (!r) return [];
    return [[r.encrypted_data, r.iv, r.salt]] as unknown as T[];
  }
  if (s.includes('provider, encrypted_data')) {
    const all = await db.llm_keys.toArray();
    all.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return all.map((r) => [
      r.provider, r.encrypted_data, r.iv, r.salt,
      r.version, r.created_at, r.updated_at,
    ]) as unknown as T[];
  }
  if (s.includes('SELECT provider FROM')) {
    const all = await db.llm_keys.toArray();
    all.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return all.map((r) => [r.provider]) as unknown as T[];
  }
  return [];
}

async function queryCardTx<T>(s: string, params: unknown[]): Promise<T[]> {
  /* ── subscription detector: GROUP_CONCAT ── */
  if (s.includes('GROUP_CONCAT')) {
    return querySubscriptions<T>();
  }

  /* ── monthly trend: strftime as mo ── */
  if (s.includes(' as mo')) {
    return queryMonthlyTrend<T>(s, params);
  }

  /* ── top merchants: COALESCE(merchant ── */
  if (s.includes('COALESCE(merchant')) {
    return queryTopMerchants<T>(params);
  }

  /* ── category totals: GROUP BY category ── */
  if (s.includes('GROUP BY category')) {
    return queryCategoryTotals<T>(s, params);
  }

  /* ── by card: GROUP BY card_company ── */
  if (s.includes('GROUP BY card_company')) {
    return queryByCard<T>(s, params);
  }

  /* ── unclassified merchants: GROUP BY merchant + category null ── */
  if (s.includes('GROUP BY merchant')) {
    return queryUnclassifiedMerchants<T>(params);
  }

  /* ── SUM + COUNT (no GROUP BY): monthly summary ── */
  if (s.includes('SUM(amount)') && !s.includes('GROUP BY')) {
    return queryMonthlySummary<T>(s, params);
  }

  /* ── simple COUNT ── */
  if (s.includes('COUNT(*)') && !s.includes('GROUP BY')) {
    return queryCount<T>(s);
  }

  /* ── SELECT gmail_message_id list ── */
  if (s.includes('SELECT gmail_message_id')) {
    const all = await db.card_transactions.toArray();
    return all
      .filter((t) => t.gmail_message_id != null)
      .map((t) => [t.gmail_message_id]) as unknown as T[];
  }

  /* ── SELECT id by gmail_message_id ── */
  if (s.includes('SELECT id FROM') && s.includes('gmail_message_id')) {
    const r = await db.card_transactions
      .where('gmail_message_id')
      .equals(params[0] as string)
      .first();
    return r ? [[r.id]] as unknown as T[] : [];
  }

  /* ── SELECT id FROM ... WHERE merchant = ? ── */
  if (s.includes('SELECT id FROM') && s.includes('WHERE merchant')) {
    const merchantParam = params[0] as string;
    let all = await db.card_transactions.toArray();
    all = all.filter((t) => t.merchant === merchantParam);
    if (s.includes('category IS NULL') || s.includes("category = ''")) {
      all = all.filter((t) => t.category == null || t.category === '');
    }
    return all.map((t) => [t.id]) as unknown as T[];
  }

  /* ── SELECT merchant, category (for learned rules) ── */
  if (s.includes('SELECT merchant, category')) {
    let all = await db.card_transactions.toArray();
    all = all.filter((t) => t.category != null && t.category !== '');
    if (s.includes('category_source')) {
      all = all.filter((t) => t.category_source == null || t.category_source === 'manual');
    }
    return all.map((t) => [t.merchant, t.category]) as unknown as T[];
  }

  /* ── SELECT id, merchant ── */
  if (s.includes('SELECT id, merchant')) {
    let all = await db.card_transactions.toArray();
    if (s.includes('category IS NULL') || s.includes("category = ''")) {
      all = all.filter((t) => t.category == null || t.category === '');
    }
    return all.map((t) => [t.id, t.merchant]) as unknown as T[];
  }

  /* ── Full 14-column SELECT ── */
  if (s.includes('SELECT id, card_company')) {
    return queryFullSelect<T>(s, params);
  }

  console.warn('[DB] Unhandled queryDB:', s);
  return [];
}

/* ── Query implementation helpers ── */

async function querySubscriptions<T>(): Promise<T[]> {
  const all = await db.card_transactions.toArray();
  const groups = new Map<string, { merchant: string; amount: number; dates: string[] }>();
  for (const t of all) {
    const key = `${(t.merchant ?? '').trim().toLowerCase()}|${t.amount}`;
    const g = groups.get(key);
    if (g) g.dates.push(t.transaction_date);
    else groups.set(key, { merchant: t.merchant, amount: t.amount, dates: [t.transaction_date] });
  }
  const result: unknown[][] = [];
  for (const g of groups.values()) {
    if (g.dates.length >= 2) {
      result.push([g.merchant, g.amount, g.dates.length, g.dates.join(',')]);
    }
  }
  result.sort((a, b) => (b[2] as number) - (a[2] as number));
  return result as unknown as T[];
}

async function queryMonthlyTrend<T>(s: string, params: unknown[]): Promise<T[]> {
  const limitMatch = s.match(/LIMIT\s+(\?|\d+)/i);
  const limit = limitMatch
    ? limitMatch[1] === '?' ? params[params.length - 1] as number : parseInt(limitMatch[1])
    : undefined;
  const all = await db.card_transactions.toArray();
  const map = new Map<string, number>();
  for (const t of all) {
    const mo = ym(t.transaction_date);
    map.set(mo, (map.get(mo) ?? 0) + t.amount);
  }
  const sorted = [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const limited = limit ? sorted.slice(0, limit) : sorted;
  return limited.map(([mo, total]) => [mo, total]) as unknown as T[];
}

async function queryTopMerchants<T>(params: unknown[]): Promise<T[]> {
  const monthParam = params[0] as string;
  const limitParam = params.length > 1 ? params[1] as number : undefined;
  const all = await db.card_transactions.toArray();
  const filtered = all.filter((t) => ym(t.transaction_date) === monthParam);
  const map = new Map<string, { total: number; count: number }>();
  for (const t of filtered) {
    const m = t.merchant || '不明';
    const e = map.get(m);
    if (e) { e.total += t.amount; e.count++; }
    else map.set(m, { total: t.amount, count: 1 });
  }
  const sorted = [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  const limited = limitParam ? sorted.slice(0, limitParam) : sorted;
  return limited.map(([merchant, { total, count }]) => [merchant, total, count]) as unknown as T[];
}

async function queryCategoryTotals<T>(s: string, params: unknown[]): Promise<T[]> {
  let all = await db.card_transactions.toArray();
  all = all.filter((t) => t.category != null && t.category !== '');
  if (s.includes('strftime') && params.length > 0) {
    const mp = params[0] as string;
    all = all.filter((t) => ym(t.transaction_date) === mp);
  }
  const map = new Map<string, { total: number; count: number }>();
  for (const t of all) {
    const c = t.category!;
    const e = map.get(c);
    if (e) { e.total += t.amount; e.count++; }
    else map.set(c, { total: t.amount, count: 1 });
  }
  const sorted = [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  return sorted.map(([cat, { total, count }]) => [cat, total, count]) as unknown as T[];
}

async function queryByCard<T>(s: string, params: unknown[]): Promise<T[]> {
  let all = await db.card_transactions.toArray();
  if (s.includes('strftime') && params.length > 0) {
    const mp = params[0] as string;
    all = all.filter((t) => ym(t.transaction_date) === mp);
  }
  const map = new Map<string, { total: number; count: number }>();
  for (const t of all) {
    const e = map.get(t.card_company);
    if (e) { e.total += t.amount; e.count++; }
    else map.set(t.card_company, { total: t.amount, count: 1 });
  }
  const sorted = [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  return sorted.map(([cc, { total, count }]) => [cc, total, count]) as unknown as T[];
}

async function queryUnclassifiedMerchants<T>(params: unknown[]): Promise<T[]> {
  const limit = params.length > 0 ? params[0] as number : undefined;
  const all = await db.card_transactions.toArray();
  const filtered = all.filter((t) => t.category == null || t.category === '');
  const map = new Map<string, number>();
  for (const t of filtered) {
    map.set(t.merchant, (map.get(t.merchant) ?? 0) + 1);
  }
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const limited = limit ? sorted.slice(0, limit) : sorted;
  return limited.map(([merchant, count]) => [merchant, count]) as unknown as T[];
}

async function queryMonthlySummary<T>(s: string, params: unknown[]): Promise<T[]> {
  let all = await db.card_transactions.toArray();
  if (s.includes('strftime') && params.length > 0) {
    const mp = params[0] as string;
    all = all.filter((t) => ym(t.transaction_date) === mp);
    if (params.length > 1) {
      const cc = params[1] as string;
      all = all.filter((t) => t.card_company === cc);
    }
  }
  const total = all.reduce((sum, t) => sum + t.amount, 0);
  return [[total, all.length]] as unknown as T[];
}

async function queryCount<T>(s: string): Promise<T[]> {
  if (s.includes('category IS NULL') || s.includes("category = ''")) {
    const all = await db.card_transactions.toArray();
    const c = all.filter((t) => t.category == null || t.category === '').length;
    return [[c]] as unknown as T[];
  }
  const c = await db.card_transactions.count();
  return [[c]] as unknown as T[];
}

async function queryFullSelect<T>(s: string, params: unknown[]): Promise<T[]> {
  if (s.includes('WHERE id = ?')) {
    const row = await db.card_transactions.get(params[0] as number);
    return row ? [toTuple(row)] as unknown as T[] : [];
  }

  let all = await db.card_transactions.toArray();
  let pi = 0;

  if (s.includes("strftime('%Y-%m', transaction_date) = ?")) {
    const mp = params[pi++] as string;
    all = all.filter((t) => ym(t.transaction_date) === mp);
  }
  if (s.includes('card_company = ?')) {
    const cc = params[pi++] as string;
    all = all.filter((t) => t.card_company === cc);
  }
  if (/\bcategory = \?/.test(s)) {
    const cat = params[pi++] as string;
    all = all.filter((t) => t.category === cat);
  }

  all.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));

  const limitMatch = s.match(/LIMIT\s+(\d+)/i);
  const offsetMatch = s.match(/OFFSET\s+(\d+)/i);
  if (offsetMatch) all = all.slice(parseInt(offsetMatch[1]));
  if (limitMatch) all = all.slice(0, parseInt(limitMatch[1]));

  return all.map(toTuple) as unknown as T[];
}

/* ═══ executeDB ═══ */

export async function executeDB(
  sql: string,
  params: unknown[] = [],
): Promise<{ changes: number; lastId?: number }> {
  const s = sql.replace(/\s+/g, ' ').trim();

  if (s.includes('CREATE TABLE') || s.includes('CREATE INDEX')) {
    return { changes: 0 };
  }

  // Migration UPDATEs (SET ... WHERE ... IS NULL) — no-op
  if (s.startsWith('UPDATE') && s.includes('IS NULL') && params.length === 0) {
    return { changes: 0 };
  }

  /* ── INSERT card_transactions ── */
  if (s.includes('INSERT') && s.includes('card_transactions')) {
    const colMatch = s.match(/\(([^)]+)\)\s*VALUES/i);
    if (!colMatch) return { changes: 0 };
    const cols = colMatch[1].split(',').map((c) => c.trim());

    const obj: Record<string, unknown> = {
      description: '',
      category: null,
      category_source: null,
      email_subject: null,
      email_from: null,
      gmail_message_id: undefined,
      is_verified: 0,
      created_at: new Date().toISOString(),
      memo: '',
      tags: '[]',
    };
    for (let i = 0; i < cols.length; i++) {
      obj[cols[i]] = params[i];
    }
    delete obj.id;

    const id = await db.card_transactions.add(obj as unknown as CTRow);
    return { changes: 1, lastId: id as number };
  }

  /* ── INSERT OR REPLACE llm_keys ── */
  if (s.includes('INSERT') && s.includes('llm_keys')) {
    const now = new Date().toISOString();
    await db.llm_keys.put({
      provider: params[0] as string,
      encrypted_data: params[1] as string,
      iv: params[2] as string,
      salt: params[3] as string,
      version: params[4] as number,
      created_at: now,
      updated_at: now,
    });
    return { changes: 1 };
  }

  /* ── UPDATE card_transactions SET col(s) = ? WHERE id = ? ── */
  if (s.startsWith('UPDATE') && s.includes('card_transactions') && s.includes('WHERE id')) {
    const setClause = s.match(/SET\s+(.*?)\s+WHERE/i);
    if (setClause) {
      const colRegex = /(\w+)\s*=\s*\?/g;
      const updates: Record<string, unknown> = {};
      let colMatch: RegExpExecArray | null;
      let idx = 0;
      while ((colMatch = colRegex.exec(setClause[1])) !== null) {
        updates[colMatch[1]] = params[idx++];
      }
      const idParam = params[idx] as number;
      if (Object.keys(updates).length > 0) {
        await db.card_transactions.update(idParam, updates);
        return { changes: 1 };
      }
    }
    return { changes: 0 };
  }

  /* ── DELETE card_transactions ── */
  if (s.includes('DELETE') && s.includes('card_transactions')) {
    await db.card_transactions.delete(params[0] as number);
    return { changes: 1 };
  }

  /* ── DELETE llm_keys ── */
  if (s.includes('DELETE') && s.includes('llm_keys')) {
    await db.llm_keys.delete(params[0] as string);
    return { changes: 1 };
  }

  console.warn('[DB] Unhandled executeDB:', sql);
  return { changes: 0 };
}

export async function saveDB(): Promise<void> {
  // Dexie auto-persists to IndexedDB. No-op.
}
