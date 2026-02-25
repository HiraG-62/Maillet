import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useTransactionStore } from '@/stores/transaction-store';
import { StatGrid, MonthlyBarChart, CategoryPieChart } from '@/components/dashboard';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { useAuth } from '@/hooks/useAuth';
import { useSync } from '@/hooks/useSync';

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
  const { transactions, isLoading } = useTransactionStore();
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
  const { authState } = useAuth();
  const { startSync, isSyncing, result } = useSync();
  const navigate = useNavigate();

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
      const month = tx.transaction_date.slice(0, 7);
      if (months.includes(month)) {
        map[month] = (map[month] ?? 0) + tx.amount;
      }
    }
    return months.map((month) => ({ month, total_amount: map[month] ?? 0 }));
  }, [transactions]);

  const categoryData = useMemo(() => {
    const filtered = transactions.filter(
      (tx) => tx.transaction_date.slice(0, 7) === selectedMonth
    );
    const map: Record<string, number> = {};
    for (const tx of filtered) {
      const cat = tx.category ?? '未分類';
      map[cat] = (map[cat] ?? 0) + tx.amount;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [transactions, selectedMonth]);

  const isEmpty = transactions.length === 0 && !isLoading;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">ダッシュボード</h1>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => setSelectedMonth((m) => addMonths(m, -1))}
              className="text-slate-500 hover:text-slate-300 transition-colors p-0.5"
              aria-label="前の月"
            >
              ‹
            </button>
            <span className="text-slate-400 text-sm">{formatMonthLabel(selectedMonth)}</span>
            <button
              onClick={() => setSelectedMonth((m) => addMonths(m, 1))}
              className="text-slate-500 hover:text-slate-300 transition-colors p-0.5"
              aria-label="次の月"
            >
              ›
            </button>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-300 text-sm hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSyncing}
            onClick={() => {
              if (!authState.isAuthenticated) {
                navigate('/settings');
                return;
              }
              startSync();
            }}
          >
            <svg
              className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {isSyncing ? '同期中...' : '同期'}
          </button>
          {result && !isSyncing && (
            <span className="text-xs text-slate-500">
              新規 {result.new_transactions}件 取得
            </span>
          )}
        </div>
      </div>

      {/* StatGrid */}
      <div className="mb-6">
        <StatGrid />
      </div>

      {isEmpty ? (
        <div className="rounded-lg border border-white/10 bg-[#12121a]/80 backdrop-blur-xl p-12 text-center">
          <p className="text-slate-400 text-lg mb-2">データがありません</p>
          <p className="text-slate-500 text-sm">
            右上の「同期」ボタンでGmailから取引データを取得してください
          </p>
        </div>
      ) : (
        <>
          {/* Graph row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="md:col-span-2 rounded-lg border border-white/10 bg-[#12121a]/80 backdrop-blur-xl p-4">
              <p className="text-slate-200 font-semibold mb-3">月次推移</p>
              <MonthlyBarChart data={monthlyData} height={200} />
            </div>
            <div className="md:col-span-1 rounded-lg border border-white/10 bg-[#12121a]/80 backdrop-blur-xl p-4">
              <p className="text-slate-200 font-semibold mb-3">カテゴリ別</p>
              <CategoryPieChart data={categoryData} height={200} />
            </div>
          </div>

          {/* Recent transactions */}
          <div className="rounded-lg border border-white/10 bg-[#12121a]/80 backdrop-blur-xl p-4">
            <p className="text-slate-200 font-semibold mb-3">直近の取引</p>
            <RecentTransactions transactions={transactions} limit={10} />
          </div>
        </>
      )}
    </div>
  );
}
