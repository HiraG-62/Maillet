// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TransactionTable } from '../TransactionTable';
import type { CardTransaction } from '@/types/transaction';

function makeTx(overrides: Partial<CardTransaction> = {}): CardTransaction {
  return {
    amount: 1000,
    transaction_date: '2026-02-18T12:30:00.000Z',
    merchant: 'テスト店舗',
    card_company: '三井住友',
    description: '',
    category: null,
    ...overrides,
  };
}

describe('TransactionTable', () => {
  it('transaction_date が null でもソートがクラッシュしない', () => {
    const txs = [
      makeTx({ id: 1, transaction_date: null as unknown as string }),
      makeTx({ id: 2, transaction_date: '2026-02-18T12:30:00.000Z' }),
    ];
    expect(() => render(<TransactionTable transactions={txs} />)).not.toThrow();
  });

  it('空配列でもクラッシュしない', () => {
    expect(() => render(<TransactionTable transactions={[]} />)).not.toThrow();
  });

  it('時刻あり（HH:mm != 00:00）の場合、日付と時刻を表示する', () => {
    const txs = [makeTx({ id: 1, transaction_date: '2026-02-18T12:30:00' })];
    render(<TransactionTable transactions={txs} />);
    expect(screen.getByText('2026/02/18 12:30')).toBeInTheDocument();
  });

  it('時刻なし（00:00）の場合、日付のみ表示する', () => {
    const txs = [makeTx({ id: 1, transaction_date: '2026-02-18T00:00:00' })];
    render(<TransactionTable transactions={txs} />);
    expect(screen.getByText('2026/02/18')).toBeInTheDocument();
  });
});
