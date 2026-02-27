import type { CardTransaction } from '@/types/transaction';
import { formatDateForExport } from '@/lib/utils';

export interface CsvExportOptions {
  filename?: string;
  encoding?: 'utf-8' | 'shift-jis';
  includeHeader?: boolean;
}

const CSV_HEADERS = [
  '日付', 'カード会社', '金額', '加盟店', 'カテゴリ',
  'メールID', '作成日時'
];

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function transactionToCsvRow(tx: CardTransaction): string[] {
  return [
    formatDateForExport(tx.transaction_date),
    tx.card_company,
    String(tx.amount),
    tx.merchant,
    tx.category ?? '',
    tx.gmail_message_id ?? '',
    formatDateForExport(tx.created_at),
  ];
}

export function transactionsToCsv(
  transactions: CardTransaction[],
  options?: CsvExportOptions
): string {
  const includeHeader = options?.includeHeader !== false;
  const lines: string[] = [];

  if (includeHeader) {
    lines.push(CSV_HEADERS.map(escapeCsvField).join(','));
  }

  for (const tx of transactions) {
    const row = transactionToCsvRow(tx);
    lines.push(row.map(escapeCsvField).join(','));
  }

  return lines.join('\n');
}

export function downloadCsv(
  transactions: CardTransaction[],
  options?: CsvExportOptions
): void {
  const csvString = transactionsToCsv(transactions, options);
  const filename = options?.filename ?? `transactions_${new Date().toISOString().slice(0, 7)}.csv`;

  const blob = new Blob(['\uFEFF' + csvString], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
