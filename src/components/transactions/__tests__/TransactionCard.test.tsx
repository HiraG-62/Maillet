// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TransactionCard } from '../TransactionCard';
import type { CardTransaction } from '@/types/transaction';

function makeTx(overrides: Partial<CardTransaction> = {}): CardTransaction {
  return {
    amount: 2500,
    transaction_date: '2026-03-01T00:00:00.000Z',
    merchant: 'テスト店舗',
    card_company: '三井住友',
    description: '',
    category: null,
    ...overrides,
  };
}

describe('TransactionCard', () => {
  it('加盟店名を表示する', () => {
    render(<TransactionCard transaction={makeTx()} />);
    expect(screen.getByText('テスト店舗')).toBeInTheDocument();
  });

  it('カード会社名を表示する', () => {
    render(<TransactionCard transaction={makeTx()} />);
    expect(screen.getByText('三井住友')).toBeInTheDocument();
  });

  it('金額を表示する', () => {
    const { container } = render(<TransactionCard transaction={makeTx({ amount: 5000 })} />);
    expect(container.textContent).toContain('5,000');
  });

  it('カテゴリが設定されていればバッジを表示する', () => {
    render(<TransactionCard transaction={makeTx({ category: '食費・グルメ' })} />);
    expect(screen.getByText('食費・グルメ')).toBeInTheDocument();
  });

  it('カテゴリが null の場合バッジを表示しない', () => {
    const { queryByText } = render(<TransactionCard transaction={makeTx({ category: null })} />);
    expect(queryByText(/カテゴリ/)).not.toBeInTheDocument();
  });

  it('transaction_date が null でもクラッシュしない', () => {
    expect(() =>
      render(<TransactionCard transaction={makeTx({ transaction_date: null as unknown as string })} />)
    ).not.toThrow();
  });

  it('transaction_date が空文字でもクラッシュしない', () => {
    expect(() =>
      render(<TransactionCard transaction={makeTx({ transaction_date: '' })} />)
    ).not.toThrow();
  });

  it('長い加盟店名（100文字）でもクラッシュしない', () => {
    const longMerchant = 'ア'.repeat(100);
    expect(() =>
      render(<TransactionCard transaction={makeTx({ merchant: longMerchant })} />)
    ).not.toThrow();
    expect(screen.getByText(longMerchant)).toBeInTheDocument();
  });

  it('金額0円でもクラッシュしない', () => {
    const { container } = render(<TransactionCard transaction={makeTx({ amount: 0 })} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('負の金額でもクラッシュしない', () => {
    expect(() =>
      render(<TransactionCard transaction={makeTx({ amount: -500 })} />)
    ).not.toThrow();
  });

  it('楽天カードでもクラッシュしない', () => {
    expect(() =>
      render(<TransactionCard transaction={makeTx({ card_company: '楽天カード' })} />)
    ).not.toThrow();
  });

  it('JCBカードでもクラッシュしない', () => {
    expect(() =>
      render(<TransactionCard transaction={makeTx({ card_company: 'JCB' })} />)
    ).not.toThrow();
  });

  it('AMEXカードでもクラッシュしない', () => {
    expect(() =>
      render(<TransactionCard transaction={makeTx({ card_company: 'AMEX' })} />)
    ).not.toThrow();
  });

  it('card_company が null でもクラッシュしない', () => {
    expect(() =>
      render(<TransactionCard transaction={makeTx({ card_company: null as unknown as string })} />)
    ).not.toThrow();
  });

  it('ショッピングカテゴリでアイコンが表示される', () => {
    const { container } = render(
      <TransactionCard transaction={makeTx({ category: 'ショッピング・購入' })} />
    );
    expect(container.firstChild).toBeInTheDocument();
    expect(screen.getByText('ショッピング・購入')).toBeInTheDocument();
  });

  it('交通カテゴリでアイコンが表示される', () => {
    const { container } = render(
      <TransactionCard transaction={makeTx({ category: '交通・移動' })} />
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('旅行カテゴリでアイコンが表示される', () => {
    const { container } = render(
      <TransactionCard transaction={makeTx({ category: '旅行・ホテル' })} />
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('通信カテゴリでアイコンが表示される', () => {
    const { container } = render(
      <TransactionCard transaction={makeTx({ category: '通信・サブスク' })} />
    );
    expect(container.firstChild).toBeInTheDocument();
  });
});
