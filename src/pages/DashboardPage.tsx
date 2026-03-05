import { useState, useMemo, useEffect } from 'react';
import { BarChart2, PieChart, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTransactionStore } from '@/stores/transaction-store';
import { StatGrid, MonthlyBarChart, CategoryPieChart } from '@/components/dashboard';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { useAuth } from '@/hooks/useAuth';
import { initDB } from '@/lib/database';
import { getTransactions } from '@/lib/transactions';

function getCurrentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatMonthLabel(ym: string): string {
  const parts = ym.split('-');
  if (parts.length === 2) {
    return `${parts[0]}年${parseInt(parts[1])}月`;
  }
  return ym;
}

function addMonths(ym: string, delta: number): string {
  const parts = ym.split('-');
  const y = parseInt(parts[0]);
  const m = parseInt(parts[1]) - 1;
  const d = new Date(y, m + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function DashboardPage() {
  const { transactions, isLoading, dbWarning } = useTransactionStore();
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
  const { error: authError } = useAuth();

  // DEBUG-091: 殿のデバッグ用。本番削除予定
  useEffect(() => {
    (window as any).__debugDB = async () => {
      await initDB();
      const txs = await getTransactions();
      console.log('[DEBUG-091] DB transactions count:', txs.length);
      console.log('[DEBUG-091] DB transactions (first 3):', JSON.stringify(txs.slice(0, 3), null, 2));
      return txs;
    };
    console.log('[DEBUG-091] __debugDB ready. Type window.__debugDB() in console.');
  }, []);

  const monthlyData = useMemo(() => {
    const now = new Date();
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      months.push(`${y}-${mo}`);
    }
    const map: Record<string, number> = {};
    for (const tx of transactions) {
      const month = (tx.transaction_date ?? '').slice(0, 7);
      if (months.includes(month)) {
        map[month] = (map[month] ?? 0) + tx.amount;
      }
    }
    return months.map((month) => ({ month, total_amount: map[month] ?? 0 }));
  }, [transactions]);

  const categoryData = useMemo(() => {
    const filtered = transactions.filter(
      (tx) => (tx.transaction_date ?? '').slice(0, 7) === selectedMonth
    );
    const map: Record<string, number> = {};
    for (const tx of filtered) {
      const cat = tx.category ?? '未分類';
      map[cat] = (map[cat] ?? 0) + tx.amount;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [transactions, selectedMonth]);

  // Hero balance: total expenses for selected month
  const heroTotal = useMemo(() => {
    return transactions
      .filter((tx) => (tx.transaction_date ?? '').slice(0, 7) === selectedMonth)
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions, selectedMonth]);

  const isEmpty = transactions.length === 0 && !isLoading;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {authError && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          認証エラー: {authError}
        </div>
      )}
      {dbWarning && (
        <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-400">
          ⚠️ {dbWarning}
        </div>
      )}

      {/* Hero Balance Section */}
      <div className="glass-card mb-6 py-8 px-6 text-center">
        <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-3 tracking-wide uppercase">
          {formatMonthLabel(selectedMonth)}の利用総額
        </p>
        {isLoading ? (
          <div className="h-14 flex items-center justify-center">
            <span className="text-[var(--color-text-muted)] text-lg">読込中...</span>
          </div>
        ) : (
          <div
            className="font-black text-[var(--color-text-primary)] leading-none"
            style={{
              fontSize: 'clamp(2.5rem, 6vw, 3.5rem)',
              fontVariantNumeric: 'tabular-nums lining-nums',
              letterSpacing: '-0.02em',
            }}
          >
            {heroTotal > 0 ? (
              <>
                <span className="text-[0.55em] opacity-60 font-bold align-middle mr-1">¥</span>
                {heroTotal.toLocaleString('ja-JP')}
              </>
            ) : (
              <span className="text-[var(--color-text-muted)]">¥—</span>
            )}
          </div>
        )}

        {/* Month navigation — placed below hero number */}
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={() => setSelectedMonth((m) => addMonths(m, -1))}
            className="flex items-center justify-center w-8 h-8 rounded-full border dark:border-white/10 border-black/10 dark:bg-white/5 bg-black/5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-primary)]/10 hover:border-[var(--color-primary)]/30 transition-all duration-200"
            aria-label="前の月"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-[var(--color-text-secondary)] text-sm font-medium min-w-[7rem] text-center">
            {formatMonthLabel(selectedMonth)}
          </span>
          <button
            onClick={() => setSelectedMonth((m) => addMonths(m, 1))}
            className="flex items-center justify-center w-8 h-8 rounded-full border dark:border-white/10 border-black/10 dark:bg-white/5 bg-black/5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-primary)]/10 hover:border-[var(--color-primary)]/30 transition-all duration-200"
            aria-label="次の月"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* StatGrid */}
      <div className="mb-6">
        <StatGrid />
      </div>

      {isEmpty ? (
        <div className="glass-card p-12 text-center">
          <p className="text-[var(--color-text-secondary)] text-lg mb-2">データがありません</p>
          <p className="text-[var(--color-text-muted)] text-sm">
            右上の「同期」ボタンでGmailから取引データを取得してください
          </p>
        </div>
      ) : (
        <>
          {/* Graph row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="md:col-span-2 glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 className="text-cyan-400" size={16} />
                <p className="text-[var(--color-text-primary)] font-semibold">月次推移</p>
              </div>
              <MonthlyBarChart data={monthlyData} height={200} />
            </div>
            <div className="md:col-span-1 glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <PieChart className="text-purple-400" size={16} />
                <p className="text-[var(--color-text-primary)] font-semibold">カテゴリ別</p>
              </div>
              <CategoryPieChart data={categoryData} height={200} />
            </div>
          </div>

          {/* Recent transactions */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="text-cyan-400" size={16} />
              <p className="text-[var(--color-text-primary)] font-semibold">直近の取引</p>
            </div>
            <RecentTransactions transactions={transactions} limit={10} />
          </div>
        </>
      )}
    </div>
  );
}
