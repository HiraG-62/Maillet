import { queryDB, executeDB } from './database';
import type { CardTransaction } from '@/types/transaction';
import type { ParsedTransaction } from '@/services/parsers/base';

// ────────────────────────────────────────────────
// スキーマ確認: card_transactions テーブル
// id, card_company, amount, merchant, transaction_date,
// description, category, email_subject, email_from,
// gmail_message_id, is_verified, created_at
// ────────────────────────────────────────────────

export interface SaveTransactionInput {
  card_company: string;
  amount: number;
  merchant: string;
  transaction_date: string;   // ISO 8601
  description?: string;
  category?: string;
  email_subject?: string;
  email_from?: string;
  gmail_message_id?: string;  // 重複検出用 UNIQUE
}

export interface SaveResult {
  saved: boolean;
  id?: number;
  duplicate?: boolean;
}

/**
 * トランザクションを保存（gmail_message_id による重複検出付き）
 * Python 版: transaction_service.save_transaction() の移植
 */
export async function saveTransaction(
  input: SaveTransactionInput
): Promise<SaveResult> {
  // 重複チェック（gmail_message_id が存在する場合）
  if (input.gmail_message_id) {
    const existing = await queryDB<[number]>(
      'SELECT id FROM card_transactions WHERE gmail_message_id = ?',
      [input.gmail_message_id]
    );
    if (existing.length > 0) {
      return { saved: false, duplicate: true };
    }
  }

  const result = await executeDB(
    `INSERT INTO card_transactions
       (card_company, amount, merchant, transaction_date,
        description, category, email_subject, email_from, gmail_message_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.card_company,
      input.amount,
      input.merchant,
      input.transaction_date,
      input.description ?? '',
      input.category ?? null,
      input.email_subject ?? null,
      input.email_from ?? null,
      input.gmail_message_id ?? null,
    ]
  );

  return { saved: true, id: result.lastId };
}

/**
 * ParsedTransaction から saveTransaction を呼ぶヘルパー
 */
export async function saveParsedTransaction(
  parsed: ParsedTransaction,
  extra?: { email_subject?: string; email_from?: string; gmail_message_id?: string }
): Promise<SaveResult> {
  return saveTransaction({
    card_company: parsed.card_company,
    amount: parsed.amount,
    merchant: parsed.merchant,
    transaction_date: parsed.transaction_date,
    ...extra,
  });
}

export interface TransactionFilter {
  year?: number;
  month?: number;
  card_company?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

/**
 * トランザクション一覧取得
 */
export async function getTransactions(
  filter: TransactionFilter = {}
): Promise<CardTransaction[]> {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (filter.year !== undefined && filter.month !== undefined) {
    const m = `${filter.year}-${String(filter.month).padStart(2, '0')}`;
    conditions.push("strftime('%Y-%m', transaction_date) = ?");
    params.push(m);
  }
  if (filter.card_company) {
    conditions.push('card_company = ?');
    params.push(filter.card_company);
  }
  if (filter.category) {
    conditions.push('category = ?');
    params.push(filter.category);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const limit = filter.limit ? `LIMIT ${filter.limit}` : '';
  const offset = filter.offset ? `OFFSET ${filter.offset}` : '';

  const rows = await queryDB<
    [number, string, number, string, string, string, string | null, string | null, string | null, string | null, number, string]
  >(
    `SELECT id, card_company, amount, merchant, transaction_date,
            description, category, email_subject, email_from,
            gmail_message_id, is_verified, created_at
     FROM card_transactions
     ${where}
     ORDER BY transaction_date DESC
     ${limit} ${offset}`,
    params
  );

  return rows.map(
    ([id, card_company, amount, merchant, transaction_date,
      description, category, email_subject, email_from,
      gmail_message_id, is_verified, created_at]) => ({
      id,
      card_company,
      amount,
      merchant,
      transaction_date,
      description: description ?? '',
      category: category ?? null,
      email_subject: email_subject ?? undefined,
      email_from: email_from ?? undefined,
      gmail_message_id: gmail_message_id ?? undefined,
      is_verified: Boolean(is_verified),
      created_at: created_at ?? undefined,
    })
  );
}

export async function getTransactionById(
  id: number
): Promise<CardTransaction | null> {
  const row = await queryDB<[number, string, number, string, string, string, string | null, string | null, string | null, string | null, number, string]>(
    `SELECT id, card_company, amount, merchant, transaction_date,
            description, category, email_subject, email_from,
            gmail_message_id, is_verified, created_at
     FROM card_transactions WHERE id = ?`,
    [id]
  );
  if (row.length === 0) return null;
  const [rid, card_company, amount, merchant, transaction_date,
         description, category, email_subject, email_from,
         gmail_message_id, is_verified, created_at] = row[0];
  return {
    id: rid,
    card_company,
    amount,
    merchant,
    transaction_date,
    description: description ?? '',
    category: category ?? null,
    email_subject: email_subject ?? undefined,
    email_from: email_from ?? undefined,
    gmail_message_id: gmail_message_id ?? undefined,
    is_verified: Boolean(is_verified),
    created_at: created_at ?? undefined,
  };
}

export async function updateTransactionCategory(
  id: number,
  category: string
): Promise<void> {
  await executeDB(
    'UPDATE card_transactions SET category = ? WHERE id = ?',
    [category, id]
  );
}

export async function updateTransactionMerchant(
  id: number,
  merchant: string
): Promise<void> {
  await executeDB(
    'UPDATE card_transactions SET merchant = ? WHERE id = ?',
    [merchant, id]
  );
}

export async function deleteTransaction(id: number): Promise<void> {
  await executeDB('DELETE FROM card_transactions WHERE id = ?', [id]);
}

export async function getTransactionCount(): Promise<number> {
  const rows = await queryDB<[number]>(
    'SELECT COUNT(*) FROM card_transactions',
    []
  );
  return (rows[0] as [number])?.[0] ?? 0;
}

/**
 * 既存の gmail_message_id 一覧を取得（差分同期用）
 */
export async function getSyncedMessageIds(): Promise<string[]> {
  const result = await queryDB<[string]>(
    'SELECT gmail_message_id FROM card_transactions WHERE gmail_message_id IS NOT NULL',
    []
  );
  return result.map(r => r[0]);
}
