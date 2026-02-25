import { useState, useMemo } from 'react';
import { useTransactionStore } from '@/stores/transaction-store';
import { FilterBar } from '@/components/transactions/FilterBar';
import { TransactionCard } from '@/components/transactions/TransactionCard';
import { TransactionTable } from '@/components/transactions/TransactionTable';

export default function TransactionsPage() {
  const { transactions } = useTransactionStore();

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

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-2xl font-bold text-cyan-400">取引一覧</h1>

      <FilterBar
        selectedMonth={selectedMonth}
        selectedCard={selectedCard}
        searchQuery={searchQuery}
        onMonthChange={setSelectedMonth}
        onCardChange={setSelectedCard}
        onSearchChange={setSearchQuery}
      />

      {filtered.length === 0 ? (
        <div className="text-slate-400 text-center py-12">取引データがありません</div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col gap-3 md:hidden">
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

          {/* PC: table */}
          <TransactionTable transactions={filtered} />
        </>
      )}
    </div>
  );
}
