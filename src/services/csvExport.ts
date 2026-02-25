import type { CardTransaction } from '@/types/transaction';

export interface CsvExportOptions {
  filename?: string;
  encoding?: 'utf-8' | 'shift-jis';
  includeHeader?: boolean;
}

const CSV_HEADERS = [
  '日付', 'カード会社', '金額', '加盟店', 'カテゴリ',
  'メールID', '作成日時'
];

function formatDate(isoString: string | undefined): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function transactionToCsvRow(tx: CardTransaction): string[] {
  return [
    formatDate(tx.transaction_date),
    tx.card_company,
    String(tx.amount),
    tx.merchant,
    tx.category ?? '',
    tx.gmail_message_id ?? '',
    formatDate(tx.created_at),
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
