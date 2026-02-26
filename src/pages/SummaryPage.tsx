import { useState, useMemo } from 'react';
import { TrendingUp, BarChart2, PieChart as PieChartIcon, Layers } from 'lucide-react';
import { useTransactionStore } from '@/stores/transaction-store';
import MonthlyBarChart from '@/components/dashboard/MonthlyBarChart';
import CategoryPieChart from '@/components/dashboard/CategoryPieChart';
import { CurrencyDisplay } from '@/components/dashboard/CurrencyDisplay';

const toYearMonth = (dateStr: string | null | undefined) => (dateStr ?? '').slice(0, 7);

const getLastNMonths = (fromMonth: string, n: number): string[] => {
  const [yearStr, monthStr] = fromMonth.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const result: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return result;
};

const now = new Date();
const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

const formatMonthLabel = (m: string) => {
  const [year, month] = m.split('-');
  return `${year}年${parseInt(month)}月`;
};

export default function SummaryPage() {
  const transactions = useTransactionStore((s) => s.transactions);

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach((t) => months.add(toYearMonth(t.transaction_date)));
    return Array.from(months).filter(m => m.length > 0).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  const monthlyData = useMemo(() => {
    const last6 = getLastNMonths(defaultMonth, 6);
    const totals: Record<string, number> = {};
    transactions.forEach((t) => {
      const m = toYearMonth(t.transaction_date);
      if (last6.includes(m)) {
        totals[m] = (totals[m] ?? 0) + t.amount;
      }
    });
    return last6.map((m) => ({ month: m, total_amount: totals[m] ?? 0 }));
  }, [transactions]);

  const categoryData = useMemo(() => {
    const filtered = transactions.filter(
      (t) => toYearMonth(t.transaction_date) === selectedMonth
    );
    const totals: Record<string, number> = {};
    filtered.forEach((t) => {
      const cat = t.category ?? 'その他';
      totals[cat] = (totals[cat] ?? 0) + t.amount;
    });
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, selectedMonth]);

  return (
    <div className="p-6">
      {/* Page header with gradient title */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-gradient-to-br from-teal-500/20 to-teal-400/20 border border-teal-500/20">
          <TrendingUp className="w-5 h-5 text-[var(--color-primary)]" />
        </div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-400 to-teal-300 bg-clip-text text-transparent">
          集計
        </h1>
      </div>

      {/* Month selector */}
      <div className="mb-6">
        <label className="text-sm text-[var(--color-text-secondary)] mr-2">表示月:</label>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="bg-[var(--color-background)] border dark:border-white/10 border-black/10 text-[var(--color-text-primary)] rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors"
        >
          {availableMonths.length > 0 ? (
            availableMonths.map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))
          ) : (
            <option value={defaultMonth}>{formatMonthLabel(defaultMonth)}</option>
          )}
        </select>
      </div>

      {/* Monthly bar chart — float card */}
      <div className="float-card p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-4 h-4 text-[var(--color-primary)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">月次推移（過去6ヶ月）</h2>
        </div>
        {monthlyData.some((d) => d.total_amount > 0) ? (
          <MonthlyBarChart data={monthlyData} height={200} />
        ) : (
          <div className="h-[200px] flex flex-col items-center justify-center gap-2 text-[var(--color-text-secondary)]">
            <BarChart2 className="w-10 h-10 opacity-40" />
            <span className="text-sm">データなし</span>
          </div>
        )}
      </div>

      {/* Category pie chart — float card */}
      <div className="float-card p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <PieChartIcon className="w-4 h-4 text-[var(--color-primary)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            カテゴリ別支出（{formatMonthLabel(selectedMonth)}）
          </h2>
        </div>
        {categoryData.length > 0 ? (
          <CategoryPieChart data={categoryData} height={250} />
        ) : (
          <div className="h-[250px] flex flex-col items-center justify-center gap-2 text-[var(--color-text-secondary)]">
            <PieChartIcon className="w-10 h-10 opacity-40" />
            <span className="text-sm">この月はデータがありません</span>
          </div>
        )}
      </div>

      {/* Category breakdown table — float card */}
      <div className="float-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-[var(--color-primary)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">カテゴリ別内訳</h2>
        </div>
        {categoryData.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b dark:border-white/10 border-black/10">
                <th className="text-left py-2 text-[var(--color-text-secondary)] font-medium">カテゴリ</th>
                <th className="text-right py-2 text-[var(--color-text-secondary)] font-medium">金額</th>
              </tr>
            </thead>
            <tbody>
              {categoryData.map((item, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 text-[var(--color-text-primary)]">{item.name}</td>
                  <td className="py-2.5 text-right">
                    <CurrencyDisplay amount={item.value} size="sm" className="text-[var(--color-primary)]" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-10 flex flex-col items-center gap-2 text-[var(--color-text-secondary)]">
            <Layers className="w-10 h-10 opacity-40" />
            <span className="text-sm">この月のデータがありません</span>
          </div>
        )}
      </div>
    </div>
  );
}
