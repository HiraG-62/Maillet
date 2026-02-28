// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { useTransactionStore } from '../transaction-store';
import type { CardTransaction, MonthlyAggregation } from '@/types/transaction';

const mockTx: CardTransaction = {
  id: 1,
  card_company: 'SMBC',
  amount: 1000,
  merchant: 'スタバ',
  transaction_date: '2026-03-01T10:00:00',
  description: '',
  category: null,
  is_verified: true,
  memo: '',
};

const mockAggregation: MonthlyAggregation = {
  month: '2026-03',
  total: 50000,
  count: 10,
  average: 5000,
  by_category: { '食費': 20000, '交通費': 10000 },
  by_card: { 'SMBC': 30000 },
};

describe('useTransactionStore', () => {
  beforeEach(() => {
    useTransactionStore.setState({
      transactions: [],
      currentMonth: '',
      aggregation: null,
      isLoading: false,
      error: null,
    });
  });

  it('初期状態が正しい', () => {
    const state = useTransactionStore.getState();
    expect(state.transactions).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.currentMonth).toBe('');
    expect(state.aggregation).toBeNull();
  });

  it('setTransactions で取引リストを更新できる', () => {
    useTransactionStore.getState().setTransactions([mockTx]);
    expect(useTransactionStore.getState().transactions).toHaveLength(1);
    expect(useTransactionStore.getState().transactions[0].merchant).toBe('スタバ');
  });

  it('setTransactions で空配列をセットできる', () => {
    useTransactionStore.getState().setTransactions([mockTx]);
    useTransactionStore.getState().setTransactions([]);
    expect(useTransactionStore.getState().transactions).toHaveLength(0);
  });

  it('setTransactions で複数件セットできる', () => {
    const txList: CardTransaction[] = [
      mockTx,
      { ...mockTx, id: 2, merchant: 'マクドナルド', amount: 500 },
    ];
    useTransactionStore.getState().setTransactions(txList);
    expect(useTransactionStore.getState().transactions).toHaveLength(2);
  });

  it('setCurrentMonth で月を更新できる', () => {
    useTransactionStore.getState().setCurrentMonth('2026-03');
    expect(useTransactionStore.getState().currentMonth).toBe('2026-03');
  });

  it('setCurrentMonth で上書きできる', () => {
    useTransactionStore.getState().setCurrentMonth('2026-02');
    useTransactionStore.getState().setCurrentMonth('2026-03');
    expect(useTransactionStore.getState().currentMonth).toBe('2026-03');
  });

  it('setLoading で true/false を切り替えられる', () => {
    useTransactionStore.getState().setLoading(true);
    expect(useTransactionStore.getState().isLoading).toBe(true);

    useTransactionStore.getState().setLoading(false);
    expect(useTransactionStore.getState().isLoading).toBe(false);
  });

  it('setError でエラーメッセージをセットできる', () => {
    useTransactionStore.getState().setError('同期に失敗しました');
    expect(useTransactionStore.getState().error).toBe('同期に失敗しました');
  });

  it('setError で null をセットできる（クリア）', () => {
    useTransactionStore.getState().setError('エラー');
    useTransactionStore.getState().setError(null);
    expect(useTransactionStore.getState().error).toBeNull();
  });

  it('setAggregation で集計データをセットできる', () => {
    useTransactionStore.getState().setAggregation(mockAggregation);
    const agg = useTransactionStore.getState().aggregation;
    expect(agg).not.toBeNull();
    expect(agg!.month).toBe('2026-03');
    expect(agg!.total).toBe(50000);
    expect(agg!.count).toBe(10);
  });

  it('setAggregation で null をセットできる（クリア）', () => {
    useTransactionStore.getState().setAggregation(mockAggregation);
    useTransactionStore.getState().setAggregation(null);
    expect(useTransactionStore.getState().aggregation).toBeNull();
  });

  it('複数の状態を独立して更新できる', () => {
    useTransactionStore.getState().setTransactions([mockTx]);
    useTransactionStore.getState().setLoading(true);
    useTransactionStore.getState().setCurrentMonth('2026-03');

    const state = useTransactionStore.getState();
    expect(state.transactions).toHaveLength(1);
    expect(state.isLoading).toBe(true);
    expect(state.currentMonth).toBe('2026-03');
    expect(state.error).toBeNull();
  });
});
