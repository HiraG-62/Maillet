// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RecentTransactions } from '../RecentTransactions';
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

describe('RecentTransactions', () => {
  it('transaction_date が null でもクラッシュしない', () => {
    const txs = [makeTx({ transaction_date: null as unknown as string })];
    expect(() => render(<RecentTransactions transactions={txs} />)).not.toThrow();
  });

  it('transaction_date が undefined でもクラッシュしない', () => {
    const txs = [makeTx({ transaction_date: undefined as unknown as string })];
    expect(() => render(<RecentTransactions transactions={txs} />)).not.toThrow();
  });

  it('空の配列でも「取引データなし」を表示する', () => {
    render(<RecentTransactions transactions={[]} />);
    expect(screen.getByText('取引データなし')).toBeInTheDocument();
  });

  it('limit で表示件数を制限できる', () => {
    const txs = Array.from({ length: 15 }, (_, i) =>
      makeTx({ id: i, merchant: `店舗${i}`, transaction_date: `2026-02-${String(i + 1).padStart(2, '0')}T00:00:00.000Z` })
    );
    render(<RecentTransactions transactions={txs} limit={5} />);
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBe(5);
  });
});
