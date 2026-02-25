// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/database', () => ({
  queryDB: vi.fn(),
  executeDB: vi.fn(),
}));

import { queryDB, executeDB } from '@/lib/database';
import {
  CATEGORIES,
  classify_transaction,
  applyCategoriesToDB,
  getCategoryTotals,
} from './category';

const mockQueryDB = vi.mocked(queryDB);
const mockExecuteDB = vi.mocked(executeDB);

describe('classify_transaction', () => {
  it('食費に分類される', () => {
    expect(classify_transaction('マクドナルド')).toBe('食費');
    expect(classify_transaction('セブンイレブン')).toBe('食費');
    expect(classify_transaction('ローソン')).toBe('食費');
    expect(classify_transaction('イオン')).toBe('食費');
  });

  it('交通費に分類される', () => {
    expect(classify_transaction('JR東日本')).toBe('交通費');
    expect(classify_transaction('東京メトロ')).toBe('交通費');
    expect(classify_transaction('タクシー')).toBe('交通費');
    expect(classify_transaction('Suicaチャージ')).toBe('交通費');
  });

  it('娯楽に分類される', () => {
    expect(classify_transaction('Netflix')).toBe('娯楽');
    expect(classify_transaction('Steam購入')).toBe('娯楽');
    expect(classify_transaction('映画館')).toBe('娯楽');
  });

  it('通信費に分類される', () => {
    expect(classify_transaction('ドコモ月額')).toBe('通信費');
    expect(classify_transaction('NTT東日本')).toBe('通信費');
    expect(classify_transaction('Adobe Creative')).toBe('通信費');
  });

  it('医療に分類される', () => {
    expect(classify_transaction('マツキヨ薬局')).toBe('医療');
    expect(classify_transaction('内科クリニック')).toBe('医療');
    expect(classify_transaction('歯科医院')).toBe('医療');
  });

  it('ショッピングに分類される', () => {
    expect(classify_transaction('Amazon.co.jp')).toBe('ショッピング');
    expect(classify_transaction('ZOZOTOWN')).toBe('ショッピング');
  });

  it('光熱費に分類される', () => {
    expect(classify_transaction('東京電力')).toBe('光熱費');
    expect(classify_transaction('東京ガス')).toBe('光熱費');
  });

  it('不明はnullを返す', () => {
    expect(classify_transaction('不明な加盟店XYZ')).toBeNull();
    expect(classify_transaction('')).toBeNull();
  });

  it('大文字小文字を区別しない', () => {
    expect(classify_transaction('netflix')).toBe('娯楽');
    expect(classify_transaction('NETFLIX')).toBe('娯楽');
  });
});

describe('CATEGORIES', () => {
  it('全カテゴリが定義されている', () => {
    const expected = ['食費', '交通費', '娯楽', '通信費', '医療', 'ショッピング', '光熱費'];
    for (const cat of expected) {
      expect(CATEGORIES).toHaveProperty(cat);
      expect((CATEGORIES[cat] as string[]).length).toBeGreaterThan(0);
    }
  });
});

describe('applyCategoriesToDB', () => {
  beforeEach(() => vi.clearAllMocks());

  it('カテゴリを更新して件数を返す', async () => {
    mockQueryDB.mockResolvedValueOnce([
      [1, 'マクドナルド'],
      [2, '不明な店'],
    ] as never);
    mockExecuteDB.mockResolvedValue({ lastId: 0, changes: 1 } as never);
    const result = await applyCategoriesToDB(false);
    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('overwrite=true で全件対象', async () => {
    mockQueryDB.mockResolvedValueOnce([[1, 'Netflix']] as never);
    mockExecuteDB.mockResolvedValue({ lastId: 0, changes: 1 } as never);
    await applyCategoriesToDB(true);
    expect(mockQueryDB).toHaveBeenCalledWith(
      'SELECT id, merchant FROM card_transactions',
      []
    );
  });

  it('overwrite=false でカテゴリ未設定のみ対象', async () => {
    mockQueryDB.mockResolvedValueOnce([] as never);
    await applyCategoriesToDB(false);
    expect(mockQueryDB).toHaveBeenCalledWith(
      "SELECT id, merchant FROM card_transactions WHERE category IS NULL OR category = ''",
      []
    );
  });
});

describe('getCategoryTotals', () => {
  beforeEach(() => vi.clearAllMocks());

  it('カテゴリ別集計を返す（年月指定）', async () => {
    mockQueryDB.mockResolvedValueOnce([
      ['食費', 30000, 10],
      ['交通費', 15000, 5],
    ] as never);
    const result = await getCategoryTotals(2024, 3);
    expect(result).toHaveLength(2);
    expect(result[0].category).toBe('食費');
    expect(result[0].total).toBe(30000);
    expect(result[0].count).toBe(10);
    expect(mockQueryDB).toHaveBeenCalledWith(
      expect.stringContaining("strftime"),
      expect.arrayContaining(['2024-03'])
    );
  });

  it('引数なし（全期間）はstrftimeフィルタなし', async () => {
    mockQueryDB.mockResolvedValueOnce([['食費', 100000, 50]] as never);
    const result = await getCategoryTotals();
    expect(result[0].total).toBe(100000);
    // params が空配列のはず
    const callParams = mockQueryDB.mock.calls[0] as [string, unknown[]];
    expect(callParams[1]).toHaveLength(0);
  });
});
