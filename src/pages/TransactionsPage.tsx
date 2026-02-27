import { useState, useMemo, useEffect } from 'react';
import { useTransactionStore } from '@/stores/transaction-store';
import { FilterBar } from '@/components/transactions/FilterBar';
import { TransactionCard } from '@/components/transactions/TransactionCard';
import { TransactionTable } from '@/components/transactions/TransactionTable';
import { initDB } from '@/lib/database';
import { getTransactions } from '@/lib/transactions';
import { Receipt } from 'lucide-react';

export default function TransactionsPage() {
  const { transactions, setTransactions, setLoading } = useTransactionStore();

  // マウント時にDBからデータを読み込む（ページ遷移後もデータを保持）
  useEffect(() => {
    setLoading(true);
    initDB()
      .then(() => getTransactions())
      .then((data) => {
        setTransactions(data ?? []);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [setTransactions, setLoading]);

  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedCard, setSelectedCard] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (selectedMonth !== 'all') {
        const txMonth = (tx.transaction_date ?? '').slice(0, 7); // "YYYY-MM"
        if (txMonth !== selectedMonth) return false;
      }
      if (selectedCard !== 'all') {
        if (tx.card_company !== selectedCard) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inMerchant = (tx.merchant ?? '').toLowerCase().includes(q);
        const inDesc = (tx.description ?? '').toLowerCase().includes(q);
        if (!inMerchant && !inDesc) return false;
      }
      return true;
    });
  }, [transactions, selectedMonth, selectedCard, searchQuery]);

  function handleReset() {
    setSelectedMonth('all');
    setSelectedCard('all');
    setSearchQuery('');
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] bg-clip-text text-transparent">
          取引一覧
        </h1>
        <span className="bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-xs px-2 py-0.5 rounded-full border border-[var(--color-primary)]/30">
          {filtered.length}件
        </span>
      </div>

      <FilterBar
        selectedMonth={selectedMonth}
        selectedCard={selectedCard}
        searchQuery={searchQuery}
        onMonthChange={setSelectedMonth}
        onCardChange={setSelectedCard}
        onSearchChange={setSearchQuery}
        onReset={handleReset}
      />

      {filtered.length === 0 ? (
        <div className="float-card flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-16 h-16 rounded-full dark:bg-white/5 bg-black/5 flex items-center justify-center border dark:border-white/10 border-black/10">
            <Receipt className="w-8 h-8 text-[var(--color-text-muted)]" />
          </div>
          <div className="text-center">
            <p className="text-[var(--color-text-secondary)] font-medium">取引データがありません</p>
            <p className="text-[var(--color-text-muted)] text-sm mt-1">フィルターを変更するか、メールを同期してください</p>
          </div>
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="float-card p-0 overflow-hidden md:hidden">
            <div className="flex flex-col divide-y dark:divide-white/5 divide-black/5">
              {filtered
                .slice()
                .sort(
                  (a, b) =>
                    new Date(b.transaction_date ?? '').getTime() -
                    new Date(a.transaction_date ?? '').getTime()
                )
                .map((tx, idx) => (
                  <TransactionCard key={tx.id ?? idx} transaction={tx} />
                ))}
            </div>
          </div>

          {/* PC: table */}
          <div className="float-card p-0 overflow-hidden hidden md:block">
            <TransactionTable transactions={filtered} />
          </div>
        </>
      )}
    </div>
  );
}
