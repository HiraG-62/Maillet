// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { transactionToCsvRow, transactionsToCsv } from '../csvExport';
import type { CardTransaction } from '@/types/transaction';

const baseTx: CardTransaction = {
  card_company: 'VISA',
  amount: 1500,
  merchant: 'Amazon',
  transaction_date: '2026-01-15T10:30:00',
  description: 'テスト購入',
  category: '買い物',
  gmail_message_id: 'msg_abc123',
  created_at: '2026-01-15T11:00:00',
};

describe('transactionToCsvRow', () => {
  it('通常データを正しく変換する', () => {
    const row = transactionToCsvRow(baseTx);
    expect(row).toEqual([
      '2026/01/15 10:30',
      'VISA',
      '1500',
      'Amazon',
      '買い物',
      'msg_abc123',
      '2026/01/15 11:00',
    ]);
  });

  it('カンマを含む加盟店名をそのまま返す（エスケープはtransactionsToCsvで行う）', () => {
    const tx: CardTransaction = {
      ...baseTx,
      merchant: 'Shop A, Inc.',
    };
    const row = transactionToCsvRow(tx);
    expect(row[3]).toBe('Shop A, Inc.');
  });

  it('nullのcategoryを空文字に変換する', () => {
    const tx: CardTransaction = {
      ...baseTx,
      category: null,
    };
    const row = transactionToCsvRow(tx);
    expect(row[4]).toBe('');
  });

  it('undefinedのgmail_message_idを空文字に変換する', () => {
    const tx: CardTransaction = {
      ...baseTx,
      gmail_message_id: undefined,
    };
    const row = transactionToCsvRow(tx);
    expect(row[5]).toBe('');
  });

  it('undefinedのcreated_atを空文字に変換する', () => {
    const tx: CardTransaction = {
      ...baseTx,
      created_at: undefined,
    };
    const row = transactionToCsvRow(tx);
    expect(row[6]).toBe('');
  });
});

describe('transactionsToCsv', () => {
  it('ヘッダー行を含む', () => {
    const csv = transactionsToCsv([]);
    expect(csv).toBe('日付,カード会社,金額,加盟店,カテゴリ,メールID,作成日時');
  });

  it('空配列でもヘッダーのみ出力する', () => {
    const csv = transactionsToCsv([]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('日付');
  });

  it('includeHeader=falseでヘッダーを省略する', () => {
    const csv = transactionsToCsv([], { includeHeader: false });
    expect(csv).toBe('');
  });

  it('複数行を正しく変換する', () => {
    const tx2: CardTransaction = {
      ...baseTx,
      card_company: 'Mastercard',
      amount: 3000,
      merchant: 'コンビニ',
    };
    const csv = transactionsToCsv([baseTx, tx2]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[0]).toContain('日付');
    expect(lines[1]).toContain('VISA');
    expect(lines[2]).toContain('Mastercard');
  });

  it('カンマを含むフィールドをダブルクォートで囲む', () => {
    const tx: CardTransaction = {
      ...baseTx,
      merchant: 'Shop A, Inc.',
    };
    const csv = transactionsToCsv([tx]);
    const dataLine = csv.split('\n')[1];
    expect(dataLine).toContain('"Shop A, Inc."');
  });

  it('ダブルクォートを含むフィールドをエスケープする', () => {
    const tx: CardTransaction = {
      ...baseTx,
      merchant: 'Shop "Best" Deal',
    };
    const csv = transactionsToCsv([tx]);
    const dataLine = csv.split('\n')[1];
    expect(dataLine).toContain('"Shop ""Best"" Deal"');
  });

  it('改行を含むフィールドをダブルクォートで囲む', () => {
    const tx: CardTransaction = {
      ...baseTx,
      merchant: 'Line1\nLine2',
    };
    const csv = transactionsToCsv([tx]);
    const dataLine = csv.split('\n').slice(1).join('\n');
    expect(dataLine).toContain('"Line1\nLine2"');
  });
});
