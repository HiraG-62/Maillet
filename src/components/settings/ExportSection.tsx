import { useState } from 'react';
import { useTransactionStore } from '@/stores/transaction-store';
import { downloadCsv } from '@/services/csvExport';
import { Button } from '@/components/ui/button';

export function ExportSection() {
  const { transactions, currentMonth } = useTransactionStore();
  const [exported, setExported] = useState(false);

  const handleExport = () => {
    const filename = currentMonth
      ? `transactions_${currentMonth}.csv`
      : `transactions_${new Date().toISOString().slice(0, 7)}.csv`;

    downloadCsv(transactions, { filename });
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  };

  return (
    <div className="rounded-lg border dark:border-white/10 border-black/10 bg-[var(--color-background)]/80 p-4 mb-4">
      <h3 className="text-[var(--color-text-primary)] font-semibold mb-3">データエクスポート</h3>
      <div className="space-y-3">
        <p className="text-[var(--color-text-secondary)] text-sm">
          現在の取引データをCSVファイルとしてダウンロードします。
        </p>
        <Button
          onClick={handleExport}
          variant="default"
          disabled={transactions.length === 0}
        >
          CSVエクスポート ({transactions.length}件)
        </Button>
        {exported && <p className="text-green-500 text-sm">ダウンロードを開始しました</p>}
        {transactions.length === 0 && (
          <p className="text-[var(--color-text-muted)] text-sm">エクスポートするデータがありません</p>
        )}
      </div>
    </div>
  );
}
