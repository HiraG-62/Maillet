// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/database', () => ({
  queryDB: vi.fn(),
  executeDB: vi.fn(),
}));

import { queryDB, executeDB } from '@/lib/database';
import {
  saveTransaction,
  saveParsedTransaction,
  getTransactions,
  getTransactionById,
  updateTransactionCategory,
  deleteTransaction,
  getTransactionCount,
  getSyncedMessageIds,
} from './transactions';

const mockQueryDB = vi.mocked(queryDB);
const mockExecuteDB = vi.mocked(executeDB);

describe('saveTransaction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('新規トランザクションを保存する', async () => {
    mockQueryDB.mockResolvedValueOnce([] as never);
    mockExecuteDB.mockResolvedValueOnce({ lastId: 42, changes: 1 } as never);
    const result = await saveTransaction({
      card_company: '三井住友',
      amount: 1500,
      merchant: 'スタバ',
      transaction_date: '2024-03-15T10:30:00',
      gmail_message_id: 'msg_001',
    });
    expect(result.saved).toBe(true);
    expect(result.id).toBe(42);
    expect(result.duplicate).toBeUndefined();
  });

  it('重複を検出してスキップする', async () => {
    mockQueryDB.mockResolvedValueOnce([[1]] as never);
    const result = await saveTransaction({
      card_company: '三井住友',
      amount: 1500,
      merchant: 'スタバ',
      transaction_date: '2024-03-15T10:30:00',
      gmail_message_id: 'msg_001',
    });
    expect(result.saved).toBe(false);
    expect(result.duplicate).toBe(true);
    expect(mockExecuteDB).not.toHaveBeenCalled();
  });

  it('gmail_message_id なしは重複チェックしない', async () => {
    mockExecuteDB.mockResolvedValueOnce({ lastId: 10, changes: 1 } as never);
    const result = await saveTransaction({
      card_company: 'JCB',
      amount: 3000,
      merchant: 'イオン',
      transaction_date: '2024-03-20T14:00:00',
    });
    expect(result.saved).toBe(true);
    expect(mockQueryDB).not.toHaveBeenCalled();
  });
});

describe('saveParsedTransaction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ParsedTransaction から保存できる', async () => {
    mockQueryDB.mockResolvedValueOnce([] as never);
    mockExecuteDB.mockResolvedValueOnce({ lastId: 5, changes: 1 } as never);
    const result = await saveParsedTransaction(
      {
        card_company: '楽天',
        amount: 2500,
        merchant: 'Amazon',
        transaction_date: '2024-03-10T09:00:00',
        raw_text: 'テストメール本文',
      },
      { gmail_message_id: 'msg_002', email_from: 'info@mail.rakuten-card.co.jp' }
    );
    expect(result.saved).toBe(true);
    expect(result.id).toBe(5);
  });
});

describe('getTransactions', () => {
  // id, card_company, amount, merchant, transaction_date,
  // description, category, email_subject, email_from,
  // gmail_message_id, is_verified, created_at
  const mockRow = [1, '三井住友', 1500, 'スタバ', '2024-03-15T10:30:00',
                   '', null, null, null, null, 1, '2024-03-15T10:30:00'];

  beforeEach(() => vi.clearAllMocks());

  it('全件取得（フィルタなし）', async () => {
    mockQueryDB.mockResolvedValueOnce([mockRow] as never);
    const result = await getTransactions();
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(1500);
    expect(result[0].card_company).toBe('三井住友');
    expect(result[0].is_verified).toBe(true);  // Boolean(1)
  });

  it('年月フィルタ', async () => {
    mockQueryDB.mockResolvedValueOnce([] as never);
    await getTransactions({ year: 2024, month: 3 });
    expect(mockQueryDB).toHaveBeenCalledWith(
      expect.stringContaining("strftime('%Y-%m'"),
      expect.arrayContaining(['2024-03'])
    );
  });

  it('card_company フィルタ', async () => {
    mockQueryDB.mockResolvedValueOnce([] as never);
    await getTransactions({ card_company: 'JCB' });
    expect(mockQueryDB).toHaveBeenCalledWith(
      expect.stringContaining('card_company = ?'),
      expect.arrayContaining(['JCB'])
    );
  });

  it('is_verified=false (0)', async () => {
    const unverifiedRow = [...mockRow];
    unverifiedRow[10] = 0;
    mockQueryDB.mockResolvedValueOnce([unverifiedRow] as never);
    const result = await getTransactions();
    expect(result[0].is_verified).toBe(false);
  });

  // Python版 test_query_all_transactions 移植
  it('複数件取得', async () => {
    const rows = [
      [1, 'カード1', 1000, '店舗A', '2026-02-15T10:00:00', '', null, null, null, null, 1, '2026-02-15T10:00:00'],
      [2, 'カード2', 2000, '店舗B', '2026-02-16T11:00:00', '', null, null, null, null, 1, '2026-02-16T11:00:00'],
    ];
    mockQueryDB.mockResolvedValueOnce(rows as never);
    const result = await getTransactions();
    expect(result).toHaveLength(2);
  });
});

describe('getTransactionById', () => {
  beforeEach(() => vi.clearAllMocks());

  it('IDで取得できる', async () => {
    mockQueryDB.mockResolvedValueOnce([
      [3, 'AMEX', 15000, '東急ハンズ', '2024-03-20T14:00:00',
       '', '交通費', null, null, null, 0, '2024-03-20T14:00:00'],
    ] as never);
    const result = await getTransactionById(3);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(3);
    expect(result!.card_company).toBe('AMEX');
    expect(result!.amount).toBe(15000);
  });

  it('存在しない場合はnull', async () => {
    mockQueryDB.mockResolvedValueOnce([] as never);
    const result = await getTransactionById(999);
    expect(result).toBeNull();
  });
});

describe('updateTransactionCategory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('カテゴリを更新する', async () => {
    mockExecuteDB.mockResolvedValueOnce({ lastId: 0, changes: 1 } as never);
    await updateTransactionCategory(1, '食費');
    expect(mockExecuteDB).toHaveBeenCalledWith(
      'UPDATE card_transactions SET category = ? WHERE id = ?',
      ['食費', 1]
    );
  });
});

describe('deleteTransaction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('トランザクションを削除する', async () => {
    mockExecuteDB.mockResolvedValueOnce({ lastId: 0, changes: 1 } as never);
    await deleteTransaction(5);
    expect(mockExecuteDB).toHaveBeenCalledWith(
      'DELETE FROM card_transactions WHERE id = ?',
      [5]
    );
  });
});

describe('getTransactionCount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('件数を返す', async () => {
    mockQueryDB.mockResolvedValueOnce([[42]] as never);
    const count = await getTransactionCount();
    expect(count).toBe(42);
  });

  it('データなし時は 0 を返す', async () => {
    mockQueryDB.mockResolvedValueOnce([[0]] as never);
    const count = await getTransactionCount();
    expect(count).toBe(0);
  });
});

describe('getSyncedMessageIds', () => {
  beforeEach(() => vi.clearAllMocks());

  it('既存の gmail_message_id リストを返す', async () => {
    mockQueryDB.mockResolvedValueOnce([['msg_001'], ['msg_002']] as never);
    const ids = await getSyncedMessageIds();
    expect(ids).toEqual(['msg_001', 'msg_002']);
    expect(mockQueryDB).toHaveBeenCalledWith(
      'SELECT gmail_message_id FROM card_transactions WHERE gmail_message_id IS NOT NULL',
      []
    );
  });

  it('データなし時は空配列を返す', async () => {
    mockQueryDB.mockResolvedValueOnce([] as never);
    const ids = await getSyncedMessageIds();
    expect(ids).toEqual([]);
  });
});
