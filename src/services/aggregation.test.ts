// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/database', () => ({
  queryDB: vi.fn(),
  executeDB: vi.fn(),
}));

import { queryDB } from '@/lib/database';
import {
  getMonthlySummary,
  getMonthlyByCard,
  getTopMerchants,
  getAllTimeSummaryByCard,
  getMonthlyTrend,
} from './aggregation';

const mockQueryDB = vi.mocked(queryDB);

describe('getMonthlySummary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('正しい合計・件数・平均を返す', async () => {
    mockQueryDB.mockResolvedValueOnce([[50000, 5]] as never);
    const result = await getMonthlySummary(2024, 3);
    expect(result.total).toBe(50000);
    expect(result.count).toBe(5);
    expect(result.average).toBe(10000);
  });

  it('データなし時は 0 を返す', async () => {
    mockQueryDB.mockResolvedValueOnce([[0, 0]] as never);
    const result = await getMonthlySummary(2024, 1);
    expect(result.total).toBe(0);
    expect(result.count).toBe(0);
    expect(result.average).toBe(0);
  });

  it('card_company フィルタ付きクエリ', async () => {
    mockQueryDB.mockResolvedValueOnce([[30000, 3]] as never);
    const result = await getMonthlySummary(2024, 3, '三井住友');
    expect(result.total).toBe(30000);
    expect(result.count).toBe(3);
    expect(mockQueryDB).toHaveBeenCalledWith(
      expect.stringContaining('card_company'),
      expect.arrayContaining(['2024-03', '三井住友'])
    );
  });

  // Python版 T-DATA-042: 月次集計（基本）移植
  it('三井住友カード月次集計', async () => {
    mockQueryDB.mockResolvedValueOnce([[6000, 3]] as never);
    const result = await getMonthlySummary(2026, 2, '三井住友');
    expect(result.total).toBe(6000);
    expect(result.count).toBe(3);
    expect(result.average).toBe(2000);
  });
});

describe('getMonthlyByCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('カード別集計を返す', async () => {
    mockQueryDB.mockResolvedValueOnce([
      ['三井住友', 30000, 3],
      ['JCB', 20000, 2],
    ] as never);
    const result = await getMonthlyByCard(2024, 3);
    expect(result).toHaveLength(2);
    expect(result[0].card_company).toBe('三井住友');
    expect(result[0].total).toBe(30000);
    expect(result[0].average).toBe(10000);
  });

  it('データなし時は空配列', async () => {
    mockQueryDB.mockResolvedValueOnce([] as never);
    const result = await getMonthlyByCard(2024, 1);
    expect(result).toHaveLength(0);
  });

  // Python版 T-DATA-043: 複数カード会社グルーピング移植
  it('複数カード会社が正しくグルーピングされる', async () => {
    mockQueryDB.mockResolvedValueOnce([
      ['JCB', 12000, 2],
      ['三井住友', 6000, 3],
    ] as never);
    const result = await getMonthlyByCard(2026, 2);
    expect(result).toHaveLength(2);
    const cardTotals: Record<string, number> = {};
    for (const r of result) {
      cardTotals[r.card_company] = r.total;
    }
    expect(cardTotals['三井住友']).toBe(6000);
    expect(cardTotals['JCB']).toBe(12000);
  });
});

describe('getTopMerchants', () => {
  beforeEach(() => vi.clearAllMocks());

  it('上位加盟店を返す', async () => {
    mockQueryDB.mockResolvedValueOnce([
      ['スタバ', 15000, 5],
      ['セブン', 8000, 8],
    ] as never);
    const result = await getTopMerchants(2024, 3, 2);
    expect(result).toHaveLength(2);
    expect(result[0].merchant).toBe('スタバ');
    expect(result[0].total).toBe(15000);
    expect(result[0].count).toBe(5);
  });
});

describe('getAllTimeSummaryByCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('全期間カード別サマリーを返す', async () => {
    mockQueryDB.mockResolvedValueOnce([
      ['楽天', 100000, 10],
      ['AMEX', 200000, 5],
    ] as never);
    const result = await getAllTimeSummaryByCard();
    expect(result['楽天'].total).toBe(100000);
    expect(result['楽天'].count).toBe(10);
    expect(result['AMEX'].average).toBe(40000);
  });
});

describe('getMonthlyTrend', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ラベルと値を正しい順序で返す（古い月が先）', async () => {
    mockQueryDB.mockResolvedValueOnce([
      ['2026-02', 80000],
      ['2026-01', 60000],
    ] as never);
    const result = await getMonthlyTrend(2);
    // DESC で取得 → reverse → 古い月が先
    expect(result.labels[0]).toBe('2026年1月');
    expect(result.values[0]).toBe(60000);
    expect(result.labels[1]).toBe('2026年2月');
    expect(result.values[1]).toBe(80000);
  });

  it('デフォルト12ヶ月で呼ばれる', async () => {
    mockQueryDB.mockResolvedValueOnce([] as never);
    await getMonthlyTrend();
    expect(mockQueryDB).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT ?'),
      [12]
    );
  });
});
